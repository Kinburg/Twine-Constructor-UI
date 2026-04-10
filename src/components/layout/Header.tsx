import { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useEditorStore } from '../../store/editorStore';
import { useEditorPrefsStore } from '../../store/editorPrefsStore';
import { useT, useLocaleStore, getLocales } from '../../i18n';
import { useConfirm } from '../shared/ConfirmModal';
import { generateStandaloneHtml } from '../../utils/exportToHtml';
import { exportToTwee } from '../../utils/exportToTwee';
import { extractProjectStrings, applyTranslations, type TranslationMap } from '../../utils/i18nUtils';
import {
  hasSCTemplate, getSCTemplate, getSCVersion,
  parseSCFormatJs, storeSCTemplate, clearSCTemplate,
} from '../../utils/scRuntime';
import { fsApi, joinPath, safeName } from '../../lib/fsApi';
import { toast } from 'sonner';
import pkg from '../../../package.json' with { type: 'json' };

const PURL_EXT = 'purl';

export function Header() {
  const {
    project, projectDir,
    setProjectTitle, setProjectDir, resetProject, loadProject,
    undo, redo, canUndo, canRedo,
  } = useProjectStore();
  const { locale, setLocale } = useLocaleStore();
  const { setProjectSettingsOpen, setEditorPrefsOpen, setLLMSettingsOpen } = useEditorStore();
  
  // Explicitly select llmEnabled to ensure reactivity
  const confirmOpenFolderAfterExport = useEditorPrefsStore(s => s.confirmOpenFolderAfterExport);

  const t = useT();

  const { panelLayout, togglePreviewPanel, toggleGraphPanel } = useEditorPrefsStore();

  const [editingTitle, setEditingTitle]     = useState(false);
  const [titleDraft, setTitleDraft]         = useState('');
  const [scReady, setScReady]               = useState(hasSCTemplate());
  const [scVersion, setScVersion]           = useState(getSCVersion());
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen]             = useState(false);
  const [aboutOpen, setAboutOpen]           = useState(false);
  const [busy, setBusy]                     = useState(false);
  const [isMaximized, setIsMaximized]       = useState(false);
  const { ask, modal: confirmModal } = useConfirm();

  const isCustomTitleBar = typeof window !== 'undefined' && window.electronAPI?.titleBarStyle === 'custom';

  useEffect(() => {
    setScReady(hasSCTemplate());
    setScVersion(getSCVersion());
  }, []);

  // Initialize and sync window maximize state
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.isWindowMaximized) return;
    api.isWindowMaximized().then(v => setIsMaximized(v));
    api.onWindowMaximized?.(v => setIsMaximized(v));
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
    await fsApi.mkdir(joinPath(dir, 'release', 'assets'));
    const content  = JSON.stringify(project, null, 2);
    const fileName = `${safeName(project.title)}.${PURL_EXT}`;
    await fsApi.writeFile(joinPath(dir, fileName), content);
  }

  async function ensureProjectDir(): Promise<string | null> {
    if (projectDir) {
      await fsApi.mkdir(joinPath(projectDir, 'release', 'assets'));
      return projectDir;
    }
    const folder = await fsApi.openFolderDialog();
    if (!folder) return null;
    setProjectDir(folder);
    await fsApi.mkdir(joinPath(folder, 'release', 'assets'));
    return folder;
  }

  /** Returns names of scenes that have image-gen blocks with unapproved (history/) src */
  function unapprovedScenes(): string[] {
    return project.scenes
      .filter(scene => scene.blocks.some(b => b.type === 'image-gen' && b.src.startsWith('history/')))
      .map(scene => scene.name);
  }

  // ─── Save / Open ──────────────────────────────────────────────────────────

  const handleSaveProject = async () => {
    setMenuOpen(false);
    setBusy(true);
    try {
      let dir = projectDir;
      if (!dir) {
        dir = await fsApi.openFolderDialog();
        if (!dir) return;
        setProjectDir(dir);
      }
      await doSaveToDir(dir);
      toast.success(t.header.successSave);
    } catch (e) {
      alert(t.header.errorSave(String(e)));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProjectAs = async () => {
    setMenuOpen(false);
    const dir = await fsApi.openFolderDialog();
    if (!dir) return;
    setBusy(true);
    try {
      setProjectDir(dir);
      await doSaveToDir(dir);
      toast.success(t.header.successSave);
    } catch (e) {
      alert(t.header.errorSave(String(e)));
    } finally {
      setBusy(false);
    }
  };

  const handleOpenProject = async () => {
    const filePath = await fsApi.openFileDialog({
      title: t.header.open,
      filters: [{ name: 'Purl Project', extensions: [PURL_EXT] }],
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

  const handleNewProject = () => ask(
    { message: t.header.confirmNew },
    () => {
      resetProject();
      setProjectSettingsOpen(true);
    },
  );

  const handleOpenProjectFolder = async () => {
    if (projectDir) await fsApi.openPath(projectDir);
  };

  // ─── Panel toggles ─────────────────────────────────────────────────────────

  const handleTogglePreview = () => togglePreviewPanel();
  const handleToggleGraph   = () => toggleGraphPanel();

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

  const handleClearSC = () => ask(
    { message: t.header.confirmClearSC, variant: 'danger' },
    () => { clearSCTemplate(); setScReady(false); setScVersion(null); },
  );

  // ─── Export ───────────────────────────────────────────────────────────────

  const handleExportHtml = async () => {
    const template = getSCTemplate();
    if (!template) return;
    setExportMenuOpen(false);

    const doExport = async () => {
      setBusy(true);
      try {
        const dir = await ensureProjectDir();
        if (!dir) return;
        const releaseDir = joinPath(dir, 'release');
        const html = generateStandaloneHtml(project, template);
        await fsApi.writeFile(joinPath(releaseDir, 'index.html'), html);
        toast.success(t.header.successExportHtml);
        if (confirmOpenFolderAfterExport) {
          ask({ message: t.header.confirmHtmlSaved }, async () => { await fsApi.openPath(releaseDir); });
        }
      } catch (e) {
        alert(t.header.errorExportHtml(String(e)));
      } finally {
        setBusy(false);
      }
    };

    const badScenes = unapprovedScenes();
    if (badScenes.length > 0) {
      ask(
        { message: `${t.header.unapprovedImagesTitle}\n\n${t.header.unapprovedImagesMessage(badScenes)}` },
        doExport,
      );
      return;
    }

    await doExport();
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
      toast.success(t.header.successExportHtml);
    } catch (e) {
      alert(t.header.errorExportHtml(String(e)));
    } finally {
      setBusy(false);
    }
  };

  const handleExportTwee = async () => {
    setExportMenuOpen(false);
    const defaultName = `${safeName(project.title)}.twee`;
    const defaultPath = projectDir ? joinPath(projectDir, defaultName) : defaultName;
    const filePath = await fsApi.saveFileDialog({
      title: t.header.dialogSaveTwee,
      defaultPath,
      filters: [{ name: 'Twee File', extensions: ['twee'] }],
    });
    if (!filePath) return;
    setBusy(true);
    try {
      const twee = exportToTwee(project);
      await fsApi.writeFile(filePath, twee);
      toast.success(t.header.successExportTwee);
    } catch (e) {
      alert(t.header.errorExportTwee(String(e)));
    } finally {
      setBusy(false);
    }
  };

  const handleExportTranslations = async () => {
    setMenuOpen(false);
    const strings = extractProjectStrings(project);
    const defaultName = `${safeName(project.title)}.lang.json`;
    const defaultPath = projectDir ? joinPath(projectDir, defaultName) : defaultName;
    
    const filePath = await fsApi.saveFileDialog({
      title: 'Export strings for translation',
      defaultPath,
      filters: [{ name: 'JSON Language File', extensions: ['json'] }],
    });

    if (!filePath) return;
    setBusy(true);
    try {
      await fsApi.writeFile(filePath, JSON.stringify(strings, null, 2));
      toast.success('Strings exported successfully');
    } catch (e) {
      alert('Export error: ' + String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleExportWithTranslation = async () => {
    setExportMenuOpen(false);
    
    // 1. Load the translation file
    const filePath = await fsApi.openFileDialog({
      title: 'Select translation file (.json)',
      filters: [{ name: 'JSON Language File', extensions: ['json'] }],
    });
    if (!filePath) return;

    try {
      const content = await fsApi.readFile(filePath);
      const translationMap = JSON.parse(content) as TranslationMap;
      
      // 2. Apply to a clone of the project
      const translatedProject = applyTranslations(project, translationMap);
      
      // 3. Export as HTML
      const template = getSCTemplate();
      if (!template) {
        alert(t.header.scLoadTitle);
        return;
      }

      const langCode = filePath.split(/[/\\]/).pop()?.split('.')[0] || 'translated';
      const defaultName = `${safeName(project.title)}_${langCode}.html`;
      const defaultPath = projectDir ? joinPath(projectDir, defaultName) : defaultName;

      const savePath = await fsApi.saveFileDialog({
        title: 'Save translated HTML',
        defaultPath,
        filters: [{ name: 'HTML File', extensions: ['html'] }],
      });

      if (!savePath) return;
      setBusy(true);

      const html = generateStandaloneHtml(translatedProject, template);
      await fsApi.writeFile(savePath, html);
      toast.success(`Exported ${langCode} version successfully!`);
    } catch (e) {
      alert('Error during translated export: ' + String(e));
    } finally {
      setBusy(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const locales = getLocales();

  return (
    <header
      className={`flex items-stretch pl-4 gap-4 bg-slate-900 border-b border-slate-700 shrink-0${isCustomTitleBar ? ' drag-region' : ' pr-4'}`}
    >
      {/* Left: logo + title */}
      <div className="flex items-center gap-3 shrink-0 py-2">
        <span className="text-indigo-400 font-bold text-sm tracking-wider uppercase select-none">
          Purl
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
            className="no-drag text-xs text-slate-500 hover:text-slate-400 cursor-pointer transition-colors"
            title={projectDir}
            onClick={handleOpenProjectFolder}
          >
            📁
          </span>
        )}
      </div>

      {/* Center: undo/redo + search */}
      <div className="flex-1 flex items-center justify-center gap-2 py-2">
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

      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 flex-wrap justify-end shrink-0 py-2">

        {/* Code preview panel toggle */}
        <button
          className={`px-2.5 py-1.5 rounded text-sm font-mono font-medium transition-colors cursor-pointer whitespace-nowrap ${
            panelLayout.previewVisible
              ? 'bg-indigo-700 hover:bg-indigo-600 text-indigo-100'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}
          onClick={handleTogglePreview}
          title={panelLayout.previewVisible ? t.header.previewCodeClose : t.header.previewCodeTitle}
        >
          {t.header.previewCode}
        </button>

        {/* Scene graph panel toggle */}
        <button
          className={`px-2.5 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
            panelLayout.graphVisible
              ? 'bg-violet-700 hover:bg-violet-600 text-violet-100'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}
          onClick={handleToggleGraph}
          title={panelLayout.graphVisible ? t.header.graphClose : t.header.graphTitle}
        >
          {t.header.graph}
        </button>

        <span className="text-slate-700 select-none hidden sm:inline">|</span>

        {/* SugarCube runtime setup */}
        {scReady ? (
          <span
            className="no-drag text-xs text-emerald-400 px-2 py-1 rounded bg-emerald-900/30 border border-emerald-800 cursor-pointer"
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
                  onClick={handleExportWithTranslation}
                >
                  <div className="font-medium">Export with translation...</div>
                  <div className="text-xs text-slate-400 mt-0.5">Load .json and save translated HTML</div>
                </button>
                <div className="border-t border-slate-700" />
                <button
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
                  onClick={handleExportTwee}
                  title={t.header.exportTweeTitle}
                  disabled={busy}
                >
                  <div className="font-medium">{t.header.exportTwee}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{t.header.exportTweeTitle}</div>
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

        <span className="text-slate-700 select-none hidden sm:inline">|</span>

        {/* Hamburger menu: project ops + language */}
        <div className="relative">
          <button
            className={`px-2.5 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
              menuOpen
                ? 'bg-slate-600 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            }`}
            onClick={() => setMenuOpen(v => !v)}
            title={t.header.menuTitle}
          >
            ☰
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-50 min-w-64 overflow-hidden py-1.5">

              {/* Language */}
              {locales.length > 1 && (<>
                <div className="px-3 py-2">
                  <select
                    value={locale}
                    onChange={e => setLocale(e.target.value)}
                    className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 outline-none cursor-pointer hover:border-slate-500 transition-colors"
                  >
                    {locales.map(l => (
                      <option key={l.code} value={l.code}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div className="h-px bg-slate-700/80 mx-2 my-1" />
              </>)}

              {/* File section */}
              <MenuSection label={t.header.menuSectionFile} />
              <MenuItem icon="💾" label={busy ? t.header.saving : t.header.save}
                desc={projectDir ? t.header.saveTitle(projectDir) : t.header.saveNoDir}
                shortcut="Ctrl+S" onClick={handleSaveProject} disabled={busy} />
              <MenuItem icon="📁" label={t.header.saveAsFolder} desc={t.header.saveAsFolderDesc}
                onClick={handleSaveProjectAs} disabled={busy} />
              {projectDir && (
                <MenuItem icon="🗂" label={t.header.openFolder} desc={projectDir}
                  onClick={() => { setMenuOpen(false); handleOpenProjectFolder(); }} />
              )}
              <div className="h-px bg-slate-700/50 mx-3 my-1" />
              <MenuItem icon="📂" label={t.header.open} desc={t.header.openTitle}
                onClick={() => { setMenuOpen(false); handleOpenProject(); }} disabled={busy} />
              <MenuItem icon="📄" label={t.header.new} desc={t.header.newDesc}
                onClick={() => { setMenuOpen(false); handleNewProject(); }} disabled={busy} />

              <div className="h-px bg-slate-700/80 mx-2 my-1" />

              {/* i18n section */}
              <MenuSection label="Localization" />
              <MenuItem
                icon="🌐"
                label="Export strings"
                desc="Export all project text to JSON"
                onClick={handleExportTranslations} 
                disabled={busy}
              />

              <div className="h-px bg-slate-700/80 mx-2 my-1" />

              {/* Settings section */}
              <MenuSection label={t.header.menuSectionSettings} />
              <MenuItem icon="⚙" label={t.header.projectSettings} desc={t.header.projectSettingsDesc}
                onClick={() => { setMenuOpen(false); setProjectSettingsOpen(true); }} />
              <MenuItem icon="🛠" label={t.header.editorPrefs} desc={t.header.editorPrefsDesc}
                onClick={() => { setMenuOpen(false); setEditorPrefsOpen(true); }} />
              {/* Always show LLM settings button */}
              <MenuItem icon="🧠" label={t.header.llmSettings} desc={t.header.llmSettingsDesc}
                onClick={() => { setMenuOpen(false); setLLMSettingsOpen(true); }} />
              <div className="h-px bg-slate-700/80 mx-2 my-1" />
              <MenuItem icon="ℹ️" label={t.header.about} desc={t.header.aboutDesc}
                onClick={() => { setMenuOpen(false); setAboutOpen(true); }} />
            </div>
          )}

          {menuOpen && (
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          )}
        </div>
      </div>

      {/* Custom window controls */}
      {isCustomTitleBar && (
        <div className="flex items-stretch shrink-0">
          <button
            className="w-11 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
            onClick={() => window.electronAPI?.minimizeWindow()}
            title="Minimise"
          >
            <svg width="10" height="1" viewBox="0 0 10 1" fill="none">
              <line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
          </button>
          <button
            className="w-11 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
            onClick={() => window.electronAPI?.maximizeWindow()}
            title={isMaximized ? 'Restore' : 'Maximise'}
          >
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <rect x="2.5" y="0.5" width="7" height="7" stroke="currentColor" strokeWidth="1"/>
                <rect x="0.5" y="2.5" width="7" height="7" fill="#0f172a" stroke="currentColor" strokeWidth="1"/>
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1"/>
              </svg>
            )}
          </button>
          <button
            className="w-11 flex items-center justify-center text-slate-500 hover:text-white hover:bg-red-600 transition-colors"
            onClick={() => window.electronAPI?.closeWindow()}
            title="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
          </button>
        </div>
      )}

      {confirmModal}

      {/* About Modal */}
      {aboutOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg overflow-hidden">
                <img src="/Icon.PNG" alt="Purl" className="w-full h-full object-contain p-2" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Purl</h2>
              <p className="text-slate-400 text-sm mb-4">
                {t.header.aboutVersion(pkg.version)}
              </p>
              <div className="h-px bg-slate-700/50 mb-4" />
              <button
                className="text-indigo-400 hover:text-indigo-300 transition-colors text-sm font-medium flex items-center justify-center gap-1.5 mx-auto"
                onClick={() => window.electronAPI?.openPath('https://purl.pp.ua')}
              >
                purl.pp.ua
                <span className="text-xs">↗</span>
              </button>
            </div>
            <div className="bg-slate-900/50 p-3 flex justify-center border-t border-slate-700">
              <button
                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm font-medium transition-colors"
                onClick={() => setAboutOpen(false)}
              >
                {t.common.confirm}
              </button>
            </div>
          </div>
          <div className="absolute inset-0 -z-10" onClick={() => setAboutOpen(false)} />
        </div>
      )}
    </header>
  );
}

// ─── Menu sub-components ──────────────────────────────────────────────────────

function MenuSection({ label }: { label: string }) {
  return (
    <div className="px-3 pt-1.5 pb-1 flex items-center gap-2">
      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest shrink-0">{label}</span>
      <div className="flex-1 h-px bg-slate-700/60" />
    </div>
  );
}

function MenuItem({ icon, label, desc, shortcut, onClick, disabled }: {
  icon: string;
  label: string;
  desc?: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="w-full text-left px-3 py-1.5 flex items-center gap-2.5 hover:bg-slate-700/60 active:bg-slate-700 transition-colors cursor-pointer disabled:opacity-40 group"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="text-base w-5 text-center shrink-0 leading-none">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-200 font-medium leading-tight group-hover:text-white transition-colors">{label}</div>
        {desc && <div className="text-xs text-slate-500 mt-0.5 truncate">{desc}</div>}
      </div>
      {shortcut && (
        <kbd className="text-[10px] text-slate-600 shrink-0 font-mono bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-700/80">
          {shortcut}
        </kbd>
      )}
    </button>
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
