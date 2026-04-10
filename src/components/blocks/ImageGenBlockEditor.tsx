import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useProjectStore, flattenAssets } from '../../store/projectStore';
import { useEditorPrefsStore } from '../../store/editorPrefsStore';
import type { ImageGenBlock } from '../../types';
import { fsApi, joinPath, toLocalFileUrl, resolveAssetPath } from '../../lib/fsApi';
import { useT } from '../../i18n';
import { BlockEffectsPanel } from './BlockEffectsPanel';
import { generateImageWithProvider, type ComfyProgress } from '../../utils/imageGen/providers';
import { generateImagePromptWithLlm } from '../../utils/imageGen/llmPrompt';

async function collectWorkflowFiles(absDir: string, relDir: string): Promise<string[]> {
  const entries = await fsApi.listDir(absDir);
  const files: string[] = [];
  for (const entry of entries) {
    const absPath = joinPath(absDir, entry.name);
    const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (entry.isDir) {
      files.push(...await collectWorkflowFiles(absPath, relPath));
    } else if (entry.name.toLowerCase().endsWith('.json')) {
      files.push(relPath);
    }
  }
  return files;
}

function detectExt(imageUrl: string, contentType: string | null): string {
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return 'jpg';
  if (contentType?.includes('webp')) return 'webp';
  if (contentType?.includes('gif')) return 'gif';
  const byUrl = imageUrl.split('?')[0].split('.').pop()?.toLowerCase();
  return byUrl || 'png';
}

function randomSeed(): number {
  // Keep within safe integer range for JS and common ComfyUI setups.
  return Math.floor(Math.random() * 4294967295);
}

const ASPECT_RATIOS = [
  { label: '1:1',  w: 1, h: 1 },
  { label: '4:3',  w: 4, h: 3 },
  { label: '3:4',  w: 3, h: 4 },
  { label: '16:9', w: 16, h: 9 },
  { label: '9:16', w: 9, h: 16 },
] as const;

