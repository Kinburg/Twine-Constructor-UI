import { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useEditorStore } from '../../store/editorStore';
import { useT, useLocaleStore, getLocales } from '../../i18n';
import { generateStandaloneHtml } from '../../utils/exportToHtml';
import {
  hasSCTemplate, getSCTemplate, getSCVersion,
  parseSCFormatJs, storeSCTemplate, clearSCTemplate,
} from '../../utils/scRuntime';
import { fsApi, joinPath, safeName } from '../../lib/fsApi';

export function Header() {
  const {
    project, projectDir,
    setProjectTitle, setProjectDir, resetProject, loadProject,
    undo, redo, canUndo, canRedo,
  } = useProjectStore();
  const { locale, setLocale } = useLocaleStore();
  const { searchQuery, setSearchQuery } = useEditorStore();
  const t = useT();

  const [editingTitle, setEditingTitle]     = useState(false);
  const [titleDraft, setTitleDraft]         = useState('');
  const [scReady, setScReady]               = useState(hasSCTemplate());
  const [scVersion, setScVersion]           = useState(getSCVersion());
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [saveMenuOpen, setSaveMenuOpen]     = useState(false);
  const [busy, setBusy]                     = useState(false);
  const [previewOpen, setPreviewOpen]       = useState(false);
  const [graphOpen, setGraphOpen]           = useState(false);

  useEffect(() => {
    setScReady(hasSCTemplate());
    setScVersion(getSCVersion());
  }, []);

  // Sync button state when user closes the preview window via its × button
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onPreviewClosed) return;
    api.onPreviewClosed(() => setPreviewOpen(false));
  }, []);

  // Sync button state when user closes the graph window via its × button
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onGraphClosed) return;
    api.onGraphClosed(() => setGraphOpen(false));
  }, []);

  // ─── Title ────────────────────────────────────────────────────────────────

  const handleTitleClick = () => {
    setTitleDraft(project.title);
    setEditingTitle(true);
  };

  const handleTitleBlur = () => {
    const newTitle = titleDraft.trim();
    if (!newTitle || newTitle === project.title) { setEditingTitle(false); return; }
    setProjectTitle(newTitle);
    setEditingTitle(false);
  };

  // ─── Save helpers ─────────────────────────────────────────────────────────

  async function doSaveToDir(dir: string): Promise<void> {
    await fsApi.mkdir(joinPath(dir, 'assets'));
    const content = JSON.stringify(project, null, 2);
    await fsApi.writeFile(joinPath(dir, 'project.tgproject'), content);
  }

  async function ensureProjectDir(): Promise<string | null> {
    if (projectDir) {
      await fsApi.mkdir(joinPath(projectDir, 'assets'));
      return projectDir;
    }
    const folder = await fsApi.openFolderDialog();
    if (!folder) return null;
    setProjectDir(folder);
    await fsApi.mkdir(joinPath(folder, 'assets'));
    return folder;
  }

  // ─── Save / Open ──────────────────────────────────────────────────────────

  const handleSaveProject = async () => {
    setSaveMenuOpen(false);
    setBusy(true);
    try {
      let dir = projectDir;
      if (!dir) {
        dir = await fsApi.openFolderDialog();
        if (!dir) return;
        setProjectDir(dir);
      }
      await doSaveToDir(dir);
    } catch (e) {
      alert(t.header.errorSave(String(e)));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProjectAs = async () => {
    setSaveMenuOpen(false);
    const dir = await fsApi.openFolderDialog();
    if (!dir) return;
    setBusy(true);
    try {
      setProjectDir(dir);
      await doSaveToDir(dir);
    } catch (e) {
      alert(t.header.errorSave(String(e)));
    } finally {
      setBusy(false);
    }
  };

  const handleOpenProject = async () => {
    const filePath = await fsApi.openFileDialog({
      title: t.header.open,
      filters: [{ name: 'TwineConstructor Project', extensions: ['tgproject', 'json'] }],
    });
    if (!filePath) return;
    try {
      const text   = await fsApi.readFile(filePath);
      const loaded = JSON.parse(text);
      const dir = filePath.replace(/[/\\][^/\\]+$/, '');
      loadProject(loaded, dir);
    } catch {
      alert(t.header.errorInvalidProject);
    }
  };

  const handleNewProject = async () => {
    if (!confirm(t.header.confirmNew)) return;
    const folder = await fsApi.openFolderDialog();
    resetProject();
    if (folder) setProjectDir(folder);
  };

  const handleOpenProjectFolder = async () => {
    if (projectDir) await fsApi.openPath(projectDir);
  };

  // ─── Code preview window ──────────────────────────────────────────────────

  const handleTogglePreview = async () => {
    const api = window.electronAPI;
    if (!api?.togglePreview) return;
    const isNowOpen = await api.togglePreview();
    setPreviewOpen(isNowOpen);
  };

  const handleToggleGraph = async () => {
    const api = window.electronAPI;
    if (!api?.toggleGraph) return;
    const isNowOpen = await api.toggleGraph();
    setGraphOpen(isNowOpen);
  };

  // ─── SC Runtime ───────────────────────────────────────────────────────────

  const handleLoadSCFormat = async () => {
    const filePath = await fsApi.openFileDialog({
      title: t.header.dialogSelectSC,
      filters: [{ name: 'JavaScript', extensions: ['js'] }],
    });
    if (!filePath) return;
    try {
      const text   = await fsApi.readFile(filePath);
      const result = parseSCFormatJs(text);
      if (!result) {
        alert(t.header.errorInvalidSC);
        return;
      }
      storeSCTemplate(result.source, result.version);
      setScReady(true);
      setScVersion(result.version);
      alert(t.header.scLoadedAlert(result.version));
    } catch (e) {
      alert(t.header.errorReadFile(String(e)));
    }
  };

  const handleClearSC = () => {
    if (!confirm(t.header.confirmClearSC)) return;
    clearSCTemplate();
    setScReady(false);
    setScVersion(null);
  };

  // ─── Export ───────────────────────────────────────────────────────────────

  const handleExportHtml = async () => {
    const template = getSCTemplate();
    if (!template) return;
    setBusy(true);
    setExportMenuOpen(false);
    try {
      const dir = await ensureProjectDir();
      if (!dir) return;
      const html = generateStandaloneHtml(project, template);
      await fsApi.writeFile(joinPath(dir, 'index.html'), html);
      if (confirm(t.header.confirmHtmlSaved)) {
        await fsApi.openPath(dir);
      }
    } catch (e) {
      alert(t.header.errorExportHtml(String(e)));
    } finally {
      setBusy(false);
    }
  };

  const handleExportHtmlAs = async () => {
    const template = getSCTemplate();
    if (!template) return;
    setExportMenuOpen(false);
    const defaultName = `${safeName(project.title)}.html`;
    const defaultPath = projectDir ? joinPath(projectDir, defaultName) : defaultName;
    const filePath = await fsApi.saveFileDialog({
      title: t.header.dialogSaveHtml,
      defaultPath,
      filters: [{ name: 'HTML File', extensions: ['html'] }],
    });
    if (!filePath) return;
    setBusy(true);
    try {
      const html = generateStandaloneHtml(project, template);
      await fsApi.writeFile(filePath, html);
    } catch (e) {
      alert(t.header.errorExportHtml(String(e)));
    } finally {
      setBusy(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const locales = getLocales();

  return (
    <header className="flex items-center px-4 py-2 bg-slate-900 border-b border-slate-700 shrink-0 gap-4">
      {/* Left: logo + title */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-indigo-400 font-bold text-sm tracking-wider uppercase select-none">
          Twine Constructor
        </span>
        <span className="text-slate-600 select-none">|</span>
        {editingTitle ? (
          <input
            autoFocus
            className="bg-slate-800 text-white px-2 py-0.5 rounded text-sm border border-indigo-500 outline-none w-48"
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => {
              if (e.key === 'Enter') handleTitleBlur();
              if (e.key === 'Escape') setEditingTitle(false);
            }}
          />
        ) : (
          <button
            className="text-white text-sm font-medium hover:text-indigo-300 transition-colors cursor-pointer"
            onClick={handleTitleClick}
            title={t.header.renameProjectTitle}
          >
            {project.title}
          </button>
        )}

        {projectDir && (
          <span
            className="text-xs text-slate-500 hover:text-slate-400 cursor-pointer transition-colors"
            title={projectDir}
            onClick={handleOpenProjectFolder}
          >
            📁
          </span>
        )}
      </div>

      {/* Center: undo/redo + search */}
      <div className="flex-1 flex items-center justify-center gap-2">
        {/* Undo / Redo buttons */}
        <button
          className="text-slate-400 hover:text-white disabled:text-slate-700 disabled:cursor-not-allowed transition-colors cursor-pointer text-base leading-none px-1"
          title={t.header.undoTitle}
          onClick={undo}
          disabled={!canUndo}
        >
          ↩
        </button>
        <button
          className="text-slate-400 hover:text-white disabled:text-slate-700 disabled:cursor-not-allowed transition-colors cursor-pointer text-base leading-none px-1"
          title={t.header.redoTitle}
          onClick={redo}
          disabled={!canRedo}
        >
          ↪
        </button>

        <div className="relative w-full max-w-xs">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none select-none">
            🔍
          </span>
          <input
            className="w-full bg-slate-800 text-white text-xs pl-7 pr-6 py-1.5 rounded border border-slate-600 outline-none focus:border-indigo-500 placeholder-slate-500 transition-colors"
            placeholder={t.header.searchPlaceholder}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 cursor-pointer text-sm leading-none"
              onClick={() => setSearchQuery('')}
              title={t.header.clearSearch}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">

        {/* Code preview window toggle */}
        {window.electronAPI?.togglePreview && (
          <button
            className={`px-2.5 py-1.5 rounded text-sm font-mono font-medium transition-colors cursor-pointer whitespace-nowrap ${
              previewOpen
                ? 'bg-indigo-700 hover:bg-indigo-600 text-indigo-100'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            }`}
            onClick={handleTogglePreview}
            title={previewOpen ? t.header.previewCodeClose : t.header.previewCodeTitle}
          >
            {t.header.previewCode}
          </button>
        )}

        {/* Scene graph window toggle */}
        {window.electronAPI?.toggleGraph && (
          <button
            className={`px-2.5 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
              graphOpen
                ? 'bg-violet-700 hover:bg-violet-600 text-violet-100'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            }`}
            onClick={handleToggleGraph}
            title={graphOpen ? t.header.graphClose : t.header.graphTitle}
          >
            {t.header.graph}
          </button>
        )}

        <span className="text-slate-700 select-none hidden sm:inline">|</span>

        {/* Language selector */}
        {locales.length > 1 && (
          <select
            value={locale}
            onChange={e => setLocale(e.target.value)}
            title={t.header.language}
            className="bg-slate-800 text-slate-300 text-xs rounded px-2 py-1.5 border border-slate-600 outline-none cursor-pointer hover:border-slate-500 transition-colors"
          >
            {locales.map(l => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
        )}

        <span className="text-slate-700 select-none hidden sm:inline">|</span>

        {/* Open / New */}
        <Btn variant="ghost" onClick={handleOpenProject} title={t.header.openTitle} disabled={busy}>
          {t.header.open}
        </Btn>
        <Btn variant="ghost" onClick={handleNewProject} disabled={busy}>
          {t.header.new}
        </Btn>

        {/* Save — split button */}
        <div className="relative">
          <div className="flex">
            <button
              className="px-3 py-1.5 rounded-l text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              onClick={handleSaveProject}
              title={projectDir ? t.header.saveTitle(projectDir) : t.header.saveNoDir}
              disabled={busy}
            >
              {busy ? t.header.saving : t.header.save}
            </button>
            <button
              className="px-2 py-1.5 rounded-r text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer border-l border-slate-600"
              onClick={() => setSaveMenuOpen(v => !v)}
              title={t.header.saveMoreOptions}
            >
              ▾
            </button>
          </div>

          {saveMenuOpen && (
            <div className="absolute left-0 top-full mt-1 bg-slate-800 border border-slate-600 rounded shadow-xl z-50 min-w-56">
              <button
                className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
                onClick={handleSaveProjectAs}
              >
                <div className="font-medium">{t.header.saveAsFolder}</div>
                <div className="text-xs text-slate-400 mt-0.5">{t.header.saveAsFolderDesc}</div>
              </button>
              {projectDir && (
                <>
                  <div className="border-t border-slate-700" />
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
                    onClick={() => { setSaveMenuOpen(false); handleOpenProjectFolder(); }}
                  >
                    <div className="font-medium">{t.header.openFolder}</div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{projectDir}</div>
                  </button>
                </>
              )}
            </div>
          )}

          {saveMenuOpen && (
            <div className="fixed inset-0 z-40" onClick={() => setSaveMenuOpen(false)} />
          )}
        </div>

        <span className="text-slate-700 select-none hidden sm:inline">|</span>

        {/* SugarCube runtime setup */}
        {scReady ? (
          <span
            className="text-xs text-emerald-400 px-2 py-1 rounded bg-emerald-900/30 border border-emerald-800 cursor-pointer"
            title={t.header.scLoaded(scVersion ?? '')}
            onClick={handleClearSC}
          >
            SC {scVersion} ✓
          </span>
        ) : (
          <Btn variant="ghost" onClick={handleLoadSCFormat}
            title={t.header.scLoadTitle}>
            {t.header.scRuntime}
          </Btn>
        )}

{/* HTML export — split button */}
        {scReady && (
          <div className="relative">
            <div className="flex">
              <button
                className="px-3 py-1.5 rounded-l text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                onClick={handleExportHtml}
                title={t.header.exportSaveInFolder}
                disabled={busy}
              >
                {busy ? t.header.saving : t.header.exportHtml}
              </button>
              <button
                className="px-2 py-1.5 rounded-r text-sm font-medium bg-indigo-700 hover:bg-indigo-600 text-white transition-colors cursor-pointer border-l border-indigo-500"
                onClick={() => setExportMenuOpen(v => !v)}
                title={t.header.exportMoreOptions}
              >
                ▾
              </button>
            </div>

            {exportMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-600 rounded shadow-xl z-50 min-w-56">
                <button
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
                  onClick={handleExportHtml}
                >
                  <div className="font-medium">{t.header.exportSaveInFolder}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{t.header.exportSaveInFolderDesc}</div>
                </button>
                <div className="border-t border-slate-700" />
                <button
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
                  onClick={handleExportHtmlAs}
                >
                  <div className="font-medium">{t.header.exportSaveAs}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{t.header.exportSaveAsDesc}</div>
                </button>
                <div className="border-t border-slate-700" />
                <button
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
                  onClick={() => { setExportMenuOpen(false); handleOpenProjectFolder(); }}
                >
                  <div className="font-medium">{t.header.openFolder}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{t.header.openFolderDesc}</div>
                </button>
              </div>
            )}

            {exportMenuOpen && (
              <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
            )}
          </div>
        )}
      </div>
    </header>
  );
}

// ─── Button component ─────────────────────────────────────────────────────────

function Btn({
  children, variant, onClick, title, disabled,
}: {
  children: React.ReactNode;
  variant: 'ghost' | 'primary';
  onClick: () => void;
  title?: string;
  disabled?: boolean;
}) {
  const base = 'px-3 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50';
  const styles = variant === 'primary'
    ? `${base} bg-indigo-600 hover:bg-indigo-500 text-white`
    : `${base} bg-slate-700 hover:bg-slate-600 text-slate-200`;
  return (
    <button className={styles} onClick={onClick} title={title} disabled={disabled}>
      {children}
    </button>
  );
}
