import { useProjectStore, flattenVariables } from '../../store/projectStore';
import type { InputFieldBlock } from '../../types';
import { useT } from '../../i18n';
import { BlockEffectsPanel } from './BlockEffectsPanel';
import { ArrayAccessorInput } from './ArrayAccessorInput';

// Badge showing the variable type and which SugarCube macro will be used
function MacroBadge({ varType }: { varType: string | undefined }) {
  if (!varType) return null;
  const macro = varType === 'number' ? '<<numberbox>>' : '<<textbox>>';
  const color = varType === 'number'
    ? 'text-amber-400 border-amber-700 bg-amber-900/20'
    : 'text-sky-400 border-sky-700 bg-sky-900/20';
  return (
    <span className={`text-xs font-mono border rounded px-1.5 py-0.5 ${color}`}>
      {macro}
    </span>
  );
}

export function InputFieldBlockEditor({
  block,
  sceneId,
}: {
  block: InputFieldBlock;
  sceneId: string;
}) {
  const t = useT();
  const { project, updateBlock, saveSnapshot } = useProjectStore();
  const variables = flattenVariables(project.variableNodes);
  const selectedVar = variables.find(v => v.id === block.variableId);

  const isNumber  = selectedVar?.varType === 'number';
  const isBoolean = selectedVar?.varType === 'boolean';
  const isArray   = selectedVar?.varType === 'array';

  return (
    <div className="flex flex-col gap-2">

      {/* Label */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-24 shrink-0">{t.inputFieldBlock.labelField}</label>
        <input
          className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
          placeholder={t.inputFieldBlock.labelPlaceholder}
          value={block.label}
          onFocus={saveSnapshot}
          onChange={e => updateBlock(sceneId, block.id, { label: e.target.value })}
        />
      </div>

      {/* Variable selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-24 shrink-0">{t.inputFieldBlock.variableLabel}</label>
        <select
          className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
          value={block.variableId}
          onChange={e => {
            const v = variables.find(x => x.id === e.target.value);
            const leavingArray = isArray && v?.varType !== 'array';
            updateBlock(sceneId, block.id, {
              variableId: e.target.value,
              placeholder: v?.defaultValue ?? '',
              ...(leavingArray ? { accessor: undefined } : {}),
            });
          }}
        >
          <option value="">{t.inputFieldBlock.selectVariable}</option>
          {variables.map(v => (
            <option key={v.id} value={v.id}>${v.name} ({v.varType})</option>
          ))}
        </select>
        {variables.length === 0 && (
          <span className="text-xs text-slate-500 italic">{t.inputFieldBlock.noVariable}</span>
        )}
      </div>

      {/* Array accessor */}
      {isArray && (
        <ArrayAccessorInput
          accessor={block.accessor}
          onChange={acc => updateBlock(sceneId, block.id, { accessor: acc })}
          vars={variables}
          allowLength={false}
        />
      )}

      {/* Placeholder / default value */}
      {selectedVar && !isBoolean && !isArray && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 w-24 shrink-0">
            {isNumber ? t.inputFieldBlock.defaultNumber : t.inputFieldBlock.defaultText}
          </label>
          <input
            type={isNumber ? 'number' : 'text'}
            className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 font-mono"
            placeholder={isNumber ? t.inputFieldBlock.defaultNumberPlaceholder : t.inputFieldBlock.defaultTextPlaceholder}
            value={block.placeholder}
            onFocus={saveSnapshot}
            onChange={e => updateBlock(sceneId, block.id, { placeholder: e.target.value })}
          />
        </div>
      )}

      {/* Boolean notice */}
      {isBoolean && (
        <p className="text-xs text-amber-400/80 italic px-1">
          {t.inputFieldBlock.booleanNotSupported}
        </p>
      )}

      {/* Macro preview line */}
      {selectedVar && !isBoolean && !isArray && (
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">{t.inputFieldBlock.generated}</span>
          <MacroBadge varType={selectedVar.varType} />
          <span className="text-xs text-slate-500 font-mono">
            &quot;${selectedVar.name}&quot;
            {isNumber
              ? ` ${block.placeholder || '0'}`
              : ` "${block.placeholder || ''}"`
            }
          </span>
        </div>
      )}
      <BlockEffectsPanel
        delay={block.delay}
        onDelayChange={v => updateBlock(sceneId, block.id, { delay: v })}
      />
    </div>
  );
}
