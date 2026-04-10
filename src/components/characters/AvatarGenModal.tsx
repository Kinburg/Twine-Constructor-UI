import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useProjectStore, flattenAssets } from '../../store/projectStore';
import { useEditorPrefsStore } from '../../store/editorPrefsStore';
import { fsApi, joinPath, toLocalFileUrl, resolveAssetPath } from '../../lib/fsApi';
import type { AvatarConfig, AvatarGenHistoryEntry, AvatarGenSettings, AvatarGenSlotData, ImageBoundMapping } from '../../types';
import { useT } from '../../i18n';
import { generateImageWithProvider, type ComfyProgress } from '../../utils/imageGen/providers';
import { generateAvatarPromptWithLlm } from '../../utils/imageGen/llmPrompt';

// ─── helpers ─────────────────────────────────────────────────────────────────

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
  return Math.floor(Math.random() * 4294967295);
}

function sanitizeFilename(value: string): string {
  return value.replace(/[/\\]/g, '').replace(/[^a-z0-9_\-]/gi, '_').replace(/_{2,}/g, '_') || 'slot';
}

function slotApproveFilename(slot: ModalSlotState, mapping: ImageBoundMapping | null): string {
  if (slot.slotId === 'static') return ''; // handled separately with charVarName
  if (slot.slotId === 'default') return 'default';
  if (!mapping) return sanitizeFilename(slot.label);
  if (mapping.matchType === 'range') return `${mapping.rangeMin ?? '0'}-${mapping.rangeMax ?? '0'}`;
  return sanitizeFilename(mapping.value || slot.label);
}

const ASPECT_RATIOS = [
  { label: '1:1',  w: 1, h: 1 },
  { label: '3:4',  w: 3, h: 4 },
  { label: '2:3',  w: 2, h: 3 },
  { label: '9:16', w: 9, h: 16 },
] as const;

// ─── slot state ───────────────────────────────────────────────────────────────

interface ModalSlotState {
  slotId: string;
  label: string;
  prompt: string;
  negativePrompt: string;
  history: AvatarGenHistoryEntry[];
  currentSrc: string;
  busy: boolean;
  busyPrompt: boolean;
  progress: ComfyProgress | null;
}

function initSlots(cfg: AvatarConfig, staticLabel: string, defaultLabel: string): ModalSlotState[] {
  const saved = cfg.genSettings?.slots ?? [];
  const find = (id: string) => saved.find(s => s.slotId === id);

  if (cfg.mode === 'static') {
    const s = find('static');
    return [{
      slotId: 'static',
      label: staticLabel,
      prompt: s?.prompt ?? '',
      negativePrompt: s?.negativePrompt ?? '',
      history: s?.history ?? [],
      currentSrc: s?.currentSrc ?? '',
      busy: false,
      busyPrompt: false,
      progress: null,
    }];
  }

  const slots: ModalSlotState[] = cfg.mapping.map(m => {
    const s = find(m.id ?? '');
    const label = m.matchType === 'range'
      ? `${m.rangeMin ?? ''}–${m.rangeMax ?? ''}`
      : (m.value || '(empty)');
    return {
      slotId: m.id ?? crypto.randomUUID(),
      label,
      prompt: s?.prompt ?? '',
      negativePrompt: s?.negativePrompt ?? '',
      history: s?.history ?? [],
      currentSrc: s?.currentSrc ?? '',
      busy: false,
      busyPrompt: false,
      progress: null,
    };
  });

  const def = find('default');
  slots.push({
    slotId: 'default',
    label: defaultLabel,
    prompt: def?.prompt ?? '',
    negativePrompt: def?.negativePrompt ?? '',
    history: def?.history ?? [],
    currentSrc: def?.currentSrc ?? '',
    busy: false,
    busyPrompt: false,
    progress: null,
  });

  return slots;
}

// ─── props ────────────────────────────────────────────────────────────────────

interface Props {
  cfg: AvatarConfig;
  charVarName: string;
  charName: string;
  charLlmDescr?: string;
  onSave: (updatedCfg: AvatarConfig) => void;
  onClose: () => void;
}

// ─── main component ───────────────────────────────────────────────────────────

