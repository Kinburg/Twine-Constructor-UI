import { useRef } from 'react';
import { useProjectStore, flattenVariables } from '../../store/projectStore';
import type { VariableSetBlock, VarOperator, RandomConfig, VarValueMode } from '../../types';

const OPERATORS: { value: VarOperator; label: string }[] = [
  { value: '=',  label: '= (присвоить)' },
  { value: '+=', label: '+= (прибавить)' },
  { value: '-=', label: '-= (вычесть)' },
  { value: '*=', label: '*= (умножить)' },
  { value: '/=', label: '/= (разделить)' },
];

/** Default RandomConfig for a given variable type */
function defaultRandomConfig(varType: string): RandomConfig {
  switch (varType) {
    case 'number':  return { kind: 'number', min: 0, max: 100 };
    case 'boolean': return { kind: 'boolean' };
    default:        return { kind: 'string', length: 8 };
  }
}

/** Preview of the SugarCube snippet that will be generated */
function randomPreview(varName: string, cfg: RandomConfig, operator: VarOperator): string {
  switch (cfg.kind) {
    case 'number': {
      const expr = `random(${cfg.min}, ${cfg.max})`;
      return operator === '='
        ? `<<set $${varName} to ${expr}>>`
        : `<<set $${varName} ${operator} ${expr}>>`;
    }
    case 'boolean':
      return `<<set $${varName} to either(true, false)>>`;
    case 'string':
      return `<<set $${varName} to Array(${cfg.length}).fill(0).map(()=>"abcdefghijklmnopqrstuvwxyz0123456789".charAt(random(0,35))).join("")>>`;
  }
}

