import { useProjectStore, flattenVariables } from '../../store/projectStore';
import type { CheckboxBlock, CheckboxOption } from '../../types';
import { useT } from '../../i18n';
import { BlockEffectsPanel } from './BlockEffectsPanel';
import { VariablePicker } from '../shared/VariablePicker';

export function CheckboxBlockEditor({
  block,
  sceneId,
}: {
  block: CheckboxBlock;
  sceneId: string;
}) {
  const t = useT();
  const { project, updateBlock, saveSnapshot } = useProjectStore();
  const variables = flattenVariables(project.variableNodes);
  const arrayVars   = variables.filter(v => v.varType === 'array');
  const booleanVars = variables.filter(v => v.varType === 'boolean');

  const patch = (p: Partial<CheckboxBlock>) => updateBlock(sceneId, block.id, p);

  const patchOption = (optId: string, p: Partial<CheckboxOption>) =>
    patch({ options: block.options.map(o => o.id === optId ? { ...o, ...p } : o) });

  const addOption = () =>
    patch({
      options: [
        ...block.options,
        { id: crypto.randomUUID(), label: '', variableId: '', value: '' },
      ],
    });

  const removeOption = (optId: string) =>
    patch({ options: block.options.filter(o => o.id !== optId) });

  return (
    <div className="flex flex-col gap-3">

      {/* Group label */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-24 shrink-0">{t.checkboxBlock.labelField}</label>
        <input
          className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 border border-slate-600 focus:border-indigo-500 outline-none"
          placeholder={t.checkboxBlock.labelPlaceholder}
          value={block.label ?? ''}
          onFocus={saveSnapshot}
          onChange={e => patch({ label: e.target.value })}
        />
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1">
        {(['flags', 'array'] as const).map(m => (
          <button
            key={m}
            onClick={() => patch({ mode: m })}
            className={`text-xs px-3 py-1 rounded border cursor-pointer transition-colors ${
              block.mode === m
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
            }`}
          >
            {m === 'flags' ? t.checkboxBlock.modeFlags : t.checkboxBlock.modeArray}
          </button>
        ))}
      </div>

      {/* Array variable selector (array mode only) */}
      {block.mode === 'array' && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 w-24 shrink-0">{t.checkboxBlock.variableLabel}</label>
          <VariablePicker
            value={block.variableId ?? ''}
            onChange={id => patch({ variableId: id })}
            nodes={project.variableNodes}
            placeholder={t.checkboxBlock.selectVariable}
            filterType="array"
          />
        </div>
      )}

      {/* Options */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Options</span>
          <button
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
            onClick={addOption}
          >
            {t.checkboxBlock.addOption}
          </button>
        </div>

        {block.options.length === 0 && (
          <div className="text-xs text-slate-500 italic px-1">{t.checkboxBlock.noOptions}</div>
        )}

        {block.options.map(opt => (
          <div key={opt.id} className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700 rounded px-2 py-1.5">
            {/* Checkbox label */}
            <input
              className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-1 border border-slate-600 focus:border-indigo-500 outline-none"
              placeholder={t.checkboxBlock.optionLabelPlaceholder}
              value={opt.label}
              onFocus={saveSnapshot}
              onChange={e => patchOption(opt.id, { label: e.target.value })}
            />

            {/* Flags mode: boolean variable per option */}
            {block.mode === 'flags' && (
              <VariablePicker
                value={opt.variableId ?? ''}
                onChange={id => patchOption(opt.id, { variableId: id })}
                nodes={project.variableNodes}
                placeholder={t.checkboxBlock.optionVarPlaceholder}
                filterType="boolean"
                className="flex-1"
              />
            )}

            {/* Array mode: value that gets pushed/removed */}
            {block.mode === 'array' && (
              <input
                className="w-28 bg-slate-800 text-xs text-white rounded px-1.5 py-1 border border-slate-600 focus:border-indigo-500 outline-none font-mono"
                placeholder={t.checkboxBlock.optionValuePlaceholder}
                value={opt.value ?? ''}
                onFocus={saveSnapshot}
                onChange={e => patchOption(opt.id, { value: e.target.value })}
              />
            )}

            <button
              className="text-slate-600 hover:text-red-400 transition-colors text-sm cursor-pointer shrink-0"
              title={t.checkboxBlock.deleteOption}
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