export function AvatarGenModal({ cfg, charVarName, charName, charLlmDescr, onSave, onClose }: Props) {
  const t = useT();
  const ag = t.avatarGen;
  const { project, projectDir, addAsset } = useProjectStore();
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

  const mode = cfg.mode;

  // Provider settings — initialised from saved genSettings
  const [provider, setProvider] = useState<'comfyui' | 'pollinations'>(
    cfg.genSettings?.provider ?? 'pollinations',
  );
  const [providerUrl, setProviderUrl] = useState(cfg.genSettings?.providerUrl ?? 'http://127.0.0.1:8188');
  const [workflowFile, setWorkflowFile] = useState(cfg.genSettings?.workflowFile ?? '');
  const [pollinationsModel, setPollinationsModel] = useState(cfg.genSettings?.pollinationsModel ?? '');
  const [pollinationsToken, setPollinationsToken] = useState(cfg.genSettings?.pollinationsToken ?? '');
  const [genWidth, setGenWidth] = useState(cfg.genSettings?.genWidth ?? 0);
  const [genHeight, setGenHeight] = useState(cfg.genSettings?.genHeight ?? 0);

  // Slots
  const [slots, setSlots] = useState<ModalSlotState[]>(() =>
    initSlots(cfg, ag.slotLabelStatic, ag.slotLabelDefault),
  );

  // Abort controllers per slot
  const abortRefs = useRef<Map<string, AbortController>>(new Map());

  // Workflow list
  const [workflows, setWorkflows] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    async function run() {
      const useGlobal = comfyUiWorkflowsDir.trim() !== '';
      const root = useGlobal ? comfyUiWorkflowsDir.trim() : (projectDir ? joinPath(projectDir, 'comfyUI_workflows') : null);
      const relPrefix = useGlobal ? '' : 'comfyUI_workflows';
      if (!root || !await fsApi.exists(root)) { if (alive) setWorkflows([]); return; }
      const list = await collectWorkflowFiles(root, relPrefix);
      if (alive) setWorkflows(list.sort((a, b) => a.localeCompare(b)));
    }
    run().catch(() => {});
    return () => { alive = false; };
  }, [projectDir, comfyUiWorkflowsDir]);

  const refreshWorkflows = async () => {
    const useGlobal = comfyUiWorkflowsDir.trim() !== '';
    const root = useGlobal ? comfyUiWorkflowsDir.trim() : (projectDir ? joinPath(projectDir, 'comfyUI_workflows') : null);
    const relPrefix = useGlobal ? '' : 'comfyUI_workflows';
    if (!root || !await fsApi.exists(root)) { setWorkflows([]); return; }
    const list = await collectWorkflowFiles(root, relPrefix);
    setWorkflows(list.sort((a, b) => a.localeCompare(b)));
  };

  // ─── helpers ────────────────────────────────────────────────────────────────

  const updateSlot = (slotId: string, patch: Partial<ModalSlotState>) =>
    setSlots(prev => prev.map(s => s.slotId === slotId ? { ...s, ...patch } : s));

  /** Build an AvatarGenSettings from current UI state + slot data */
  const buildGenSettings = (currentSlots: ModalSlotState[]): AvatarGenSettings => ({
    provider,
    providerUrl: provider === 'comfyui' ? providerUrl : undefined,
    workflowFile: provider === 'comfyui' ? workflowFile : undefined,
    pollinationsModel: provider === 'pollinations' ? pollinationsModel : undefined,
    pollinationsToken: provider === 'pollinations' ? pollinationsToken : undefined,
    genWidth: genWidth || undefined,
    genHeight: genHeight || undefined,
    slots: currentSlots.map(s => ({
      slotId: s.slotId,
      prompt: s.prompt,
      negativePrompt: s.negativePrompt || undefined,
      history: s.history,
      currentSrc: s.currentSrc,
    } satisfies AvatarGenSlotData)),
  });

  /** Persist genSettings to parent immediately (saves history across CharacterModal session) */
  const persistGenSettings = (currentSlots: ModalSlotState[]) => {
    onSave({ ...cfg, genSettings: buildGenSettings(currentSlots) });
  };

  // ─── generate image ──────────────────────────────────────────────────────────

  const generateForSlot = async (slotId: string) => {
    if (!projectDir) return toast.error(ag.errorNoProjectDir);
    if (provider === 'comfyui' && !workflowFile) return toast.error(ag.errorNoWorkflow);
    const slot = slots.find(s => s.slotId === slotId);
    if (!slot) return;
    if (!slot.prompt.trim()) return toast.error(ag.errorNoPrompt);

    const controller = new AbortController();
    abortRefs.current.set(slotId, controller);
    updateSlot(slotId, { busy: true, progress: null });

    try {
      let workflowJson = {};
      if (provider === 'comfyui' && workflowFile) {
        const useGlobal = comfyUiWorkflowsDir.trim() !== '';
        const wfPath = useGlobal
          ? joinPath(comfyUiWorkflowsDir.trim(), workflowFile)
          : joinPath(projectDir, workflowFile);
        workflowJson = JSON.parse(await fsApi.readFile(wfPath));
      }

      const seed = randomSeed();
      const generated = await generateImageWithProvider(provider, {
        baseUrl: providerUrl,
        workflow: workflowJson,
        prompt: slot.prompt,
        negativePrompt: slot.negativePrompt || undefined,
        seed,
        pollinationsModel: pollinationsModel || undefined,
        pollinationsToken: pollinationsToken || undefined,
        genWidth: genWidth || undefined,
        genHeight: genHeight || undefined,
        onProgress: provider === 'comfyui'
          ? (p) => updateSlot(slotId, { progress: p })
          : undefined,
      }, controller.signal);

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
      const relPath = `history/chars/${charVarName}/${slotId}/${genId}.${ext}`;
      const absPath = joinPath(projectDir, relPath);
      await fsApi.mkdir(joinPath(projectDir, `history/chars/${charVarName}/${slotId}`));
      await fsApi.writeFileBinary(absPath, bytes);

      const entry: AvatarGenHistoryEntry = {
        id: genId,
        src: relPath,
        prompt: slot.prompt,
        seed,
        createdAt: Date.now(),
      };

      setSlots(prev => {
        const next = prev.map(s => s.slotId === slotId
          ? { ...s, history: [...s.history, entry], currentSrc: relPath, busy: false, progress: null }
          : s,
        );
        persistGenSettings(next);
        return next;
      });
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('[AvatarGen] generation failed:', err);
        toast.error(ag.errorGenerateImage);
      }
      updateSlot(slotId, { busy: false, progress: null });
    } finally {
      abortRefs.current.delete(slotId);
    }
  };

  const cancelForSlot = (slotId: string) => {
    abortRefs.current.get(slotId)?.abort();
  };

  // ─── generate prompt ─────────────────────────────────────────────────────────

  const generatePromptForSlot = async (slotId: string) => {
    if (!llmEnabled) return;
    const slot = slots.find(s => s.slotId === slotId);
    if (!slot) return;
    updateSlot(slotId, { busyPrompt: true });
    try {
      const urlOrApiKey = llmProvider === 'openai' ? llmOpenaiUrl : llmUrl;
      const model = llmProvider === 'openai' ? llmOpenaiModel : llmGeminiModel;
      const prompt = await generateAvatarPromptWithLlm(
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
        charName,
        charLlmDescr,
        slot.label,
        slot.prompt,
      );
      if (prompt) updateSlot(slotId, { prompt, busyPrompt: false });
      else updateSlot(slotId, { busyPrompt: false });
    } catch {
      toast.error(ag.errorGeneratePrompt);
      updateSlot(slotId, { busyPrompt: false });
    }
  };

  // ─── approve all ─────────────────────────────────────────────────────────────

  const approveAll = async () => {
    if (!projectDir) return toast.error(ag.errorNoProjectDir);

    let updatedCfg = { ...cfg };
    const updatedSlots = [...slots];
    let anyApproved = false;

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot.currentSrc || !slot.currentSrc.startsWith('history/')) continue;

      const ext = slot.currentSrc.split('.').pop() ?? 'png';
      const mapping = cfg.mapping.find(m => m.id === slot.slotId) ?? null;
      const filename = slot.slotId === 'static'
        ? `${charVarName}.${ext}`
        : `${slotApproveFilename(slot, mapping)}.${ext}`;
      const subdir = slot.slotId === 'static'
        ? `assets/chars`
        : `assets/chars/${charVarName}`;
      const relPath = `${subdir}/${filename}`;
      const savePath = joinPath(projectDir, 'release', relPath);
      const srcAbs = resolveAssetPath(projectDir, slot.currentSrc);

      try {
        await fsApi.mkdir(joinPath(projectDir, 'release', subdir));
        await fsApi.copyFile(srcAbs, savePath);

        const currentAssets = flattenAssets(project.assetNodes);
        if (!currentAssets.find(a => a.relativePath === relPath)) {
          addAsset(null, { name: filename, assetType: 'image', relativePath: relPath });
        }

        updatedSlots[i] = { ...slot, currentSrc: relPath };

        if (mode === 'static') {
          updatedCfg = { ...updatedCfg, src: relPath };
        } else if (slot.slotId === 'default') {
          updatedCfg = { ...updatedCfg, defaultSrc: relPath };
        } else {
          updatedCfg = {
            ...updatedCfg,
            mapping: updatedCfg.mapping.map(m => m.id === slot.slotId ? { ...m, src: relPath } : m),
          };
        }

        anyApproved = true;
      } catch {
        toast.error(ag.errorApprove);
      }
    }

    if (anyApproved) {
      setSlots(updatedSlots);
      const finalCfg = { ...updatedCfg, genSettings: buildGenSettings(updatedSlots) };
      onSave(finalCfg);
      toast.success(ag.approveSuccess);
    }
  };

  const applyAspectRatio = (wRatio: number, hRatio: number) => {
    const base = genWidth && genWidth > 0 ? genWidth : 1024;
    setGenWidth(base);
    setGenHeight(Math.round(base * hRatio / wRatio));
  };

  const anyBusy = slots.some(s => s.busy);
  const hasPendingApprovals = slots.some(s => s.currentSrc.startsWith('history/'));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-[700px] max-w-[95vw] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
          <h2 className="text-sm font-semibold text-white">
            {mode === 'static' ? ag.modalTitleStatic : ag.modalTitleDynamic}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors cursor-pointer text-base leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-4">

          {/* ── Provider settings ── */}
          <div className="flex flex-col gap-2 p-3 rounded bg-slate-900/60 border border-slate-700/50">
            {/* Provider selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 w-24 shrink-0">{ag.providerLabel}</label>
              <select
                className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
                value={provider}
                onChange={e => setProvider(e.target.value as 'comfyui' | 'pollinations')}
              >
                <option value="comfyui">{ag.providerComfyui}</option>
                <option value="pollinations">{ag.providerPollinations}</option>
              </select>
            </div>

            {provider === 'comfyui' && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400 w-24 shrink-0">{ag.providerUrlLabel}</label>
                  <input
                    className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
                    value={providerUrl}
                    onChange={e => setProviderUrl(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400 w-24 shrink-0">{ag.workflowLabel}</label>
                  <select
                    className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
                    value={workflowFile}
                    onChange={e => setWorkflowFile(e.target.value)}
                  >
                    <option value="">{ag.workflowNone}</option>
                    {workflows.map(wf => <option key={wf} value={wf}>{wf}</option>)}
                  </select>
                  <button
                    type="button"
                    className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-200 cursor-pointer"
                    onClick={refreshWorkflows}
                  >
                    {ag.workflowRefresh}
                  </button>
                </div>
              </>
            )}

            {provider === 'pollinations' && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400 w-24 shrink-0">{ag.pollinationsModelLabel}</label>
                  <input
                    className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
                    placeholder={ag.pollinationsModelPlaceholder}
                    value={pollinationsModel}
                    onChange={e => setPollinationsModel(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400 w-24 shrink-0">{ag.pollinationsTokenLabel}</label>
                  <input
                    type="password"
                    className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
                    placeholder={ag.pollinationsTokenPlaceholder}
                    value={pollinationsToken}
                    onChange={e => setPollinationsToken(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Generation size */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 w-24 shrink-0">{ag.genSizeLabel}</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                <input
                  type="number"
                  min={0}
                  className="w-20 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
                  placeholder={ag.genWidthPlaceholder}
                  value={genWidth || ''}
                  onChange={e => setGenWidth(parseInt(e.target.value, 10) || 0)}
                />
                <span className="text-xs text-slate-500">×</span>
                <input
                  type="number"
                  min={0}
                  className="w-20 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
                  placeholder={ag.genHeightPlaceholder}
                  value={genHeight || ''}
                  onChange={e => setGenHeight(parseInt(e.target.value, 10) || 0)}
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
          </div>

          {/* ── Slots ── */}
          <div className="flex flex-col gap-3">
            {slots.map(slot => (
              <SlotPanel
                key={slot.slotId}
                slot={slot}
                projectDir={projectDir}
                llmEnabled={llmEnabled}
                onPromptChange={v => updateSlot(slot.slotId, { prompt: v })}
                onNegativePromptChange={v => updateSlot(slot.slotId, { negativePrompt: v })}
                onGenerate={() => generateForSlot(slot.slotId)}
                onCancel={() => cancelForSlot(slot.slotId)}
                onGeneratePrompt={() => generatePromptForSlot(slot.slotId)}
                onHistorySelect={src => updateSlot(slot.slotId, { currentSrc: src })}
                ag={ag}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-700 shrink-0 flex items-center justify-between">
          <button
            type="button"
            className="px-3 py-1.5 text-xs text-slate-300 hover:text-white rounded border border-slate-600 hover:border-slate-400 transition-colors cursor-pointer"
            onClick={onClose}
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            disabled={anyBusy || !hasPendingApprovals}
            className="px-4 py-1.5 text-xs text-white rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            onClick={approveAll}
          >
            {ag.approveAllBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SlotPanel ────────────────────────────────────────────────────────────────

function SlotPanel({
  slot,
  projectDir,
  llmEnabled,
  onPromptChange,
  onNegativePromptChange,
  onGenerate,
  onCancel,
  onGeneratePrompt,
  onHistorySelect,
  ag,
}: {
  slot: ModalSlotState;
  projectDir: string | null;
  llmEnabled: boolean;
  onPromptChange: (v: string) => void;
  onNegativePromptChange: (v: string) => void;
  onGenerate: () => void;
  onCancel: () => void;
  onGeneratePrompt: () => void;
  onHistorySelect: (src: string) => void;
  ag: ReturnType<typeof useT>['avatarGen'];
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const isApproved = slot.currentSrc.startsWith('assets/');
  const previewUrl = slot.currentSrc && projectDir
    ? toLocalFileUrl(resolveAssetPath(projectDir, slot.currentSrc))
    : '';

  return (
    <div className="flex flex-col gap-2 p-3 rounded border border-slate-700/60 bg-slate-900/30">
      {/* Slot header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-300">{slot.label}</span>
        {isApproved && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/50 border border-emerald-700 text-emerald-400">
            {ag.approvedBadge}
          </span>
        )}
      </div>

      {/* Prompt */}
      <div className="flex items-start gap-2">
        <label className="text-xs text-slate-400 w-16 shrink-0 pt-1.5">{ag.promptLabel}</label>
        <div className="flex-1 flex flex-col gap-1">
          <textarea
            className="w-full bg-slate-800 text-slate-200 text-xs rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500 min-h-[60px] resize-y"
            placeholder={ag.promptPlaceholder}
            value={slot.prompt}
            onChange={e => onPromptChange(e.target.value)}
          />
          {llmEnabled && (
            <button
              type="button"
              disabled={slot.busyPrompt}
              className="self-start px-2 py-0.5 text-[10px] rounded bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white cursor-pointer"
              onClick={onGeneratePrompt}
            >
              {slot.busyPrompt ? ag.generatingPrompt : ag.generatePromptBtn}
            </button>
          )}
        </div>
      </div>

      {/* Negative prompt */}
      <div className="flex items-start gap-2">
        <label className="text-xs text-slate-400 w-16 shrink-0 pt-1.5">{ag.negativePromptLabel}</label>
        <textarea
          className="flex-1 bg-slate-800 text-slate-200 text-xs rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500 min-h-[40px] resize-y"
          placeholder={ag.negativePromptPlaceholder}
          value={slot.negativePrompt}
          onChange={e => onNegativePromptChange(e.target.value)}
        />
      </div>

      {/* Generate button + progress */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={slot.busy}
          className="px-3 py-1 text-xs rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white cursor-pointer"
          onClick={onGenerate}
        >
          {slot.busy ? ag.generatingImage : ag.generateImageBtn}
        </button>
        {slot.busy && (
          <>
            <button
              type="button"
              className="px-2 py-1 text-xs rounded bg-slate-600 hover:bg-slate-500 text-white cursor-pointer"
              onClick={onCancel}
            >
              {ag.cancelBtn}
            </button>
            {slot.progress && (
              <span className="text-[10px] text-slate-400">
                {slot.progress.current}/{slot.progress.total}
              </span>
            )}
          </>
        )}
      </div>

      {/* History */}
      {slot.history.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 w-16 shrink-0">{ag.historyLabel}</label>
          <select
            className="flex-1 bg-slate-800 text-xs text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
            value={slot.currentSrc}
            onChange={e => onHistorySelect(e.target.value)}
          >
            <option value="">{ag.historyEmpty}</option>
            {[...slot.history].reverse().map(h => (
              <option key={h.id} value={h.src}>
                {new Date(h.createdAt).toLocaleString()} · {h.id.slice(0, 6)} · seed {h.seed}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Preview */}
      {previewUrl && (
        <>
          <img
            src={previewUrl}
            alt={slot.label}
            className="max-h-48 object-contain rounded border border-slate-700 cursor-zoom-in self-start"
            title={ag.doubleClickToExpand}
            onDoubleClick={() => setLightboxOpen(true)}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          {lightboxOpen && (
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80"
              onClick={() => setLightboxOpen(false)}
            >
              <img
                src={previewUrl}
                alt={slot.label}
                className="max-w-[90vw] max-h-[90vh] object-contain rounded shadow-2xl"
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
