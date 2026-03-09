import { useProjectStore } from '../../store/projectStore';
import { useT } from '../../i18n';
import { SceneList } from '../scenes/SceneList';
import { CharacterManager } from '../characters/CharacterManager';
import { VariableManager } from '../variables/VariableManager';
import { AssetManager } from '../assets/AssetManager';

type Tab = 'scenes' | 'characters' | 'variables' | 'assets' | 'panel';

export function Sidebar() {
  const { activeSidebarTab, setSidebarTab } = useProjectStore();
  const t = useT();

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'scenes',     label: t.sidebar.scenes,     icon: '🎬' },
    { id: 'characters', label: t.sidebar.characters, icon: '👤' },
    { id: 'variables',  label: t.sidebar.variables,  icon: '📊' },
    { id: 'assets',     label: t.sidebar.assets,     icon: '🖼️' },
    { id: 'panel',      label: t.sidebar.panel,      icon: '🗂️' },
  ];

  return (
    <aside className="flex flex-col w-72 shrink-0 bg-slate-900 border-r border-slate-700 overflow-hidden">
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

      {/* Tab label — hidden for 'panel' (it has its own header in the main area) */}
      {activeSidebarTab !== 'panel' && (
        <div className="px-3 pt-2 pb-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {TABS.find(tab => tab.id === activeSidebarTab)?.label}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto">
        {activeSidebarTab === 'scenes'     && <SceneList />}
        {activeSidebarTab === 'characters' && <CharacterManager />}
        {activeSidebarTab === 'variables'  && <VariableManager />}
        {activeSidebarTab === 'assets'     && <AssetManager />}
      </div>
    </aside>
  );
}
