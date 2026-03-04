import { useProjectStore, flattenVariables } from '../../store/projectStore';
import type { VariableSetBlock, VarOperator } from '../../types';

const OPERATORS: { value: VarOperator; label: string }[] = [
  { value: '=',  label: '= (присвоить)' },
  { value: '+=', label: '+= (прибавить)' },
  { value: '-=', label: '-= (вычесть)' },
  { value: '*=', label: '*= (умножить)' },
  { value: '/=', label: '/= (разделить)' },
];

export function VariableSetBlockEditor({
  block,
  sceneId,
}: {
  block: VariableSetBlock;
  sceneId: string;
}) {
  const { project, updateBlock } = useProjectStore();
  const variables = flattenVariables(project.variableNodes);
  const selectedVar = variables.find(v => v.id === block.variableId);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">Переменная:</label>
        <select
          className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
          value={block.variableId}
          onChange={e => updateBlock(sceneId, block.id, { variableId: e.target.value })}
        >
          <option value="">— выбрать —</option>
          {variables.map(v => (
            <option key={v.id} value={v.id}>${v.name} ({v.varType})</option>
          ))}
        </select>
        {variables.length === 0 && (
          <span className="text-xs text-slate-500 italic">Нет переменных</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">Операция:</label>
        <select
          className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
          value={block.operator}
          onChange={e => updateBlock(sceneId, block.id, { operator: e.target.value as VarOperator })}
        >
          {OPERATORS.map(op => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">Значение:</label>
        <input
          className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 font-mono"
          placeholder={selectedVar?.varType === 'string' ? '"текст"' : selectedVar?.varType === 'boolean' ? 'true / false' : '0'}
          value={block.value}
          onChange={e => updateBlock(sceneId, block.id, { value: e.target.value })}
        />
      </div>

      {selectedVar && block.variableId && block.value && (
        <div className="text-xs text-slate-500 font-mono bg-slate-800/60 px-2 py-1 rounded">
          {'<<set $' + selectedVar.name + ' ' + (block.operator === '=' ? 'to ' : block.operator + ' ') + block.value + '>>'}
        </div>
      )}
    </div>
  );
}