export function VariableSetBlockEditor({
  block,
  sceneId,
  onUpdate,
}: {
  block: VariableSetBlock;
  sceneId: string;
  onUpdate?: (patch: Partial<VariableSetBlock>) => void;
}) {
  const { project, updateBlock } = useProjectStore();
  const update = onUpdate ?? ((p: Partial<VariableSetBlock>) => updateBlock(sceneId, block.id, p as never));
  const variables = flattenVariables(project.variableNodes);
  const selectedVar = variables.find(v => v.id === block.variableId);
  const exprInputRef = useRef<HTMLInputElement>(null);

  // Backward compat: old saves used randomize boolean
  const effectiveMode: VarValueMode = block.valueMode ?? (block.randomize ? 'random' : 'manual');
  const isNumber = selectedVar?.varType === 'number';
  const cfg = block.randomConfig ?? (selectedVar ? defaultRandomConfig(selectedVar.varType) : undefined);

  const setMode = (mode: VarValueMode) => {
    if (mode === 'random' && selectedVar) {
      update({
        valueMode: 'random',
        randomize: true,
        // For numbers, keep current operator (e.g. $hp -= random(10, 15))
        // For string/boolean, reset to = (only assignment makes sense)
        ...(selectedVar.varType !== 'number' ? { operator: '=' as VarOperator } : {}),
        randomConfig: block.randomConfig ?? defaultRandomConfig(selectedVar.varType),
      });
    } else if (mode === 'expression') {
      update({ valueMode: 'expression', randomize: false });
    } else {
      update({ valueMode: 'manual', randomize: false });
    }
  };

  const updateCfg = (patch: Partial<RandomConfig>) => {
    if (!cfg) return;
    update({ randomConfig: { ...cfg, ...patch } as RandomConfig });
  };

  /** Insert $varname at cursor position in the expression input */
  const insertVar = (varName: string) => {
    const input = exprInputRef.current;
    const token = `$${varName}`;
    if (!input) {
      update({ expression: (block.expression ?? '') + token });
      return;
    }
    const start = input.selectionStart ?? 0;
    const end   = input.selectionEnd   ?? 0;
    const current = block.expression ?? '';
    const next = current.slice(0, start) + token + current.slice(end);
    update({ expression: next });
    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      input.focus();
      const pos = start + token.length;
      input.setSelectionRange(pos, pos);
    });
  };

  // Build the SugarCube preview string
  let preview: string | null = null;
  if (selectedVar && block.variableId) {
    const op = block.operator === '=' ? 'to' : block.operator;
    if (effectiveMode === 'expression' && block.expression) {
      preview = `<<set $${selectedVar.name} ${op} ${block.expression}>>`;
    } else if (effectiveMode === 'random' && cfg) {
      preview = randomPreview(selectedVar.name, cfg, block.operator);
    } else if (effectiveMode === 'manual' && block.value) {
      const val = selectedVar.varType === 'string' ? `"${block.value}"` : block.value;
      preview = `<<set $${selectedVar.name} ${op} ${val}>>`;
    }
  }

  // Number variables available as chips in expression mode
  const numberVars = variables.filter(v => v.varType === 'number');

  return (
    <div className="flex flex-col gap-2">

      {/* Variable selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">Переменная:</label>
        <select
          className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
          value={block.variableId}
          onChange={e => update({ variableId: e.target.value })}
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

      {/* Operator — shown when: manual (always), random+number, expression (always) */}
      {selectedVar && (effectiveMode !== 'random' || cfg?.kind === 'number') && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 w-20 shrink-0">Операция:</label>
          <select
            className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
            value={block.operator}
            onChange={e => update({ operator: e.target.value as VarOperator })}
          >
            {OPERATORS.map(op => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Mode selector — 3 pills for numbers, checkbox for others */}
      {selectedVar && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 w-20 shrink-0">Значение:</label>
          {isNumber ? (
            <div className="flex gap-1">
              {([
                ['manual',     'Вручную'],
                ['random',     '🎲 Случайное'],
                ['expression', '⚙️ Выражение'],
              ] as [VarValueMode, string][]).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setMode(mode)}
                  className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                    effectiveMode === mode
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={effectiveMode === 'random'}
                onChange={e => setMode(e.target.checked ? 'random' : 'manual')}
                className="accent-indigo-500 cursor-pointer"
              />
              <span className="text-xs text-slate-300">🎲 Случайное</span>
            </label>
          )}
        </div>
      )}

      {/* Manual value input */}
      {effectiveMode === 'manual' && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 w-20 shrink-0" />
          <input
            className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 font-mono"
            placeholder={
              selectedVar?.varType === 'string'  ? '"текст"' :
              selectedVar?.varType === 'boolean' ? 'true / false' : '0'
            }
            value={block.value}
            onChange={e => update({ value: e.target.value })}
          />
        </div>
      )}

      {/* Expression mode — text input + variable chips */}
      {effectiveMode === 'expression' && (
        <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-indigo-800/50">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-20 shrink-0">Выражение:</label>
            <input
              ref={exprInputRef}
              className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 font-mono"
              placeholder="$maxHp, $str + 5, ..."
              value={block.expression ?? ''}
              onChange={e => update({ expression: e.target.value })}
            />
          </div>
          {/* Clickable variable chips for quick insertion */}
          {numberVars.length > 0 && (
            <div className="flex flex-wrap gap-1 pl-[88px]">
              {numberVars.map(v => (
                <button
                  key={v.id}
                  onClick={() => insertVar(v.name)}
                  title={`Вставить $${v.name}`}
                  className="px-1.5 py-0.5 text-xs rounded bg-slate-700 text-indigo-300 hover:bg-slate-600 font-mono cursor-pointer transition-colors"
                >
                  ${v.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Random config — only shown when random mode is active */}
      {effectiveMode === 'random' && cfg && (
        <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-indigo-800/50">
          {cfg.kind === 'number' && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 w-20 shrink-0">Диапазон:</label>
              <input
                type="number"
                className="w-20 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 font-mono"
                placeholder="от"
                value={cfg.min}
                onChange={e => updateCfg({ min: Number(e.target.value) })}
              />
              <span className="text-xs text-slate-500">—</span>
              <input
                type="number"
                className="w-20 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 font-mono"
                placeholder="до"
                value={cfg.max}
                onChange={e => updateCfg({ max: Number(e.target.value) })}
              />
            </div>
          )}

          {cfg.kind === 'string' && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 w-20 shrink-0">Длина:</label>
              <input
                type="number"
                min={1}
                max={256}
                className="w-20 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 font-mono"
                value={cfg.length}
                onChange={e => updateCfg({ length: Math.max(1, Number(e.target.value)) })}
              />
              <span className="text-xs text-slate-500">символов [a-z0-9]</span>
            </div>
          )}

          {cfg.kind === 'boolean' && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 w-20 shrink-0" />
              <span className="text-xs text-slate-400 italic">true или false — выбирается случайно</span>
            </div>
          )}
        </div>
      )}

      {/* SugarCube preview */}
      {preview && (
        <div className="text-xs text-slate-500 font-mono bg-slate-800/60 px-2 py-1 rounded break-all">
          {preview}
        </div>
      )}
    </div>
  );
}
