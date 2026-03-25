import { useEffect } from 'react';
import { useProjectStore } from './store/projectStore';
import { useEditorStore } from './store/editorStore';
import { useEditorPrefsStore } from './store/editorPrefsStore';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { SceneEditor } from './components/scenes/SceneEditor';
import { PanelEditor } from './components/panel/PanelEditor';
import { ProjectSettingsModal } from './components/project/ProjectSettingsModal';
import { EditorPrefsModal } from './components/editor/EditorPrefsModal';
import { usePreviewSync } from './hooks/usePreviewSync';
import { useGraphBridge } from './hooks/useGraphBridge';
import { useAutosave } from './hooks/useAutosave';

export default function App() {
  const { activeSidebarTab, fixVariableNames, undo, redo, project, projectDir } = useProjectStore();
  const { projectSettingsOpen, setProjectSettingsOpen, editorPrefsOpen, setEditorPrefsOpen } = useEditorStore();
  const compactMode = useEditorPrefsStore(s => s.compactMode);
  useAutosave();

  // Keeps the code preview window in sync with the active scene
  usePreviewSync();
  // Two-way bridge with the scene graph window
  useGraphBridge();

  // Migrate any legacy Cyrillic variable names to ASCII on every mount.
  // This covers HMR reloads where onRehydrateStorage doesn't re-run.
  useEffect(() => { fixVariableNames(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Show project settings modal on first launch (no folder selected = brand new session)
  useEffect(() => {
    if (!projectDir) {
      setProjectSettingsOpen(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Global keyboard shortcuts: Ctrl+Z = undo, Ctrl+Shift+Z / Ctrl+Y = redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key === 'z' &&  e.shiftKey) { e.preventDefault(); redo(); }
      if (e.key === 'y' && !e.shiftKey) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  return (
    <div className={`flex flex-col h-screen overflow-hidden${compactMode ? ' compact' : ''}`}>
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        {activeSidebarTab === 'panel' ? <PanelEditor /> : <SceneEditor />}
      </div>
      {projectSettingsOpen && (
        <ProjectSettingsModal
          mode={projectDir ? 'edit' : 'create'}
          onClose={() => setProjectSettingsOpen(false)}
        />
      )}
      {editorPrefsOpen && (
        <EditorPrefsModal onClose={() => setEditorPrefsOpen(false)} />
      )}
    </div>
  );
}
