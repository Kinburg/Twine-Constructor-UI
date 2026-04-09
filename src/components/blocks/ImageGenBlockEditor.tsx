import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useProjectStore, flattenAssets } from '../../store/projectStore';
import { useEditorPrefsStore } from '../../store/editorPrefsStore';
import type { ImageGenBlock } from '../../types';
import { fsApi, joinPath, toLocalFileUrl } from '../../lib/fsApi';
import { useT } from '../../i18n';
import { BlockEffectsPanel } from './BlockEffectsPanel';
import { generateImageWithProvider } from '../../utils/imageGen/providers';
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
  const { project, projectDir, updateBlock, addAsset, saveSnapshot } = useProjectStore();
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
  } = useEditorPrefsStore();

  const update = onUpdate ?? ((p: Partial<ImageGenBlock>) => updateBlock(sceneId, block.id, p as never));
  const [workflows, setWorkflows] = useState<string[]>([]);
  const [busyImage, setBusyImage] = useState(false);
  const [busyPrompt, setBusyPrompt] = useState(false);
  const seedMode = block.seedMode ?? 'random';

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!projectDir) return;
      const root = joinPath(projectDir, 'comfyUI_workflows');
      if (!await fsApi.exists(root)) {
        if (alive) setWorkflows([]);
        return;
      }
      const list = await collectWorkflowFiles(root, 'comfyUI_workflows');
      if (alive) setWorkflows(list.sort((a, b) => a.localeCompare(b)));
    }
    run().catch(() => {});
    return () => { alive = false; };
  }, [projectDir]);

  const history = block.history ?? [];
  const imageAssets = useMemo(() => new Set(flattenAssets(project.assetNodes).map(a => a.relativePath)), [project.assetNodes]);
  const currentPreview = block.src && projectDir ? toLocalFileUrl(joinPath(projectDir, block.src)) : '';

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
      toast.error(t.imageGenBlock.errorGeneratePrompt);
    } finally {
      setBusyPrompt(false);
    }
  };

  const generateImage = async () => {
    if (!projectDir) return toast.error(t.imageGenBlock.errorNoProjectDir);
    if (block.provider === 'comfyui' && !block.workflowFile) return toast.error(t.imageGenBlock.errorNoWorkflow);
    if (!block.prompt.trim()) return toast.error(t.imageGenBlock.errorNoPrompt);

    saveSnapshot();
    setBusyImage(true);
    try {
      const workflowJson = block.provider === 'comfyui' && block.workflowFile
        ? JSON.parse(await fsApi.readFile(joinPath(projectDir, block.workflowFile)))
        : {};
      const usedSeed = seedMode === 'random' ? randomSeed() : (Number.isFinite(block.seed) ? block.seed : 0);
      const generated = await generateImageWithProvider(block.provider, {
        baseUrl: block.providerUrl,
        workflow: workflowJson,
        prompt: block.prompt,
        negativePrompt: block.negativePrompt,
        seed: usedSeed,
        pollinationsModel: block.pollinationsModel,
        pollinationsToken: block.pollinationsToken,
        width: block.width,
      });
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
      const relPath = `assets/history/${block.id}/${genId}.${ext}`;
      const absPath = joinPath(projectDir, relPath);
      await fsApi.writeFileBinary(absPath, bytes);

      if (!imageAssets.has(relPath)) {
        addAsset(null, {
          name: `${genId}.${ext}`,
          assetType: 'image',
          relativePath: relPath,
        });
      }

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
    } catch (err) {
      console.error('[ImageGen] generation failed:', err);
      toast.error(t.imageGenBlock.errorGenerateImage);
    } finally {
      setBusyImage(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{t.imageGenBlock.providerLabel}</label>
        <select
          className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
          value={block.provider}
          onChange={e => update({ provider: e.target.value as ImageGenBlock['provider'] })}
        >
          <option value="comfyui">{t.imageGenBlock.providerComfyui}</option>
          <option value="pollinations">{t.imageGenBlock.providerPollinations}</option>
        </select>
      </div>

      {block.provider === 'comfyui' && (
        <>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-20 shrink-0">{t.imageGenBlock.providerUrlLabel}</label>
            <input
              className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
              value={block.providerUrl}
              onChange={e => update({ providerUrl: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-20 shrink-0">{t.imageGenBlock.workflowLabel}</label>
            <select
              className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
              value={block.workflowFile}
              onChange={e => update({ workflowFile: e.target.value })}
            >
              <option value="">{t.imageGenBlock.workflowNone}</option>
              {workflows.map(wf => <option key={wf} value={wf}>{wf}</option>)}
            </select>
            <button
              type="button"
              className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-200 cursor-pointer"
              onClick={async () => {
                if (!projectDir) return;
                const root = joinPath(projectDir, 'comfyUI_workflows');
                const list = await collectWorkflowFiles(root, 'comfyUI_workflows');
                setWorkflows(list.sort((a, b) => a.localeCompare(b)));
              }}
            >
              {t.imageGenBlock.workflowRefresh}
            </button>
          </div>
        </>
      )}

      {block.provider === 'pollinations' && (
        <>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-20 shrink-0">{t.imageGenBlock.pollinationsModelLabel}</label>
            <input
              className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
              placeholder={t.imageGenBlock.pollinationsModelPlaceholder}
              value={block.pollinationsModel ?? ''}
              onChange={e => update({ pollinationsModel: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-20 shrink-0">{t.imageGenBlock.pollinationsTokenLabel}</label>
            <input
              type="password"
              className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
              placeholder={t.imageGenBlock.pollinationsTokenPlaceholder}
              value={block.pollinationsToken ?? ''}
              onChange={e => update({ pollinationsToken: e.target.value })}
            />
          </div>
        </>
      )}

      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{t.imageGenBlock.promptModeLabel}</label>
        <div className="flex gap-1">
          {([
            ['manual', t.imageGenBlock.promptModeManual],
            ['llm', t.imageGenBlock.promptModeLlm],
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
        <label className="text-xs text-slate-400 w-20 shrink-0 pt-2">{t.imageGenBlock.promptLabel}</label>
        <div className="flex-1 flex flex-col gap-1.5">
          <textarea
            className="w-full bg-slate-800 text-slate-200 text-sm rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500 min-h-[70px]"
            placeholder={t.imageGenBlock.promptPlaceholder}
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
              {busyPrompt ? t.imageGenBlock.llmGenerating : t.imageGenBlock.llmGeneratePrompt}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0 pt-2">{t.imageGenBlock.negativePromptLabel}</label>
        <textarea
          className="flex-1 bg-slate-800 text-slate-200 text-sm rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500 min-h-[50px]"
          placeholder={t.imageGenBlock.negativePromptPlaceholder}
          value={block.negativePrompt ?? ''}
          onChange={e => update({ negativePrompt: e.target.value })}
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{t.imageGenBlock.seedModeLabel}</label>
        <div className="flex gap-1">
          {([
            ['manual', t.imageGenBlock.seedModeManual],
            ['random', t.imageGenBlock.seedModeRandom],
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
        <label className="text-xs text-slate-400 w-20 shrink-0">{t.imageGenBlock.seedLabel}</label>
        <input
          type="number"
          min={0}
          max={4294967295}
          disabled={seedMode !== 'manual'}
          className="w-48 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 disabled:opacity-50"
          placeholder={t.imageGenBlock.seedPlaceholder}
          value={block.seed ?? ''}
          onChange={e => update({ seed: parseInt(e.target.value, 10) || 0 })}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busyImage}
          className="px-3 py-1.5 text-xs rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white cursor-pointer"
          onClick={generateImage}
        >
          {busyImage ? t.imageGenBlock.generatingImage : t.imageGenBlock.generateImage}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{t.imageGenBlock.historyLabel}</label>
        <select
          className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
          value={block.src}
          onChange={e => update({ src: e.target.value })}
        >
          <option value="">{t.imageGenBlock.historyEmpty}</option>
          {[...history].reverse().map(h => (
            <option key={h.id} value={h.src}>
              {new Date(h.createdAt).toLocaleString()} · {h.id.slice(0, 8)}{h.seed !== undefined ? ` · seed ${h.seed}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{t.imageGenBlock.altLabel}</label>
        <input
          className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
          placeholder={t.imageGenBlock.altPlaceholder}
          value={block.alt}
          onChange={e => update({ alt: e.target.value })}
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{t.imageGenBlock.widthLabel}</label>
        <input
          type="number"
          min={0}
          className="w-24 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
          placeholder={t.imageGenBlock.widthPlaceholder}
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
