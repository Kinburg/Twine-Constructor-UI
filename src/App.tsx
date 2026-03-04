import { useEffect } from 'react';
import { useProjectStore } from './store/projectStore';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { SceneEditor } from './components/scenes/SceneEditor';
import { PanelEditor } from './components/panel/PanelEditor';

export default function App() {
  const { activeSidebarTab, fixVariableNames } = useProjectStore();

  // Migrate any legacy Cyrillic variable names to ASCII on every mount.
  // This covers HMR reloads where onRehydrateStorage doesn't re-run.
  useEffect(() => { fixVariableNames(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        {activeSidebarTab === 'panel' ? <PanelEditor /> : <SceneEditor />}
      </div>
    </div>
  );
}
