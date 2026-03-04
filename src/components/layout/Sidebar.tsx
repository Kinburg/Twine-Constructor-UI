import { useProjectStore } from '../../store/projectStore';
import { SceneList } from '../scenes/SceneList';
import { CharacterManager } from '../characters/CharacterManager';
import { VariableManager } from '../variables/VariableManager';
import { AssetManager } from '../assets/AssetManager';

type Tab = 'scenes' | 'characters' | 'variables' | 'assets' | 'panel';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'scenes',     label: 'Сцены',      icon: '🎬' },
  { id: 'characters', label: 'Персонажи',   icon: '👤' },
  { id: 'variables',  label: 'Переменные',  icon: '📊' },
  { id: 'assets',     label: 'Ассеты',      icon: '🖼️' },
  { id: 'panel',      label: 'Панель',      icon: '🗂️' },
];

export function Sidebar() {
  const { activeSidebarTab, setSidebarTab } = useProjectStore();

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
            {TABS.find(t => t.id === activeSidebarTab)?.label}
          </span>
        </div>
      )}

      {/* Content — flex-1 min-h-0 bounds height; overflow-x-hidden prevents horizontal scroll
           caused by implicit overflow-x:auto when overflow-y is set */}
      <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto">
        {activeSidebarTab === 'scenes'     && <SceneList />}
        {activeSidebarTab === 'characters' && <CharacterManager />}
        {activeSidebarTab === 'variables'  && <VariableManager />}
        {activeSidebarTab === 'assets'     && <AssetManager />}
        {/* 'panel' renders in main area, sidebar shows nothing */}
      </div>
    </aside>
  );
}
