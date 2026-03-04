import { useProjectStore } from '../../store/projectStore';
import type { ChoiceBlock } from '../../types';

export function ChoiceBlockEditor({ block, sceneId }: { block: ChoiceBlock; sceneId: string }) {
  const { project, addChoiceOption, updateChoiceOption, deleteChoiceOption } = useProjectStore();
  const { scenes } = project;

  return (
    <div className="flex flex-col gap-2">
      {block.options.length === 0 && (
        <p className="text-xs text-slate-500 italic">Нет вариантов. Добавьте ниже.</p>
      )}

      {block.options.map((opt, idx) => (
        <div key={opt.id} className="flex flex-col gap-1.5 bg-slate-800/60 rounded p-2 border border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 shrink-0">#{idx + 1}</span>
            <input
              className="flex-1 bg-slate-700 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
              placeholder="Текст кнопки..."
              value={opt.label}
              onChange={e => updateChoiceOption(sceneId, block.id, opt.id, { label: e.target.value })}
            />
            <button
              className="text-slate-600 hover:text-red-400 text-xs cursor-pointer transition-colors"
              title="Удалить вариант"
              onClick={() => deleteChoiceOption(sceneId, block.id, opt.id)}
            >
              ✕
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-16 shrink-0">Переход:</label>
            <select
              className="flex-1 bg-slate-700 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
              value={opt.targetSceneId}
              onChange={e => updateChoiceOption(sceneId, block.id, opt.id, { targetSceneId: e.target.value })}
            >
              <option value="">— сцена —</option>
              {scenes.map(sc => (
                <option key={sc.id} value={sc.name}>{sc.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-16 shrink-0">Условие:</label>
            <input
              className="flex-1 bg-slate-700 text-xs text-slate-300 rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 font-mono"
              placeholder="$var == 1  (пусто = всегда)"
              value={opt.condition}
              onChange={e => updateChoiceOption(sceneId, block.id, opt.id, { condition: e.target.value })}
            />
          </div>
        </div>
      ))}

      <button
        className="text-xs text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 rounded px-2 py-1 text-left transition-colors cursor-pointer"
        onClick={() => addChoiceOption(sceneId, block.id)}
      >
        + Добавить вариант
      </button>
    </div>
  );
}