export function ImageGenBlockEditor({
  block,
  sceneId,
  onUpdate,
}: {
  block: ImageGenBlock;
  sceneId: string;
  onUpdate?: (patch: Partial<ImageGenBlock>) => void;
}) {
  const t = useT();
  const ig = t.imageGenBlock;
  const { project, projectDir, updateBlock, addAsset, deleteAssetNode, saveSnapshot } = useProjectStore();
  const {
    llmEnabled,
    llmProvider,
    llmUrl,
    llmGeminiModel,
    llmOpenaiUrl,
    llmOpenaiApiKey,
    llmOpenaiModel,
    llmMaxTokens,
    llmTemperature,
    llmSystemPrompt,
    comfyUiWorkflowsDir,
  } = useEditorPrefsStore();

  const update = onUpdate ?? ((p: Partial<ImageGenBlock>) => updateBlock(sceneId, block.id, p as never));
  const [workflows, setWorkflows] = useState<string[]>([]);
  const [busyImage, setBusyImage] = useState(false);
  const [busyPrompt, setBusyPrompt] = useState(false);
  const [genProgress, setGenProgress] = useState<ComfyProgress | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const clearConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seedMode = block.seedMode ?? 'random';

  // Load workflow list from global dir (if set) or project dir.
  useEffect(() => {
    let alive = true;
    async function run() {
      const useGlobal = comfyUiWorkflowsDir.trim() !== '';
      let root: string;
      let relPrefix: string;

      if (useGlobal) {
        root = comfyUiWorkflowsDir.trim();
        relPrefix = '';
      } else {
        if (!projectDir) return;
        root = joinPath(projectDir, 'comfyUI_workflows');
        relPrefix = 'comfyUI_workflows';
      }

      if (!await fsApi.exists(root)) {
        if (alive) setWorkflows([]);
        return;
      }
      const list = await collectWorkflowFiles(root, relPrefix);
      if (alive) setWorkflows(list.sort((a, b) => a.localeCompare(b)));
    }
    run().catch(() => {});
    return () => { alive = false; };
  }, [projectDir, comfyUiWorkflowsDir]);

  const refreshWorkflows = async () => {
    const useGlobal = comfyUiWorkflowsDir.trim() !== '';
    let root: string;
    let relPrefix: string;

    if (useGlobal) {
      root = comfyUiWorkflowsDir.trim();
      relPrefix = '';
    } else {
      if (!projectDir) return;
      root = joinPath(projectDir, 'comfyUI_workflows');
      relPrefix = 'comfyUI_workflows';
    }

    if (!await fsApi.exists(root)) {
      setWorkflows([]);
      return;
    }
    const list = await collectWorkflowFiles(root, relPrefix);
    setWorkflows(list.sort((a, b) => a.localeCompare(b)));
  };

  const history = block.history ?? [];
  const imageAssets = useMemo(() => new Set(flattenAssets(project.assetNodes).map(a => a.relativePath)), [project.assetNodes]);
  // Resolve preview: history/ paths live directly under projectDir; assets/ paths inside release/
  const currentPreview = block.src && projectDir
    ? toLocalFileUrl(resolveAssetPath(projectDir, block.src))
    : '';
  const isApproved = block.src.startsWith('assets/');

  const generatePrompt = async () => {
    const scene = project.scenes.find(s => s.id === sceneId);
    if (!scene || !llmEnabled) return;
    setBusyPrompt(true);
    try {
      const urlOrApiKey = llmProvider === 'openai' ? llmOpenaiUrl : llmUrl;
      const model = llmProvider === 'openai' ? llmOpenaiModel : llmGeminiModel;
      const prompt = await generateImagePromptWithLlm(
        {
          provider: llmProvider,
          urlOrApiKey,
          apiKey: llmProvider === 'openai' ? llmOpenaiApiKey : undefined,
          model,
          maxTokens: llmMaxTokens,
          temperature: llmTemperature,
          systemPrompt: llmSystemPrompt,
        },
        project,
        scene,
        block.id,
        block.prompt,
      );
      if (prompt) update({ prompt });
    } catch {
      toast.error(ig.errorGeneratePrompt);
    } finally {
      setBusyPrompt(false);
    }
  };

  const generateImage = async () => {
    if (!projectDir) return toast.error(ig.errorNoProjectDir);
    if (block.provider === 'comfyui' && !block.workflowFile) return toast.error(ig.errorNoWorkflow);
    if (!block.prompt.trim()) return toast.error(ig.errorNoPrompt);

    saveSnapshot();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusyImage(true);
    setGenProgress(null);
    try {
      // Resolve workflow JSON: global dir or project dir.
      let workflowJson = {};
      if (block.provider === 'comfyui' && block.workflowFile) {
        const useGlobal = comfyUiWorkflowsDir.trim() !== '';
        const wfPath = useGlobal
          ? joinPath(comfyUiWorkflowsDir.trim(), block.workflowFile)
          : joinPath(projectDir, block.workflowFile);
        workflowJson = JSON.parse(await fsApi.readFile(wfPath));
      }

      const usedSeed = seedMode === 'random' ? randomSeed() : (Number.isFinite(block.seed) ? block.seed : 0);
      const generated = await generateImageWithProvider(block.provider, {
        baseUrl: block.providerUrl,
        workflow: workflowJson,
        prompt: block.prompt,
        negativePrompt: block.negativePrompt,
        seed: usedSeed,
        pollinationsModel: block.pollinationsModel,
        pollinationsToken: block.pollinationsToken,
        genWidth: block.genWidth,
        genHeight: block.genHeight,
        onProgress: block.provider === 'comfyui' ? setGenProgress : undefined,
      }, controller.signal);
      // Keep the last used seed visible in editor.
      if (seedMode === 'random') update({ seed: usedSeed });

      let bytes: number[];
      let ext: string;
      if (generated.bytes) {
        bytes = generated.bytes;
        ext = detectExt('', generated.contentType ?? null);
      } else {
        const imgRes = await fsApi.httpRequestBinary({ url: generated.imageUrl! });
        if (imgRes.status < 200 || imgRes.status >= 300) throw new Error(`Image download failed: ${imgRes.status}`);
        bytes = imgRes.bytes;
        ext = detectExt(generated.imageUrl!, imgRes.headers['content-type'] ?? null);
      }
      const genId = crypto.randomUUID();
      // Generated images go to history/ (outside release/assets) — not exported automatically
      const relPath = `history/${block.id}/${genId}.${ext}`;
      const absPath = joinPath(projectDir, relPath);
      await fsApi.mkdir(joinPath(projectDir, `history/${block.id}`));
      await fsApi.writeFileBinary(absPath, bytes);

      const nextHistory = [
        ...history,
        {
          id: genId,
          src: relPath,
          prompt: block.prompt,
          seed: usedSeed,
          createdAt: Date.now(),
          provider: block.provider,
        },
      ];
      update({ src: relPath, history: nextHistory });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Cancelled by user — no toast needed.
      } else {
        console.error('[ImageGen] generation failed:', err);
        toast.error(ig.errorGenerateImage);
      }
    } finally {
      abortRef.current = null;
      setBusyImage(false);
      setGenProgress(null);
    }
  };

  const cancelGeneration = () => {
    abortRef.current?.abort();
  };

  const handleClearHistory = () => {
    if (!clearConfirm) {
      setClearConfirm(true);
      clearConfirmTimerRef.current = setTimeout(() => setClearConfirm(false), 3000);
      return;
    }
    // Confirmed — keep only the currently selected entry.
    if (clearConfirmTimerRef.current) clearTimeout(clearConfirmTimerRef.current);
    setClearConfirm(false);
    const kept = history.filter(h => h.src === block.src);
    update({ history: kept });
  };

  const approveImage = async () => {
    if (!projectDir || !block.src) return;
    const ext = block.src.split('.').pop() ?? 'png';
    const defaultName = `${block.id}.${ext}`;
    // Ensure release/assets/ exists so the dialog opens there
    await fsApi.mkdir(joinPath(projectDir, 'release', 'assets'));
    const defaultPath = joinPath(projectDir, 'release', 'assets', defaultName);
    const savePath = await fsApi.saveFileDialog({
      title: ig.approveImageTitle,
      defaultPath,
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    });
    if (!savePath) return;

    // Derive relative path from release dir (assets must live inside release/)
    const normalizedRelease = joinPath(projectDir, 'release').replace(/\\/g, '/') + '/';
    const normalizedSave = savePath.replace(/\\/g, '/');
    if (!normalizedSave.startsWith(normalizedRelease)) {
      toast.error('Please save the image inside the project\'s release/ folder.');
      return;
    }
    const relPath = normalizedSave.slice(normalizedRelease.length); // e.g. "assets/gen/blockId/name.png"

    try {
      // Ensure destination parent folder exists (user may have typed a new subfolder)
      const parentAbs = savePath.replace(/[/\\][^/\\]+$/, '');
      await fsApi.mkdir(parentAbs);

      const srcAbs = resolveAssetPath(projectDir, block.src);
      await fsApi.copyFile(srcAbs, savePath);

      if (!imageAssets.has(relPath)) {
        addAsset(null, {
          name: savePath.replace(/.*[/\\]/, ''),
          assetType: 'image',
          relativePath: relPath,
        });
      }

      const approvedHistoryId = history.find(h => h.src === block.src)?.id;
      update({ src: relPath, approvedHistoryId });
      toast.success(ig.approvedBadge);
    } catch {
      toast.error(ig.errorApprove);
    }
  };

  const unapproveImage = async () => {
    if (!projectDir || !block.src || !isApproved) return;
    try {
      const absPath = resolveAssetPath(projectDir, block.src);
      // Remove file from disk
      try { await fsApi.deleteFile(absPath); } catch { /* already gone */ }
      // Remove from asset tree
      const assetNode = flattenAssets(project.assetNodes).find(a => a.relativePath === block.src);
      if (assetNode) deleteAssetNode(assetNode.id);
      // Revert block.src to the history entry that was approved
      const historyEntry = history.find(h => h.id === block.approvedHistoryId);
      update({ src: historyEntry?.src ?? '', approvedHistoryId: undefined });
    } catch {
      toast.error(ig.errorUnapprove);
    }
  };

  const applyAspectRatio = (wRatio: number, hRatio: number) => {
    const base = block.genWidth && block.genWidth > 0 ? block.genWidth : 1024;
    const newWidth = base;
    const newHeight = Math.round(base * hRatio / wRatio);
    update({ genWidth: newWidth, genHeight: newHeight });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{ig.providerLabel}</label>
        <select
          className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
          value={block.provider}
          onChange={e => update({ provider: e.target.value as ImageGenBlock['provider'] })}
        >
          <option value="comfyui">{ig.providerComfyui}</option>
          <option value="pollinations">{ig.providerPollinations}</option>
        </select>
      </div>

      {block.provider === 'comfyui' && (
        <>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-20 shrink-0">{ig.providerUrlLabel}</label>
            <input
              className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
              value={block.providerUrl}
              onChange={e => update({ providerUrl: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-20 shrink-0">{ig.workflowLabel}</label>
            <select
              className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
              value={block.workflowFile}
              onChange={e => update({ workflowFile: e.target.value })}
            >
              <option value="">{ig.workflowNone}</option>
              {workflows.map(wf => <option key={wf} value={wf}>{wf}</option>)}
            </select>
            <button
              type="button"
              className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-200 cursor-pointer"
              onClick={refreshWorkflows}
            >
              {ig.workflowRefresh}
            </button>
          </div>
        </>
      )}

      {block.provider === 'pollinations' && (
        <>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-20 shrink-0">{ig.pollinationsModelLabel}</label>
            <input
              className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
              placeholder={ig.pollinationsModelPlaceholder}
              value={block.pollinationsModel ?? ''}
              onChange={e => update({ pollinationsModel: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-20 shrink-0">{ig.pollinationsTokenLabel}</label>
            <input
              type="password"
              className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
              placeholder={ig.pollinationsTokenPlaceholder}
              value={block.pollinationsToken ?? ''}
              onChange={e => update({ pollinationsToken: e.target.value })}
            />
          </div>
        </>
      )}

      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{ig.promptModeLabel}</label>
        <div className="flex gap-1">
          {([
            ['manual', ig.promptModeManual],
            ['llm', ig.promptModeLlm],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => update({ promptMode: mode })}
              className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                block.promptMode === mode ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0 pt-2">{ig.promptLabel}</label>
        <div className="flex-1 flex flex-col gap-1.5">
          <textarea
            className="w-full bg-slate-800 text-slate-200 text-sm rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500 min-h-[70px]"
            placeholder={ig.promptPlaceholder}
            value={block.prompt}
            onChange={e => update({ prompt: e.target.value })}
          />
          {block.promptMode === 'llm' && (
            <button
              type="button"
              disabled={busyPrompt || !llmEnabled}
              className="self-start px-2.5 py-1 text-xs rounded bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white cursor-pointer"
              onClick={generatePrompt}
            >
              {busyPrompt ? ig.llmGenerating : ig.llmGeneratePrompt}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0 pt-2">{ig.negativePromptLabel}</label>
        <textarea
          className="flex-1 bg-slate-800 text-slate-200 text-sm rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500 min-h-[50px]"
          placeholder={ig.negativePromptPlaceholder}
          value={block.negativePrompt ?? ''}
          onChange={e => update({ negativePrompt: e.target.value })}
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{ig.seedModeLabel}</label>
        <div className="flex gap-1">
          {([
            ['manual', ig.seedModeManual],
            ['random', ig.seedModeRandom],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => update({ seedMode: mode })}
              className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                seedMode === mode ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{ig.seedLabel}</label>
        <input
          type="number"
          min={0}
          max={4294967295}
          disabled={seedMode !== 'manual'}
          className="w-48 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 disabled:opacity-50"
          placeholder={ig.seedPlaceholder}
          value={block.seed ?? ''}
          onChange={e => update({ seed: parseInt(e.target.value, 10) || 0 })}
        />
      </div>

      {/* Generation size */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{ig.genSizeLabel}</label>
        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            type="number"
            min={0}
            className="w-20 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
            placeholder={ig.genWidthPlaceholder}
            value={block.genWidth || ''}
            onChange={e => update({ genWidth: parseInt(e.target.value, 10) || 0 })}
          />
          <span className="text-xs text-slate-500">×</span>
          <input
            type="number"
            min={0}
            className="w-20 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
            placeholder={ig.genHeightPlaceholder}
            value={block.genHeight || ''}
            onChange={e => update({ genHeight: parseInt(e.target.value, 10) || 0 })}
          />
          <div className="flex gap-0.5">
            {ASPECT_RATIOS.map(({ label, w, h }) => (
              <button
                key={label}
                type="button"
                className="px-1.5 py-0.5 text-[10px] rounded bg-slate-700 hover:bg-slate-600 text-slate-300 cursor-pointer"
                onClick={() => applyAspectRatio(w, h)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busyImage}
          className="px-3 py-1.5 text-xs rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white cursor-pointer"
          onClick={generateImage}
        >
          {busyImage ? ig.generatingImage : ig.generateImage}
        </button>
        {busyImage && (
          <>
            <button
              type="button"
              className="px-3 py-1.5 text-xs rounded bg-slate-600 hover:bg-slate-500 text-white cursor-pointer"
              onClick={cancelGeneration}
            >
              {ig.cancelGeneration}
            </button>
            {genProgress && (
              <span className="text-[10px] text-slate-400">
                {genProgress.current}/{genProgress.total}
              </span>
            )}
          </>
        )}
      </div>

      {/* History */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{ig.historyLabel}</label>
        <select
          className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
          value={block.src}
          onChange={e => update({ src: e.target.value, approvedHistoryId: undefined })}
        >
          <option value="">{ig.historyEmpty}</option>
          {[...history].reverse().map(h => (
            <option key={h.id} value={h.src}>
              {new Date(h.createdAt).toLocaleString()} · {h.id.slice(0, 8)}{h.seed !== undefined ? ` · seed ${h.seed}` : ''}
            </option>
          ))}
        </select>
        {history.length > 0 && (
          <button
            type="button"
            className={`px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
              clearConfirm
                ? 'bg-red-700 hover:bg-red-600 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
            }`}
            onClick={handleClearHistory}
          >
            {clearConfirm ? ig.clearHistoryConfirm : ig.clearHistory}
          </button>
        )}
      </div>

      {/* Approve / Unapprove */}
      {block.src && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 w-20 shrink-0" />
          {isApproved ? (
            <>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-900/50 border border-emerald-700 text-emerald-400">
                ✓ {ig.approvedBadge}
              </span>
              <button
                type="button"
                title={ig.unapproveImageTitle}
                className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-red-800 text-slate-300 hover:text-white cursor-pointer transition-colors"
                onClick={unapproveImage}
              >
                {ig.unapproveImage}
              </button>
            </>
          ) : (
            <>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-900/50 border border-amber-700 text-amber-400">
                ⚠ {ig.draftBadge}
              </span>
              <button
                type="button"
                title={ig.approveImageTitle}
                className="px-2 py-1 text-xs rounded bg-emerald-800 hover:bg-emerald-700 text-white cursor-pointer transition-colors"
                onClick={approveImage}
              >
                {ig.approveImage}
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{ig.altLabel}</label>
        <input
          className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
          placeholder={ig.altPlaceholder}
          value={block.alt}
          onChange={e => update({ alt: e.target.value })}
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{ig.widthLabel}</label>
        <input
          type="number"
          min={0}
          className="w-24 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
          placeholder={ig.widthPlaceholder}
          value={block.width || ''}
          onChange={e => update({ width: parseInt(e.target.value, 10) || 0 })}
        />
      </div>

      {currentPreview && (
        <img
          src={currentPreview}
          alt={block.alt || 'generated'}
          className="max-h-44 object-contain rounded border border-slate-700"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}

      <BlockEffectsPanel delay={block.delay} onDelayChange={v => update({ delay: v })} />
    </div>
  );
}
