import { useState, useEffect } from 'react';
import { useProjectStore, DEFAULT_PROJECT_SETTINGS } from '../../store/projectStore';
import { useEditorStore } from '../../store/editorStore';
import { useT } from '../../i18n';
import { fsApi, joinPath, safeName, toLocalFileUrl } from '../../lib/fsApi';
import { toast } from 'sonner';
import type { Project, ProjectSettings, SidebarPanel, SidebarTab, SidebarRow } from '../../types';

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

/**
 * Returns an updated sidebarPanel:
 * - If src is set: add/update the header row (at top of first tab, creating tab if needed)
 * - If src is null: remove the header row identified by rowId
 */
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
  const { project, projectDir, updateProjectMeta, loadProject } = useProjectStore();
  const { setProjectSettingsOpen } = useEditorStore();

  // ─── Form state ─────────────────────────────────────────────────────────────

  const [title, setTitle]               = useState(mode === 'edit' ? project.title : '');
  const [author, setAuthor]             = useState(mode === 'edit' ? (project.author ?? '') : '');
  const [description, setDescription]  = useState(mode === 'edit' ? (project.description ?? '') : '');
  const [lore, setLore]                 = useState(mode === 'edit' ? (project.lore ?? '') : '');

  // Header image
  const [headerPendingPath, setHeaderPendingPath] = useState<string | null>(null);
  const [headerPreviewUrl, setHeaderPreviewUrl]   = useState<string | null>(
    mode === 'edit' && project.settings.headerImageSrc && projectDir
      ? toLocalFileUrl(joinPath(projectDir, project.settings.headerImageSrc))
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

  // UI
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [advancedOpen,   setAdvancedOpen]   = useState(false);
  const [titleError,     setTitleError]     = useState<string | null>(null);
  const [busy,           setBusy]           = useState(false);

  // ─── Validate title live ─────────────────────────────────────────────────────

  useEffect(() => {
    if (title.trim()) setTitleError(null);
  }, [title]);

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
  };

  const handleRemoveHeaderImage = () => {
    setHeaderPendingPath(null);
    setHeaderPreviewUrl(null);
    setHeaderRemoved(true);
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

  // ─── Copy header image to assets/project/ ────────────────────────────────────

  async function copyHeaderImage(dir: string, filePath: string): Promise<string> {
    const fileName = filePath.replace(/.*[/\\]/, '');
    const destDir  = joinPath(dir, 'assets', 'project');
    await fsApi.mkdir(destDir);
    const destPath = joinPath(destDir, fileName);
    await fsApi.copyFile(filePath, destPath);
    return `assets/project/${fileName}`;  // relative path from project root
  }

  // ─── Save (edit mode) ────────────────────────────────────────────────────────

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) { setTitleError(ps.titleEmpty); return; }

    setBusy(true);
    try {
      let headerSrc: string | null = project.settings.headerImageSrc ?? null;
      const rowId: string | null     = project.settings.headerRowId     ?? null;

      if (headerRemoved) {
        headerSrc = null;
      } else if (headerPendingPath && projectDir) {
        headerSrc = await copyHeaderImage(projectDir, headerPendingPath);
      }

      const { panel: updatedPanel, rowId: newRowId } = applyHeaderImageToPanel(
        project.sidebarPanel,
        headerSrc,
        rowId,
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

      await fsApi.mkdir(joinPath(folder, 'assets'));

      let headerSrc: string | null = null;
      if (headerPendingPath) {
        headerSrc = await copyHeaderImage(folder, headerPendingPath);
      }

      // Build a fresh project
      const newProject: Project = {
        id:    crypto.randomUUID(),
        title: trimmedTitle,
        ifid:  (crypto.randomUUID()).toUpperCase(),
        author:      author.trim()      || undefined,
        description: description.trim() || undefined,
        lore:        lore.trim()        || undefined,
        settings:    buildSettings(null, null),  // rowId assigned below
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

      // Save the .purl file
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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-[480px] flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
          <h2 className="text-sm font-semibold text-white">
            {mode === 'create' ? ps.createTitle : ps.editTitle}
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
          </Field>

          {/* Header image */}
          <Field label={ps.fieldHeaderImage} note={ps.headerImageNote}>
            {hasHeaderImage ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <img
                    src={headerPreviewUrl!}
                    alt=""
                    className="h-14 rounded border border-slate-600 flex-shrink-0"
                    style={{ maxWidth: '200px', objectFit: headerObjectFit }}
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
