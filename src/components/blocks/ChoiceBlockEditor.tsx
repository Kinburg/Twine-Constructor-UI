import { useRef } from 'react';
import { useProjectStore } from '../../store/projectStore';
import type { ChoiceBlock, ChoiceOption, Variable, VariableTreeNode } from '../../types';
import { SYSTEM_TAGS } from '../../types';
import { useT } from '../../i18n';
import { BlockEffectsPanel } from './BlockEffectsPanel';
import { VarInsertButton } from '../shared/VarInsertButton';
import { useVariableNodes } from '../shared/VariableScope';
import { flattenVariables } from '../../utils/treeUtils';

/** Isolated component so each option gets its own ref (avoids reading refs during render). */
function OptionLabelInput({
  value,
  placeholder,
  vars,
  variableNodes,
  onFocus,
  onChange,
}: {
  value: string;
  placeholder: string;
  vars: Variable[];
  variableNodes?: VariableTreeNode[];
  onFocus: () => void;
  onChange: (label: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        className="flex-1 bg-slate-700 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
        placeholder={placeholder}
        value={value}
        onFocus={onFocus}
        onChange={e => onChange(e.target.value)}
      />
      <VarInsertButton
        targetRef={ref}
        value={value}
        onChange={onChange}
        vars={vars}
        variableNodes={variableNodes}
      />
    </>
  );
}

export function ChoiceBlockEditor({
  block,
  sceneId,
  onUpdate,
}: {
  block: ChoiceBlock;
  sceneId: string;
  onUpdate?: (patch: Partial<ChoiceBlock>) => void;
}) {
  const { project, addChoiceOption, updateChoiceOption, deleteChoiceOption, saveSnapshot, updateBlock } = useProjectStore();
  const variableNodes = useVariableNodes();
  const scenes = project.scenes.filter(s => !s.tags.some(tag => (SYSTEM_TAGS as readonly string[]).includes(tag)));
  const t = useT();
  const vars = flattenVariables(variableNodes);

  const handleAddOption = onUpdate
    ? () => {
        const opt: ChoiceOption = { id: crypto.randomUUID(), label: t.choiceBlock.defaultOption, targetSceneId: '', condition: '' };
        onUpdate({ options: [...block.options, opt] });
      }
    : () => addChoiceOption(sceneId, block.id);

  const handleUpdateOption = onUpdate
    ? (optId: string, patch: Partial<ChoiceOption>) =>
        onUpdate({ options: block.options.map(o => o.id === optId ? { ...o, ...patch } : o) })
    : (optId: string, patch: Partial<ChoiceOption>) =>
        updateChoiceOption(sceneId, block.id, optId, patch);

  const handleDeleteOption = onUpdate
    ? (optId: string) => onUpdate({ options: block.options.filter(o => o.id !== optId) })
    : (optId: string) => deleteChoiceOption(sceneId, block.id, optId);

  return (
    <div className="flex flex-col gap-2">
      {block.options.length === 0 && (
        <p className="text-xs text-slate-500 italic">{t.choiceBlock.empty}</p>
      )}

      {block.options.map((opt, idx) => (
        <div key={opt.id} className="flex flex-col gap-1.5 bg-slate-800/60 rounded p-2 border border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 shrink-0">#{idx + 1}</span>
            <OptionLabelInput
              value={opt.label}
              placeholder={t.choiceBlock.optionPlaceholder}
              vars={vars}
              variableNodes={variableNodes}
              onFocus={saveSnapshot}
              onChange={label => handleUpdateOption(opt.id, { label })}
            />
            <button
              className="text-slate-600 hover:text-red-400 text-xs cursor-pointer transition-colors"
              title={t.choiceBlock.deleteOption}
              onClick={() => handleDeleteOption(opt.id)}
            >
              ✕
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-16 shrink-0">{t.choiceBlock.targetScene}</label>
            <select
              className="flex-1 bg-slate-700 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
              value={opt.targetSceneId}
              onChange={e => handleUpdateOption(opt.id, { targetSceneId: e.target.value })}
            >
              <option value="">{t.choiceBlock.noScene}</option>
              {scenes.map(sc => (
                <option key={sc.id} value={sc.id}>{sc.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-16 shrink-0">{t.choiceBlock.conditionLabel}</label>
            <input
              className="flex-1 bg-slate-700 text-xs text-slate-300 rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 font-mono"
              placeholder={t.choiceBlock.conditionPlaceholder}
              value={opt.condition}
              onFocus={saveSnapshot}
              onChange={e => handleUpdateOption(opt.id, { condition: e.target.value })}
            />
          </div>
        </div>
      ))}

      <button
        className="text-xs text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 rounded px-2 py-1 text-left transition-colors cursor-pointer"
        onClick={handleAddOption}
      >
        {t.choiceBlock.addOption}
      </button>
      <BlockEffectsPanel
        delay={block.delay}
        onDelayChange={v => onUpdate ? onUpdate({ delay: v }) : updateBlock(sceneId, block.id, { delay: v } as never)}
      />
    </div>
  );
}
