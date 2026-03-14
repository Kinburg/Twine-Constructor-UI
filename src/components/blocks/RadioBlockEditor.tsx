import { useProjectStore, flattenVariables } from '../../store/projectStore';
import type { RadioBlock, RadioOption } from '../../types';
import { useT } from '../../i18n';
import { BlockEffectsPanel } from './BlockEffectsPanel';

export function RadioBlockEditor({
  block,
  sceneId,
}: {
  block: RadioBlock;
  sceneId: string;
}) {
  const t = useT();
  const { project, updateBlock, saveSnapshot } = useProjectStore();
  const variables = flattenVariables(project.variableNodes);
  const stringVars = variables.filter(v => v.varType === 'string');

  const patch = (p: Partial<RadioBlock>) => updateBlock(sceneId, block.id, p);

  const patchOption = (optId: string, p: Partial<RadioOption>) =>
    patch({ options: block.options.map(o => o.id === optId ? { ...o, ...p } : o) });

  const addOption = () =>
    patch({
      options: [
        ...block.options,
        { id: crypto.randomUUID(), label: '', value: '' },
      ],
    });

  const removeOption = (optId: string) =>
    patch({ options: block.options.filter(o => o.id !== optId) });

  return (
    <div className="flex flex-col gap-3">

      {/* Group label */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-24 shrink-0">{t.radioBlock.labelField}</label>
        <input
          className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 border border-slate-600 focus:border-indigo-500 outline-none"
          placeholder={t.radioBlock.labelPlaceholder}
          value={block.label ?? ''}
          onFocus={saveSnapshot}
          onChange={e => patch({ label: e.target.value })}
        />
      </div>

      {/* Variable selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-24 shrink-0">{t.radioBlock.variableLabel}</label>
        <select
          className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 border border-slate-600 focus:border-indigo-500 outline-none cursor-pointer"
          value={block.variableId}
          onChange={e => patch({ variableId: e.target.value })}
        >
          <option value="">{t.radioBlock.selectVariable}</option>
          {stringVars.map(v => (
            <option key={v.id} value={v.id}>${v.name}</option>
          ))}
        </select>
      </div>

      {/* Options */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Options</span>
          <button
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
            onClick={addOption}
          >
            {t.radioBlock.addOption}
          </button>
        </div>

        {block.options.length === 0 && (
          <div className="text-xs text-slate-500 italic px-1">{t.radioBlock.noOptions}</div>
        )}

        {block.options.map(opt => (
          <div key={opt.id} className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700 rounded px-2 py-1.5">
            {/* Radio label */}
            <input
              className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-1 border border-slate-600 focus:border-indigo-500 outline-none"
              placeholder={t.radioBlock.optionLabelPlaceholder}
              value={opt.label}
              onFocus={saveSnapshot}
              onChange={e => patchOption(opt.id, { label: e.target.value })}
            />

            {/* Value */}
            <input
              className="w-28 bg-slate-800 text-xs text-white rounded px-1.5 py-1 border border-slate-600 focus:border-indigo-500 outline-none font-mono"
              placeholder={t.radioBlock.optionValuePlaceholder}
              value={opt.value}
              onFocus={saveSnapshot}
              onChange={e => patchOption(opt.id, { value: e.target.value })}
            />

            <button
              className="text-slate-600 hover:text-red-400 transition-colors text-sm cursor-pointer shrink-0"
              title={t.radioBlock.deleteOption}
              onClick={() => removeOption(opt.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <BlockEffectsPanel
        delay={block.delay}
        onDelayChange={v => patch({ delay: v })}
      />
    </div>
  );
}
