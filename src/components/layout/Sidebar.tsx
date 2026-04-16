import { useCallback, useRef } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useT } from '../../i18n';
import { SceneList } from '../scenes/SceneList';
import { CharacterManager } from '../characters/CharacterManager';
import { VariableManager } from '../variables/VariableManager';
import { AssetManager } from '../assets/AssetManager';
import { WatcherManager } from '../watchers/WatcherManager';
import { PanelEditor } from '../panel/PanelEditor';
import { ItemManager } from '../items/ItemManager';
import { ContainerManager } from '../containers/ContainerManager';

type Tab = 'scenes' | 'characters' | 'variables' | 'assets' | 'panel' | 'watchers' | 'items' | 'containers';

export function Sidebar() {
  const { activeSidebarTab, setSidebarTab, sidebarWidth, setSidebarWidth } = useProjectStore();
  const t = useT();
  const dragging = useRef(false);

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'scenes',     label: t.sidebar.scenes,     icon: '🎬' },
    { id: 'characters', label: t.sidebar.characters, icon: '👤' },
    { id: 'items',      label: t.sidebar.items,      icon: '🎒' },
    { id: 'containers', label: t.sidebar.containers, icon: '🏪' },
    { id: 'variables',  label: t.sidebar.variables,  icon: '📊' },
    { id: 'assets',     label: t.sidebar.assets,     icon: '🖼️' },
    { id: 'panel',      label: t.sidebar.panel,      icon: '🗂️' },
    { id: 'watchers',   label: t.sidebar.watchers,   icon: '⚡' },
  ];

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const startX = e.clientX;
    const startW = sidebarWidth;

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setSidebarWidth(startW + (ev.clientX - startX));
    };
    const onUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth, setSidebarWidth]);

  return (
    <aside
      className="flex flex-col shrink-0 bg-slate-900 border-r border-slate-700 overflow-hidden relative"
      style={{ width: sidebarWidth }}
    >
      {/* Tab bar */}
      <div className="flex border-b border-slate-700">
        {TABS.map(tab => (
          <button
            key={tab.id}
            title={tab.label}
            onClick={() => setSidebarTab(tab.id)}
            className={`flex-1 py-2 text-base transition-colors cursor-pointer ${
              activeSidebarTab === tab.id
                ? 'bg-slate-800 text-indigo-400'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            {tab.icon}
          </button>
        ))}
      </div>

      {/* Tab label */}
      <div className="px-3 pt-2 pb-1">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {TABS.find(tab => tab.id === activeSidebarTab)?.label}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto">
        {activeSidebarTab === 'scenes'      && <SceneList />}
        {activeSidebarTab === 'characters'  && <CharacterManager />}
        {activeSidebarTab === 'items'       && <ItemManager />}
        {activeSidebarTab === 'containers'  && <ContainerManager />}
        {activeSidebarTab === 'variables'   && <VariableManager />}
        {activeSidebarTab === 'assets'      && <AssetManager />}
        {activeSidebarTab === 'panel'       && <PanelEditor />}
        {activeSidebarTab === 'watchers'    && <WatcherManager />}
      </div>

      {/* Resize handle */}
      <div
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-500/30 active:bg-indigo-500/50 transition-colors z-10"
        onMouseDown={onMouseDown}
      />
    </aside>
  );
}
