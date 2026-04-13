import { useState, useEffect, useRef } from 'react';
import { useProjectStore, DEFAULT_PROJECT_SETTINGS } from '../../store/projectStore';
import { useEditorStore } from '../../store/editorStore';
import { useEditorPrefsStore } from '../../store/editorPrefsStore';
import { useT } from '../../i18n';
import { fsApi, joinPath, safeName, toLocalFileUrl, resolveAssetPath } from '../../lib/fsApi';
import { toast } from 'sonner';
import type { Project, ProjectSettings, SidebarPanel, SidebarTab, SidebarRow } from '../../types';
import { AISettingsModal } from '../editor/LLMSettingsModal';
import { generateImageWithProvider, type ComfyProgress } from '../../utils/imageGen/providers';
import {
  expandDescriptionWithLlm,
  generateLoreFromDescriptionWithLlm,
  generateHeaderImagePromptWithLlm,
} from '../../utils/imageGen/llmPrompt';

// ─── Workflow file collector (mirrors ImageGenBlockEditor) ─────────────────────

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

// ─── Header image helpers ──────────────────────────────────────────────────────

function buildHeaderRow(rowId: string, src: string, objectFit: 'cover' | 'contain'): SidebarRow {
  return {
    id: rowId,
    height: 120,
    cells: [{
      id: crypto.randomUUID(),
      width: 100,
      content: { type: 'image-static', src, objectFit },
    }],
  };
}

function applyHeaderImageToPanel(
  panel: SidebarPanel,
  src: string | null,
  existingRowId: string | null,
  objectFit: 'cover' | 'contain',
): { panel: SidebarPanel; rowId: string | null } {
  if (!src) {
    if (!existingRowId) return { panel, rowId: null };
    const updatedTabs = panel.tabs.map(tab => ({
      ...tab,
      rows: tab.rows.filter(r => r.id !== existingRowId),
    }));
    return { panel: { ...panel, tabs: updatedTabs }, rowId: null };
  }

  const rowId = existingRowId ?? crypto.randomUUID();

  if (panel.tabs.length === 0) {
    const newTab: SidebarTab = {
      id: crypto.randomUUID(),
      label: '',
      rows: [buildHeaderRow(rowId, src, objectFit)],
    };
    return { panel: { ...panel, tabs: [newTab] }, rowId };
  }

  const firstTab = panel.tabs[0];

  if (existingRowId) {
    const rowExists = firstTab.rows.some(r => r.id === existingRowId);
    if (rowExists) {
      const updatedRows = firstTab.rows.map(r =>
        r.id === existingRowId ? buildHeaderRow(rowId, src, objectFit) : r
      );
      const updatedTabs = [{ ...firstTab, rows: updatedRows }, ...panel.tabs.slice(1)];
      return { panel: { ...panel, tabs: updatedTabs }, rowId };
    }
  }

  const updatedTabs = [
    { ...firstTab, rows: [buildHeaderRow(rowId, src, objectFit), ...firstTab.rows] },
    ...panel.tabs.slice(1),
  ];
  return { panel: { ...panel, tabs: updatedTabs }, rowId };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  mode: 'create' | 'edit';
  onClose: () => void;
}

