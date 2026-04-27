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
import { PluginManager } from '../plugins/PluginManager';
import { SIDEBAR_SVG_ICONS } from './SidebarIcons';

type Tab = 'scenes' | 'characters' | 'variables' | 'assets' | 'panel' | 'watchers' | 'items' | 'containers' | 'plugins';

export function Sidebar() {
  const { activeSidebarTab, setSidebarTab, sidebarWidth, setSidebarWidth } = useProjectStore();
  const t = useT();
  const dragging = useRef(false);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'scenes',     label: t.sidebar.scenes },
    { id: 'characters', label: t.sidebar.characters },
    { id: 'items',      label: t.sidebar.items },
    { id: 'containers', label: t.sidebar.containers },
    { id: 'plugins',    label: t.sidebar.plugins },
    { id: 'variables',  label: t.sidebar.variables },
    { id: 'assets',     label: t.sidebar.assets },
    { id: 'panel',      label: t.sidebar.panel },
    { id: 'watchers',   label: t.sidebar.watchers },
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
      <div className="flex border-b border-slate-700 h-9 shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            title={tab.label}
            onClick={() => setSidebarTab(tab.id)}
            className={`flex-1 flex items-center justify-center transition-colors cursor-pointer ${
              activeSidebarTab === tab.id
                ? 'bg-slate-800 text-indigo-400'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            {SIDEBAR_SVG_ICONS[tab.id]({ className: 'w-5 h-5' })}
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
        {activeSidebarTab === 'plugins'     && <PluginManager />}
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
