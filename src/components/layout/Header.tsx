import { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { exportToTwee } from '../../utils/exportToTwee';
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
  } = useProjectStore();

  const [editingTitle, setEditingTitle]     = useState(false);
  const [titleDraft, setTitleDraft]         = useState('');
  const [scReady, setScReady]               = useState(hasSCTemplate());
  const [scVersion, setScVersion]           = useState(getSCVersion());
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [saveMenuOpen, setSaveMenuOpen]     = useState(false);
  const [busy, setBusy]                     = useState(false);

  // Sync scReady state after upload
  useEffect(() => {
    setScReady(hasSCTemplate());
    setScVersion(getSCVersion());
  }, []);

  // ─── Title ────────────────────────────────────────────────────────────────

  const handleTitleClick = () => {
    setTitleDraft(project.title);
    setEditingTitle(true);
  };

  const handleTitleBlur = () => {
    const newTitle = titleDraft.trim();
    if (!newTitle || newTitle === project.title) { setEditingTitle(false); return; }
    // Only rename the project title — folder renaming removed since the folder
    // is now user-chosen and may not match the project name
    setProjectTitle(newTitle);
    setEditingTitle(false);
  };

  // ─── Save helpers ─────────────────────────────────────────────────────────

  /** Write project.tgproject into dir, creating assets/ subfolder */
  async function doSaveToDir(dir: string): Promise<void> {
    await fsApi.mkdir(joinPath(dir, 'assets'));
    const content = JSON.stringify(project, null, 2);
    await fsApi.writeFile(joinPath(dir, 'project.tgproject'), content);
  }

  /**
   * Returns the current project dir; if not set, opens a folder picker.
   * Also creates the assets/ subfolder.
   * Returns null if the user cancels the picker.
   */
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

  /** Silent save to existing dir; opens folder picker only if dir is unknown */
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
      alert(`Ошибка сохранения: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  /** Save to a new user-chosen folder (Save As) */
  const handleSaveProjectAs = async () => {
    setSaveMenuOpen(false);
    const dir = await fsApi.openFolderDialog();
    if (!dir) return;
    setBusy(true);
    try {
      setProjectDir(dir);
      await doSaveToDir(dir);
    } catch (e) {
      alert(`Ошибка сохранения: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  const handleOpenProject = async () => {
    const filePath = await fsApi.openFileDialog({
      title: 'Открыть проект',
      filters: [{ name: 'TwineGenerator Project', extensions: ['tgproject', 'json'] }],
    });
    if (!filePath) return;
    try {
      const text   = await fsApi.readFile(filePath);
      const loaded = JSON.parse(text);
      // Derive project dir from the file path (strip filename)
      const dir = filePath.replace(/[/\\][^/\\]+$/, '');
      loadProject(loaded, dir);
    } catch {
      alert('Ошибка: невалидный файл проекта.');
    }
  };

  /**
   * Confirm → pick folder → reset project.
   * If the folder picker is canceled the project is still reset (user already confirmed).
   */
  const handleNewProject = async () => {
    if (!confirm('Создать новый проект? Несохранённые данные будут потеряны.')) return;
    const folder = await fsApi.openFolderDialog();
    resetProject();
    if (folder) setProjectDir(folder);
  };

  const handleOpenProjectFolder = async () => {
    if (projectDir) await fsApi.openPath(projectDir);
  };

  // ─── SC Runtime ───────────────────────────────────────────────────────────

  const handleLoadSCFormat = async () => {
    const filePath = await fsApi.openFileDialog({
      title: 'Выбрать SugarCube 2 format.js',
      filters: [{ name: 'JavaScript', extensions: ['js'] }],
    });
    if (!filePath) return;
    try {
      const text   = await fsApi.readFile(filePath);
      const result = parseSCFormatJs(text);
      if (!result) {
        alert('Не удалось распознать format.js. Убедитесь, что файл — это SugarCube 2 format.js.');
        return;
      }
      storeSCTemplate(result.source, result.version);
      setScReady(true);
      setScVersion(result.version);
      alert(`SugarCube ${result.version} успешно загружен! Теперь доступен экспорт HTML.`);
    } catch (e) {
      alert(`Ошибка чтения файла: ${e}`);
    }
  };

  const handleClearSC = () => {
    if (!confirm('Удалить загруженный SugarCube runtime?')) return;
    clearSCTemplate();
    setScReady(false);
    setScVersion(null);
  };

  // ─── Export ───────────────────────────────────────────────────────────────

  /** Export .twee — opens a Save dialog so the user can choose filename & location */
  const handleExportTwee = async () => {
    const defaultName = `${safeName(project.title)}.twee`;
    const defaultPath = projectDir ? joinPath(projectDir, defaultName) : defaultName;

    const filePath = await fsApi.saveFileDialog({
      title: 'Сохранить .twee файл',
      defaultPath,
      filters: [{ name: 'Twee Source File', extensions: ['twee'] }],
    });
    if (!filePath) return;

    try {
      const content = exportToTwee(project);
      await fsApi.writeFile(filePath, content);
    } catch (e) {
      alert(`Ошибка экспорта .twee: ${e}`);
    }
  };

  /** Export standalone HTML — saves index.html into the project folder */
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
      if (confirm('index.html сохранён в папку проекта. Открыть папку?')) {
        await fsApi.openPath(dir);
      }
    } catch (e) {
      alert(`Ошибка экспорта HTML: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  /** Export standalone HTML — save dialog so user can choose location & name */
  const handleExportHtmlAs = async () => {
    const template = getSCTemplate();
    if (!template) return;
    setExportMenuOpen(false);

    const defaultName = `${safeName(project.title)}.html`;
    const defaultPath = projectDir ? joinPath(projectDir, defaultName) : defaultName;

    const filePath = await fsApi.saveFileDialog({
      title: 'Сохранить HTML файл',
      defaultPath,
      filters: [{ name: 'HTML File', extensions: ['html'] }],
    });
    if (!filePath) return;

    setBusy(true);
    try {
      const html = generateStandaloneHtml(project, template);
      await fsApi.writeFile(filePath, html);
    } catch (e) {
      alert(`Ошибка экспорта HTML: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700 shrink-0 gap-4">
      {/* Left: logo + title */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-indigo-400 font-bold text-sm tracking-wider uppercase select-none">
          TwineGen
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
            title="Нажмите чтобы переименовать проект"
          >
            {project.title}
          </button>
        )}

        {/* Project dir indicator */}
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

      {/* Right: actions */}
      <div className="flex items-center gap-2 flex-wrap justify-end">

        {/* Open / New */}
        <Btn variant="ghost" onClick={handleOpenProject} title="Открыть проект (.tgproject)" disabled={busy}>
          Открыть
        </Btn>
        <Btn variant="ghost" onClick={handleNewProject} disabled={busy}>
          Новый
        </Btn>

        {/* Save — split button */}
        <div className="relative">
          <div className="flex">
            <button
              className="px-3 py-1.5 rounded-l text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              onClick={handleSaveProject}
              title={projectDir ? `Сохранить в: ${projectDir}` : 'Выбрать папку и сохранить'}
              disabled={busy}
            >
              {busy ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              className="px-2 py-1.5 rounded-r text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer border-l border-slate-600"
              onClick={() => setSaveMenuOpen(v => !v)}
              title="Дополнительные варианты сохранения"
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
                <div className="font-medium">Сохранить в новую папку</div>
                <div className="text-xs text-slate-400 mt-0.5">Выбрать другую папку для проекта</div>
              </button>
              {projectDir && (
                <>
                  <div className="border-t border-slate-700" />
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
                    onClick={() => { setSaveMenuOpen(false); handleOpenProjectFolder(); }}
                  >
                    <div className="font-medium">Открыть папку проекта</div>
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
            title={`SugarCube ${scVersion} загружен. Нажмите чтобы удалить.`}
            onClick={handleClearSC}
          >
            SC {scVersion} ✓
          </span>
        ) : (
          <Btn variant="ghost" onClick={handleLoadSCFormat}
            title="Загрузить SugarCube 2 format.js для экспорта самодостаточного HTML">
            + SC Runtime
          </Btn>
        )}

        {/* .twee export */}
        <Btn variant="ghost" onClick={handleExportTwee}
          title="Экспорт в .twee (выбор места сохранения)" disabled={busy}>
          .twee
        </Btn>

        {/* HTML export — split button */}
        {scReady && (
          <div className="relative">
            <div className="flex">
              <button
                className="px-3 py-1.5 rounded-l text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                onClick={handleExportHtml}
                title="Сохранить index.html в папку проекта"
                disabled={busy}
              >
                {busy ? 'Сохранение...' : 'Экспорт HTML'}
              </button>
              <button
                className="px-2 py-1.5 rounded-r text-sm font-medium bg-indigo-700 hover:bg-indigo-600 text-white transition-colors cursor-pointer border-l border-indigo-500"
                onClick={() => setExportMenuOpen(v => !v)}
                title="Дополнительные опции"
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
                  <div className="font-medium">Сохранить в папку проекта</div>
                  <div className="text-xs text-slate-400 mt-0.5">Пишет index.html рядом с project.tgproject</div>
                </button>
                <div className="border-t border-slate-700" />
                <button
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
                  onClick={handleExportHtmlAs}
                >
                  <div className="font-medium">Сохранить как...</div>
                  <div className="text-xs text-slate-400 mt-0.5">Выбрать имя файла и место сохранения</div>
                </button>
                <div className="border-t border-slate-700" />
                <button
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
                  onClick={() => { setExportMenuOpen(false); handleOpenProjectFolder(); }}
                >
                  <div className="font-medium">Открыть папку проекта</div>
                  <div className="text-xs text-slate-400 mt-0.5">Показать в проводнике</div>
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