export function ProjectSettingsModal({ mode, onClose }: Props) {
  const t = useT();
  const ps = t.projectSettings;
  const ig = t.imageGenBlock;
  const { project, projectDir, updateProjectMeta, loadProject } = useProjectStore();
  const { setProjectSettingsOpen } = useEditorStore();
  const {
    llmEnabled,
    llmProvider,
    llmUrl,
    llmGeminiApiKey,
    llmGeminiModel,
    llmOpenaiUrl,
    llmOpenaiApiKey,
    llmOpenaiModel,
    llmMaxTokens,
    llmTemperature,
    llmSystemPrompt,
    imageGenProvider,
    comfyUiUrl,
    comfyUiWorkflowsDir,
    pollinationsModel,
    pollinationsToken,
  } = useEditorPrefsStore();

  // ─── Form state ─────────────────────────────────────────────────────────────

  const [title, setTitle]               = useState(mode === 'edit' ? project.title : '');
  const [author, setAuthor]             = useState(mode === 'edit' ? (project.author ?? '') : '');
  const [description, setDescription]  = useState(mode === 'edit' ? (project.description ?? '') : '');
  const [lore, setLore]                 = useState(mode === 'edit' ? (project.lore ?? '') : '');

  // Header image
  const [headerPendingPath, setHeaderPendingPath] = useState<string | null>(null);
  const [headerPreviewUrl, setHeaderPreviewUrl]   = useState<string | null>(
    mode === 'edit' && project.settings.headerImageSrc && projectDir
      ? toLocalFileUrl(resolveAssetPath(projectDir, project.settings.headerImageSrc))
      : null
  );
  const [headerRemoved,    setHeaderRemoved]    = useState(false);
  const [headerObjectFit,  setHeaderObjectFit]  = useState<'cover' | 'contain'>(() => {
    if (mode === 'edit' && project.settings.headerRowId) {
      for (const tab of project.sidebarPanel.tabs) {
        const row = tab.rows.find(r => r.id === project.settings.headerRowId);
        if (row?.cells[0]?.content.type === 'image-static') {
          return (row.cells[0].content as { objectFit: 'cover' | 'contain' }).objectFit;
        }
      }
    }
    return 'cover';
  });

  // Generated image bytes (in-memory, no file written until save)
  const [headerGenBytes, setHeaderGenBytes] = useState<number[] | null>(null);
  const [headerGenExt,   setHeaderGenExt]   = useState('png');

  // Appearance
  const existing = mode === 'edit' ? project.settings : DEFAULT_PROJECT_SETTINGS;
  const [bgColor,      setBgColor]      = useState(existing.bgColor      ?? '');
  const [sidebarColor, setSidebarColor] = useState(existing.sidebarColor ?? '');
  const [titleColor,   setTitleColor]   = useState(existing.titleColor   ?? '');
  const [titleFont,    setTitleFont]    = useState(existing.titleFont     ?? '');

  // Advanced
  const [historyControls,  setHistoryControls]  = useState(existing.historyControls);
  const [saveLoadMenu,     setSaveLoadMenu]      = useState(existing.saveLoadMenu);
  const [audioUnlockText,  setAudioUnlockText]  = useState(existing.audioUnlockText ?? '');

  // UI sections
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [advancedOpen,   setAdvancedOpen]   = useState(false);
  const [aiImageOpen,    setAiImageOpen]    = useState(false);
  const [titleError,     setTitleError]     = useState<string | null>(null);
  const [busy,           setBusy]           = useState(false);

  // LLM settings modal
  const [llmSettingsOpen, setLlmSettingsOpen] = useState(false);

  // Image lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // AI busy states
  const [busyExpandDesc,   setBusyExpandDesc]   = useState(false);
  const [busyGenerateLore, setBusyGenerateLore] = useState(false);
  const [busyGenPrompt,    setBusyGenPrompt]    = useState(false);
  const [busyGenImage,     setBusyGenImage]     = useState(false);
  const [genProgress,      setGenProgress]      = useState<ComfyProgress | null>(null);

  // Abort refs
  const descAbortRef   = useRef<AbortController | null>(null);
  const loreAbortRef   = useRef<AbortController | null>(null);
  const promptAbortRef = useRef<AbortController | null>(null);
  const imgAbortRef    = useRef<AbortController | null>(null);

  // Image gen local state (workflow per-session; provider/URL from global store)
  const [imgWorkflowFile, setImgWorkflowFile] = useState('');
  const [imgPrompt,           setImgPrompt]           = useState('');
  const [imgNegativePrompt,   setImgNegativePrompt]   = useState('');
  const [imgWidth,            setImgWidth]            = useState(768);
  const [imgHeight,           setImgHeight]           = useState(512);
  const [imgSeedMode,         setImgSeedMode]         = useState<'random' | 'manual'>('random');
  const [imgSeed,             setImgSeed]             = useState(0);
  const [workflows,           setWorkflows]           = useState<string[]>([]);

  // ─── Validate title live ─────────────────────────────────────────────────────

  useEffect(() => {
    if (title.trim()) setTitleError(null);
  }, [title]);

  // ─── Load ComfyUI workflows when AI image section opens ──────────────────────

  useEffect(() => {
    if (!aiImageOpen || imageGenProvider !== 'comfyui') return;
    let alive = true;
    async function run() {
      const useGlobal = comfyUiWorkflowsDir.trim() !== '';
      const root = useGlobal ? comfyUiWorkflowsDir.trim() : (projectDir ? joinPath(projectDir, 'comfyUI_workflows') : null);
      const relPrefix = useGlobal ? '' : 'comfyUI_workflows';
      if (!root) return;
      if (!await fsApi.exists(root)) { if (alive) setWorkflows([]); return; }
      const list = await collectWorkflowFiles(root, relPrefix);
      if (alive) setWorkflows(list.sort((a, b) => a.localeCompare(b)));
    }
    run().catch(() => {});
    return () => { alive = false; };
  }, [aiImageOpen, imageGenProvider, projectDir, comfyUiWorkflowsDir]);

  const refreshImgWorkflows = async () => {
    const useGlobal = comfyUiWorkflowsDir.trim() !== '';
    const root = useGlobal ? comfyUiWorkflowsDir.trim() : (projectDir ? joinPath(projectDir, 'comfyUI_workflows') : null);
    const relPrefix = useGlobal ? '' : 'comfyUI_workflows';
    if (!root || !await fsApi.exists(root)) { setWorkflows([]); return; }
    const list = await collectWorkflowFiles(root, relPrefix);
    setWorkflows(list.sort((a, b) => a.localeCompare(b)));
  };

  // ─── LLM options helper ───────────────────────────────────────────────────────

  const getLlmOptions = () => ({
    provider:    llmProvider,
    urlOrApiKey: llmProvider === 'openai' ? llmOpenaiUrl : llmProvider === 'gemini' ? llmGeminiApiKey : llmUrl,
    apiKey:      llmProvider === 'openai' ? llmOpenaiApiKey : undefined,
    model:       llmProvider === 'openai' ? llmOpenaiModel : llmGeminiModel,
    maxTokens:   llmMaxTokens,
    temperature: llmTemperature,
    systemPrompt: llmSystemPrompt,
  });

  // ─── AI handlers ─────────────────────────────────────────────────────────────

  const handleExpandDescription = async () => {
    if (!llmEnabled || busyExpandDesc) return;
    setBusyExpandDesc(true);
    const ctrl = new AbortController();
    descAbortRef.current = ctrl;
    try {
      const result = await expandDescriptionWithLlm(getLlmOptions(), project, description, lore, ctrl.signal);
      if (result) setDescription(result);
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error(ps.aiExpandError);
    } finally {
      descAbortRef.current = null;
      setBusyExpandDesc(false);
    }
  };

  const handleGenerateLore = async () => {
    if (!llmEnabled || busyGenerateLore) return;
    setBusyGenerateLore(true);
    const ctrl = new AbortController();
    loreAbortRef.current = ctrl;
    try {
      const result = await generateLoreFromDescriptionWithLlm(getLlmOptions(), project, description, lore, ctrl.signal);
      if (result) setLore(result);
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error(ps.aiLoreError);
    } finally {
      loreAbortRef.current = null;
      setBusyGenerateLore(false);
    }
  };

  const handleGeneratePrompt = async () => {
    if (!llmEnabled || busyGenPrompt) return;
    setBusyGenPrompt(true);
    const ctrl = new AbortController();
    promptAbortRef.current = ctrl;
    try {
      const result = await generateHeaderImagePromptWithLlm(getLlmOptions(), project, description, lore, imgPrompt, ctrl.signal);
      if (result) setImgPrompt(result);
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error(ps.aiImageError);
    } finally {
      promptAbortRef.current = null;
      setBusyGenPrompt(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!imgPrompt.trim()) return toast.error(ps.aiImageErrorNoPrompt);
    if (imageGenProvider === 'comfyui' && !imgWorkflowFile) return toast.error(ig.errorNoWorkflow);

    const ctrl = new AbortController();
    imgAbortRef.current = ctrl;
    setBusyGenImage(true);
    setGenProgress(null);
    try {
      let workflowJson = {};
      if (imageGenProvider === 'comfyui' && imgWorkflowFile) {
        const useGlobal = comfyUiWorkflowsDir.trim() !== '';
        const wfPath = useGlobal
          ? joinPath(comfyUiWorkflowsDir.trim(), imgWorkflowFile)
          : joinPath(projectDir!, imgWorkflowFile);
        workflowJson = JSON.parse(await fsApi.readFile(wfPath));
      }

      const usedSeed = imgSeedMode === 'random' ? Math.floor(Math.random() * 4294967295) : imgSeed;
      if (imgSeedMode === 'random') setImgSeed(usedSeed);

      const generated = await generateImageWithProvider(imageGenProvider, {
        baseUrl:           comfyUiUrl,
        workflow:          workflowJson,
        prompt:            imgPrompt,
        negativePrompt:    imgNegativePrompt,
        seed:              usedSeed,
        pollinationsModel: pollinationsModel || undefined,
        pollinationsToken: pollinationsToken || undefined,
        genWidth:          imgWidth,
        genHeight:         imgHeight,
        onProgress:        imageGenProvider === 'comfyui' ? setGenProgress : undefined,
      }, ctrl.signal);

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

      setHeaderGenBytes(bytes);
      setHeaderGenExt(ext);

      const blob = new Blob([new Uint8Array(bytes)], { type: `image/${ext}` });
      const blobUrl = URL.createObjectURL(blob);
      setHeaderPreviewUrl(blobUrl);
      setHeaderRemoved(false);
      setHeaderPendingPath(null);
    } catch (err: any) {
      if (err?.name !== 'AbortError') toast.error(ps.aiImageError);
    } finally {
      imgAbortRef.current = null;
      setBusyGenImage(false);
      setGenProgress(null);
    }
  };

  const handleRemoveGeneratedImage = () => {
    setHeaderGenBytes(null);
    setHeaderPreviewUrl(null);
  };

  // ─── Header image picker ─────────────────────────────────────────────────────

  const handlePickHeaderImage = async () => {
    const filePath = await fsApi.openFileDialog({
      title: ps.fieldHeaderImage,
      filters: [{ name: t.assets.filterImages, extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] }],
    });
    if (!filePath) return;
    setHeaderPendingPath(filePath);
    setHeaderPreviewUrl(toLocalFileUrl(filePath));
    setHeaderRemoved(false);
    setHeaderGenBytes(null);
  };

  const handleRemoveHeaderImage = () => {
    setHeaderPendingPath(null);
    setHeaderPreviewUrl(null);
    setHeaderRemoved(true);
    setHeaderGenBytes(null);
  };

  // ─── Build final settings object ─────────────────────────────────────────────

  function buildSettings(headerSrc: string | null, rowId: string | null): ProjectSettings {
    const s: ProjectSettings = {
      historyControls,
      saveLoadMenu,
    };
    if (bgColor.trim())      s.bgColor      = bgColor.trim();
    if (sidebarColor.trim()) s.sidebarColor = sidebarColor.trim();
    if (titleColor.trim())   s.titleColor   = titleColor.trim();
    if (titleFont.trim())    s.titleFont    = titleFont.trim();
    if (headerSrc)                    s.headerImageSrc   = headerSrc;
    if (rowId)                        s.headerRowId      = rowId;
    if (audioUnlockText.trim())       s.audioUnlockText  = audioUnlockText.trim();
    return s;
  }

  // ─── Copy / write header image ────────────────────────────────────────────────

  async function copyHeaderImage(dir: string, filePath: string): Promise<string> {
    const fileName = filePath.replace(/.*[/\\]/, '');
    const destDir  = joinPath(dir, 'release', 'assets', 'project');
    await fsApi.mkdir(destDir);
    const destPath = joinPath(destDir, fileName);
    await fsApi.copyFile(filePath, destPath);
    return `assets/project/${fileName}`;
  }

  async function writeHeaderImageBytes(dir: string, bytes: number[], ext: string): Promise<string> {
    const fileName = `header-${Date.now()}.${ext}`;
    const destDir  = joinPath(dir, 'release', 'assets', 'project');
    await fsApi.mkdir(destDir);
    const destPath = joinPath(destDir, fileName);
    await fsApi.writeFileBinary(destPath, bytes);
    return `assets/project/${fileName}`;
  }

  // ─── Resolve header source on save ───────────────────────────────────────────

  async function resolveHeaderSrc(dir: string, existingSrc: string | null): Promise<string | null> {
    if (headerRemoved) return null;
    if (headerGenBytes && headerGenBytes.length > 0) return writeHeaderImageBytes(dir, headerGenBytes, headerGenExt);
    if (headerPendingPath) return copyHeaderImage(dir, headerPendingPath);
    return existingSrc;
  }

  // ─── Save (edit mode) ────────────────────────────────────────────────────────

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) { setTitleError(ps.titleEmpty); return; }

    setBusy(true);
    try {
      const headerSrc = await resolveHeaderSrc(
        projectDir!,
        project.settings.headerImageSrc ?? null,
      );
      const existingRowId = project.settings.headerRowId ?? null;

      const { panel: updatedPanel, rowId: newRowId } = applyHeaderImageToPanel(
        project.sidebarPanel,
        headerSrc,
        existingRowId,
        headerObjectFit,
      );

      updateProjectMeta({
        title:       trimmedTitle,
        author:      author.trim() || undefined,
        description: description.trim() || undefined,
        lore:        lore.trim() || undefined,
        settings:    buildSettings(headerSrc, newRowId),
        sidebarPanel: updatedPanel,
      });

      setProjectSettingsOpen(false);
      onClose();
      toast.success(t.projectSettings.successSave);
    } catch (e) {
      alert(String(e));
    } finally {
      setBusy(false);
    }
  };

  // ─── Create (create mode) ────────────────────────────────────────────────────

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) { setTitleError(ps.titleEmpty); return; }

    setBusy(true);
    try {
      const folder = await fsApi.openFolderDialog();
      if (!folder) { setBusy(false); return; }

      await fsApi.mkdir(joinPath(folder, 'release', 'assets'));

      const headerSrc = await resolveHeaderSrc(folder, null);

      const newProject: Project = {
        id:    crypto.randomUUID(),
        title: trimmedTitle,
        ifid:  (crypto.randomUUID()).toUpperCase(),
        author:      author.trim()      || undefined,
        description: description.trim() || undefined,
        lore:        lore.trim()        || undefined,
        settings:    buildSettings(null, null),
        scenes:      [{ id: crypto.randomUUID(), name: 'Start', tags: ['start'], blocks: [] }],
        sceneGroups:  [],
        characters:   [],
        variableNodes: [],
        assetNodes:   [],
        sidebarPanel: { tabs: [], liveUpdate: false, style: { rowGap: 2, borderWidth: 1, borderColor: '#555555', showOuterBorder: false, showRowBorders: false, showCellBorders: false } } as SidebarPanel,
        watchers:     [],
      };

      const { panel: updatedPanel, rowId } = applyHeaderImageToPanel(
        newProject.sidebarPanel,
        headerSrc,
        null,
        headerObjectFit,
      );

      newProject.sidebarPanel = updatedPanel;
      newProject.settings     = buildSettings(headerSrc, rowId);

      const fileName = `${safeName(trimmedTitle)}.purl`;
      await fsApi.writeFile(joinPath(folder, fileName), JSON.stringify(newProject, null, 2));

      loadProject(newProject, folder);
      setProjectSettingsOpen(false);
      onClose();
      toast.success(t.projectSettings.successCreate);
    } catch (e) {
      alert(String(e));
    } finally {
      setBusy(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const hasHeaderImage = headerPreviewUrl && !headerRemoved;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop — no onClick to prevent accidental close */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Modal */}
      <div className="relative bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-[520px] flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
          <h2 className="text-sm font-semibold text-white">
            {mode === 'create' ? ps.createTitle : ps.editTitle}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLlmSettingsOpen(true)}
              className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-600"
            >
              ⚙ {ps.aiLlmSettingsBtn}
            </button>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-white transition-colors cursor-pointer text-base leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-4">

          {/* Title */}
          <Field label={ps.fieldTitle} required>
            <input
              autoFocus
              className={`w-full bg-slate-700 text-xs text-white rounded px-2 py-1.5 outline-none border ${titleError ? 'border-red-500' : 'border-slate-600 focus:border-indigo-500'}`}
              placeholder={ps.fieldTitlePlaceholder}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { if (mode === 'create') handleCreate(); else handleSave(); } }}
            />
            {titleError && <span className="text-xs text-red-400">{titleError}</span>}
          </Field>

          {/* Author */}
          <Field label={ps.fieldAuthor}>
            <input
              className="w-full bg-slate-700 text-xs text-white rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500"
              placeholder={ps.fieldAuthorPlaceholder}
              value={author}
              onChange={e => setAuthor(e.target.value)}
            />
          </Field>

          {/* Description */}
          <Field label={ps.fieldDescription}>
            <textarea
              className="w-full bg-slate-700 text-xs text-slate-200 rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500 resize-none placeholder-slate-500"
              rows={2}
              placeholder={ps.fieldDescPlaceholder}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
            <button
              type="button"
              disabled={busyExpandDesc || !llmEnabled}
              onClick={handleExpandDescription}
              className="self-start text-xs px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors border border-slate-600"
            >
              {busyExpandDesc ? ps.aiExpandDescBusy : ps.aiExpandDesc}
            </button>
          </Field>

          {/* Lore */}
          <Field label="Lore / Story Context" note="Extra context for LLM generation">
            <textarea
              className="w-full bg-slate-700 text-xs text-slate-200 rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500 resize-none placeholder-slate-500"
              rows={3}
              placeholder="Describe the world, plot, and key facts..."
              value={lore}
              onChange={e => setLore(e.target.value)}
            />
            <button
              type="button"
              disabled={busyGenerateLore || !llmEnabled || !description.trim()}
              onClick={handleGenerateLore}
              className="self-start text-xs px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors border border-slate-600"
            >
              {busyGenerateLore ? ps.aiGenerateLoreBusy : ps.aiGenerateLore}
            </button>
          </Field>

          {/* Header image */}
          <Field label={ps.fieldHeaderImage} note={ps.headerImageNote}>
            {hasHeaderImage ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <img
                    src={headerPreviewUrl!}
                    alt=""
                    className="h-14 rounded border border-slate-600 flex-shrink-0 cursor-zoom-in"
                    style={{ maxWidth: '200px', objectFit: headerObjectFit }}
                    onDoubleClick={() => setLightboxOpen(true)}
                    title={t.imageGenBlock.doubleClickToExpand}
                  />
                  <div className="flex flex-col gap-1">
                    <button
                      className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                      onClick={handlePickHeaderImage}
                    >
                      {ps.headerImageChange}
                    </button>
                    <button
                      className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
                      onClick={handleRemoveHeaderImage}
                    >
                      {ps.headerImageRemove}
                    </button>
                  </div>
                </div>
                {/* objectFit selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{t.cellModal.objectFit}:</span>
                  <div className="flex gap-1">
                    {(['cover', 'contain'] as const).map(fit => (
                      <button
                        key={fit}
                        onClick={() => setHeaderObjectFit(fit)}
                        className={`px-2 py-0.5 rounded text-xs cursor-pointer transition-colors border ${
                          headerObjectFit === fit
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {fit === 'cover' ? t.cellModal.fitCover : t.cellModal.fitContain}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <button
                className="text-xs text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded border border-slate-600 hover:border-indigo-500 transition-colors cursor-pointer"
                onClick={handlePickHeaderImage}
              >
                {ps.headerImageAdd}
              </button>
            )}
          </Field>

          {/* ── AI Header Image section ──────────────────────────────────────── */}
          <CollapsibleSection
            title={ps.sectionAiImage}
            open={aiImageOpen}
            onToggle={() => setAiImageOpen(v => !v)}
          >
            <div className="flex flex-col gap-3 pt-1">

              {imageGenProvider === 'comfyui' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400 w-24 shrink-0">{ig.workflowLabel}</label>
                  <select
                    className="flex-1 bg-slate-700 text-xs text-white rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
                    value={imgWorkflowFile}
                    onChange={e => setImgWorkflowFile(e.target.value)}
                  >
                    <option value="">{ig.workflowNone}</option>
                    {workflows.map(wf => <option key={wf} value={wf}>{wf}</option>)}
                  </select>
                  <button
                    type="button"
                    className="px-2 py-1.5 text-xs rounded bg-slate-600 hover:bg-slate-500 text-slate-200 cursor-pointer"
                    onClick={refreshImgWorkflows}
                  >
                    {ig.workflowRefresh}
                  </button>
                </div>
              )}

              {/* Prompt */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{ig.promptLabel}</label>
                <textarea
                  className="w-full bg-slate-700 text-xs text-slate-200 rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500 resize-none placeholder-slate-500"
                  rows={3}
                  placeholder={ig.promptPlaceholder}
                  value={imgPrompt}
                  onChange={e => setImgPrompt(e.target.value)}
                />
                <button
                  type="button"
                  disabled={busyGenPrompt || !llmEnabled}
                  onClick={handleGeneratePrompt}
                  className="self-start text-xs px-2.5 py-1 rounded bg-slate-600 hover:bg-slate-500 text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors border border-slate-600"
                >
                  {busyGenPrompt ? ps.aiGeneratePromptBusy : ps.aiGeneratePrompt}
                </button>
              </div>

              {/* Negative prompt */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{ig.negativePromptLabel}</label>
                <textarea
                  className="w-full bg-slate-700 text-xs text-slate-200 rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500 resize-none placeholder-slate-500"
                  rows={2}
                  placeholder={ig.negativePromptPlaceholder}
                  value={imgNegativePrompt}
                  onChange={e => setImgNegativePrompt(e.target.value)}
                />
              </div>

              {/* Width × Height */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 w-24 shrink-0">{ig.genSizeLabel}</label>
                <input
                  type="number" min={0}
                  className="w-20 bg-slate-700 text-xs text-white rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500"
                  placeholder={ig.genWidthPlaceholder}
                  value={imgWidth || ''}
                  onChange={e => setImgWidth(parseInt(e.target.value, 10) || 0)}
                />
                <span className="text-xs text-slate-500">×</span>
                <input
                  type="number" min={0}
                  className="w-20 bg-slate-700 text-xs text-white rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500"
                  placeholder={ig.genHeightPlaceholder}
                  value={imgHeight || ''}
                  onChange={e => setImgHeight(parseInt(e.target.value, 10) || 0)}
                />
              </div>

              {/* Seed mode */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 w-24 shrink-0">{ig.seedModeLabel}</label>
                <div className="flex gap-1">
                  {(['random', 'manual'] as const).map(smode => (
                    <button
                      key={smode}
                      type="button"
                      onClick={() => setImgSeedMode(smode)}
                      className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                        imgSeedMode === smode ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {smode === 'random' ? ig.seedModeRandom : ig.seedModeManual}
                    </button>
                  ))}
                </div>
              </div>

              {imgSeedMode === 'manual' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400 w-24 shrink-0">{ig.seedLabel}</label>
                  <input
                    type="number" min={0} max={4294967295}
                    className="w-32 bg-slate-700 text-xs text-white rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500"
                    placeholder={ig.seedPlaceholder}
                    value={imgSeed}
                    onChange={e => setImgSeed(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
              )}

              {/* Generate button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busyGenImage}
                  className="px-3 py-1.5 text-xs rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white cursor-pointer"
                  onClick={handleGenerateImage}
                >
                  {busyGenImage ? ig.generatingImage : ig.generateImage}
                </button>
                {busyGenImage && (
                  <button
                    type="button"
                    className="px-3 py-1.5 text-xs rounded bg-slate-600 hover:bg-slate-500 text-white cursor-pointer"
                    onClick={() => imgAbortRef.current?.abort()}
                  >
                    {ig.cancelGeneration}
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {busyGenImage && (
                <div className="w-full h-1 rounded-full bg-slate-700 overflow-hidden">
                  {genProgress ? (
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.round((genProgress.current / genProgress.total) * 100)}%` }}
                    />
                  ) : (
                    <div className="h-full w-full bg-emerald-500/40 animate-pulse" />
                  )}
                </div>
              )}

              {/* Generated image confirmation */}
              {headerGenBytes && !headerRemoved && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-emerald-400">✓ {ps.aiImageReady}</span>
                  <button
                    type="button"
                    onClick={handleRemoveGeneratedImage}
                    className="text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    {ps.aiImageRemove}
                  </button>
                </div>
              )}

              {!llmEnabled && (
                <p className="text-xs text-slate-500">{ps.aiLlmDisabledHint}</p>
              )}
            </div>
          </CollapsibleSection>

          {/* ── Appearance section ──────────────────────────────────────────── */}
          <CollapsibleSection
            title={ps.sectionAppearance}
            open={appearanceOpen}
            onToggle={() => setAppearanceOpen(v => !v)}
          >
            <div className="flex flex-col gap-3 pt-1">
              <ColorField label={ps.fieldBgColor}      value={bgColor}      onChange={setBgColor} />
              <ColorField label={ps.fieldSidebarColor} value={sidebarColor} onChange={setSidebarColor} />
              <ColorField label={ps.fieldTitleColor}   value={titleColor}   onChange={setTitleColor} />

              <Field label={ps.fieldTitleFont}>
                <input
                  className="w-full bg-slate-700 text-xs text-white rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500"
                  placeholder={ps.fieldTitleFontPlaceholder}
                  value={titleFont}
                  onChange={e => setTitleFont(e.target.value)}
                />
              </Field>
            </div>
          </CollapsibleSection>

          {/* ── Advanced section ────────────────────────────────────────────── */}
          <CollapsibleSection
            title={ps.sectionAdvanced}
            open={advancedOpen}
            onToggle={() => setAdvancedOpen(v => !v)}
          >
            <div className="flex flex-col gap-3 pt-1">
              <ToggleField label={ps.fieldHistoryControls} value={historyControls} onChange={setHistoryControls} />
              <ToggleField label={ps.fieldSaveLoadMenu}    value={saveLoadMenu}    onChange={setSaveLoadMenu} />

              <Field label={ps.fieldAudioUnlockText}>
                <input
                  className="w-full bg-slate-700 text-xs text-white rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500"
                  placeholder={ps.fieldAudioUnlockTextPlaceholder}
                  value={audioUnlockText}
                  onChange={e => setAudioUnlockText(e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-1">{ps.fieldAudioUnlockTextNote}</p>
              </Field>
            </div>
          </CollapsibleSection>

        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-700 shrink-0 flex gap-2">
          <button
            className="flex-1 py-1.5 text-xs rounded transition-colors cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-200"
            onClick={onClose}
          >
            {t.common.cancel}
          </button>
          <button
            className="flex-1 py-1.5 text-xs rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-500 text-white"
            onClick={mode === 'create' ? handleCreate : handleSave}
            disabled={busy}
          >
            {busy ? '...' : (mode === 'create' ? `${ps.create} →` : ps.save)}
          </button>
        </div>
      </div>

      {/* Image lightbox */}
      {lightboxOpen && headerPreviewUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80"
          onClick={() => setLightboxOpen(false)}
        >
          <img
            src={headerPreviewUrl}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* LLM Settings modal — renders on top (later in DOM, same z-index) */}
      {llmSettingsOpen && (
        <AISettingsModal onClose={() => setLlmSettingsOpen(false)} />
      )}
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Field({ label, required, note, children }: {
  label: string;
  required?: boolean;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {note && <span className="text-xs text-slate-500 -mt-0.5">{note}</span>}
      {children}
    </div>
  );
}

function ColorField({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-400 flex-1">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value || '#1e293b'}
          onChange={e => onChange(e.target.value)}
          className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0"
          title={label}
        />
        <input
          className="w-24 bg-slate-700 text-xs text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="—"
        />
        {value && (
          <button
            className="text-slate-500 hover:text-slate-300 cursor-pointer text-xs leading-none"
            onClick={() => onChange('')}
            title="Clear"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function ToggleField({ label, value, onChange }: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-300">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          value ? 'bg-indigo-600' : 'bg-slate-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function CollapsibleSection({ title, open, onToggle, children }: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-slate-700 rounded">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        {title}
        <span className="text-slate-500 text-sm">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}
