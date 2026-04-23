import { useRef } from 'react';
import { useProjectStore, flattenVariables } from '../../store/projectStore';
import type { ButtonBlock, ButtonAction, ButtonStyle, VarOperator } from '../../types';
import { useT } from '../../i18n';
import { BlockEffectsPanel } from './BlockEffectsPanel';
import { ArrayAccessorInput } from './ArrayAccessorInput';
import { VarInsertButton } from '../shared/VarInsertButton';
import { VariablePicker } from '../shared/VariablePicker';
import { InventoryPopupShortcut } from './InventoryPopupShortcut';

const OPERATORS: { value: VarOperator; label: string }[] = [
  { value: '=',  label: '=' },
  { value: '+=', label: '+=' },
  { value: '-=', label: '-=' },
  { value: '*=', label: '*=' },
  { value: '/=', label: '/=' },
];

// ─── Style section ────────────────────────────────────────────────────────────

function StyleField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-400 w-24 shrink-0">{label}</label>
      {children}
    </div>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-7 h-7 rounded cursor-pointer border border-slate-600 bg-transparent p-0.5"
        title={value}
      />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-24 bg-slate-800 text-xs text-white rounded px-2 py-1 border border-slate-600 focus:border-indigo-500 outline-none font-mono"
      />
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min = 0,
  max = 999,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(Number(e.target.value))}
        className="w-16 bg-slate-800 text-xs text-white rounded px-2 py-1 border border-slate-600 focus:border-indigo-500 outline-none text-right"
      />
      {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
    </div>
  );
}

interface StyleEditorProps {
  style: ButtonStyle;
  onChange: (patch: Partial<ButtonStyle>) => void;
}

function StyleEditor({ style, onChange }: StyleEditorProps) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2 bg-slate-800/50 border border-slate-700 rounded p-3">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t.buttonBlock.styleTitle}</div>

      <StyleField label={t.buttonBlock.bgLabel}>
        <ColorInput value={style.bgColor} onChange={v => onChange({ bgColor: v })} />
      </StyleField>

      <StyleField label={t.buttonBlock.textColorLabel}>
        <ColorInput value={style.textColor} onChange={v => onChange({ textColor: v })} />
      </StyleField>

      <StyleField label={t.buttonBlock.borderLabel}>
        <ColorInput value={style.borderColor} onChange={v => onChange({ borderColor: v })} />
      </StyleField>

      <StyleField label={t.buttonBlock.radiusLabel}>
        <NumberInput value={style.borderRadius} onChange={v => onChange({ borderRadius: v })} max={50} suffix="px" />
      </StyleField>

      <StyleField label={t.buttonBlock.paddingLabel}>
        <div className="flex items-center gap-1.5">
          <NumberInput value={style.paddingV} onChange={v => onChange({ paddingV: v })} max={40} suffix="↕" />
          <NumberInput value={style.paddingH} onChange={v => onChange({ paddingH: v })} max={80} suffix="↔" />
          <span className="text-xs text-slate-500">px</span>
        </div>
      </StyleField>

      <StyleField label={t.buttonBlock.fontSizeLabel}>
        <div className="flex items-center gap-1.5">
          <NumberInput
            value={style.fontSize}
            onChange={v => onChange({ fontSize: v })}
            min={6}
            max={30}
            suffix={`= ${(style.fontSize / 10).toFixed(1)}em`}
          />
        </div>
      </StyleField>

      <div className="flex items-center gap-4 mt-1">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={style.bold}
            onChange={e => onChange({ bold: e.target.checked })}
            className="accent-indigo-500"
          />
          <span className="text-xs text-slate-300">{t.buttonBlock.bold}</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={style.fullWidth}
            onChange={e => onChange({ fullWidth: e.target.checked })}
            className="accent-indigo-500"
          />
          <span className="text-xs text-slate-300">{t.buttonBlock.fullWidth}</span>
        </label>
      </div>

      {/* Live preview */}
      <div className="mt-2 pt-2 border-t border-slate-700">
        <div className="text-xs text-slate-500 mb-1.5">{t.buttonBlock.previewTitle}</div>
        <div style={{ width: style.fullWidth ? '100%' : 'fit-content' }}>
          <span
            style={{
              display: style.fullWidth ? 'block' : 'inline-block',
              background: style.bgColor,
              color: style.textColor,
              border: `1px solid ${style.borderColor}`,
              borderRadius: `${style.borderRadius}px`,
              padding: `${style.paddingV}px ${style.paddingH}px`,
              fontSize: `${(style.fontSize / 10).toFixed(1)}em`,
              fontWeight: style.bold ? 'bold' : 'normal',
              textAlign: style.fullWidth ? 'center' : undefined,
              cursor: 'default',
              userSelect: 'none',
            }}
          >
            {t.buttonBlock.defaultButtonLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Actions section ──────────────────────────────────────────────────────────

interface ActionRowProps {
  action: ButtonAction;
  variables: ReturnType<typeof flattenVariables>;
  onChange: (patch: Partial<ButtonAction>) => void;
  onDelete: () => void;
  onFocusValue: () => void;
}

function ActionRow({ action, variables, onChange, onDelete, onFocusValue }: ActionRowProps) {
  const t = useT();
  const { project } = useProjectStore();
  const isPopup = action.type === 'open-popup';

  // Popup action row
  if (isPopup) {
    const popupScenes = project.scenes.filter(s => s.tags.includes('popup'));
    return (
      <div className="flex flex-col gap-1 bg-slate-800/60 border border-slate-700 rounded px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <select
            className="w-24 bg-slate-800 text-xs text-white rounded px-1.5 py-1 border border-slate-600 focus:border-indigo-500 outline-none cursor-pointer"
            value="open-popup"
            onChange={e => {
              if (e.target.value === 'set-variable') {
                onChange({ type: undefined, variableId: '', operator: '=' as VarOperator, value: '' } as Partial<ButtonAction>);
              }
            }}
          >
            <option value="set-variable">{t.actionType.setVariable}</option>
            <option value="open-popup">{t.actionType.openPopup}</option>
          </select>
          {popupScenes.length === 0 ? (
            <span className="flex-1 text-xs text-slate-500 italic">{t.actionType.noPopupScenes}</span>
          ) : (
            <select
              className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-1 border border-slate-600 focus:border-indigo-500 outline-none cursor-pointer"
              value={action.targetSceneId}
              onChange={e => onChange({ targetSceneId: e.target.value } as Partial<ButtonAction>)}
            >
              <option value="">— select —</option>
              {popupScenes.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <InventoryPopupShortcut onResolved={sceneId => onChange({ targetSceneId: sceneId } as Partial<ButtonAction>)} />
          <button
            className="text-slate-600 hover:text-red-400 transition-colors text-sm cursor-pointer shrink-0"
            title={t.buttonBlock.deleteAction}
            onClick={onDelete}
          >✕</button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 w-24 shrink-0">{t.actionType.popupTitle}</span>
          <input
            className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-1 border border-slate-600 focus:border-indigo-500 outline-none"
            placeholder={t.actionType.popupTitlePlaceholder}
            value={action.title ?? ''}
            onChange={e => onChange({ title: e.target.value } as Partial<ButtonAction>)}
          />
        </div>
      </div>
    );
  }

  // Variable set action row
  const selVar = variables.find(v => v.id === action.variableId);
  const isArray = selVar?.varType === 'array';
  const accessorKind = action.accessor?.kind ?? 'whole';

  const availableOps: { value: VarOperator; label: string }[] = isArray
    ? (accessorKind === 'index'
        ? [{ value: '=',      label: '=' }]
        : [{ value: '=',      label: '=' },
           { value: 'push',   label: 'push' },
           { value: 'remove', label: 'remove' },
           { value: 'clear',  label: 'clear' }])
    : (selVar?.varType === 'number' ? OPERATORS : OPERATORS.filter(op => op.value === '='));

  return (
    <div className="flex flex-col gap-1 bg-slate-800/60 border border-slate-700 rounded px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        {/* Action type selector */}
        <select
          className="w-24 bg-slate-800 text-xs text-white rounded px-1.5 py-1 border border-slate-600 focus:border-indigo-500 outline-none cursor-pointer"
          value="set-variable"
          onChange={e => {
            if (e.target.value === 'open-popup') {
              onChange({ type: 'open-popup', variableId: undefined, operator: undefined, value: undefined, accessor: undefined, targetSceneId: '', title: '' } as unknown as Partial<ButtonAction>);
            }
          }}
        >
          <option value="set-variable">{t.actionType.setVariable}</option>
          <option value="open-popup">{t.actionType.openPopup}</option>
        </select>

        {/* Variable select */}
        <VariablePicker
          value={action.variableId}
          onChange={id => {
            const newVar = variables.find(v => v.id === id);
            const leavingArray = isArray && newVar?.varType !== 'array';
            const arrayOpOnNonArray = leavingArray && (action.operator === 'push' || action.operator === 'remove' || action.operator === 'clear');
            onChange({
              variableId: id,
              ...(arrayOpOnNonArray ? { operator: '=' as VarOperator } : {}),
              ...(leavingArray ? { accessor: undefined } : {}),
            });
          }}
          nodes={project.variableNodes}
          placeholder={t.buttonBlock.selectVariable}
          className="flex-1 min-w-0"
        />

        {/* Operator */}
        <select
          className="w-16 bg-slate-800 text-xs text-white rounded px-1.5 py-1 border border-slate-600 focus:border-indigo-500 outline-none cursor-pointer font-mono"
          value={action.operator}
          onChange={e => onChange({ operator: e.target.value as VarOperator })}
        >
          {availableOps.map(op => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </select>

        {/* Value — hidden for 'clear' */}
        {action.operator !== 'clear' && (
          <input
            className="w-20 bg-slate-800 text-xs text-white rounded px-1.5 py-1 border border-slate-600 focus:border-indigo-500 outline-none font-mono"
            placeholder={selVar?.varType === 'string' || isArray ? t.buttonBlock.textPlaceholder : selVar?.varType === 'boolean' ? 'true' : '1'}
            value={action.value}
            onFocus={onFocusValue}
            onChange={e => onChange({ value: e.target.value })}
          />
        )}

        <button
          className="text-slate-600 hover:text-red-400 transition-colors text-sm cursor-pointer shrink-0"
          title={t.buttonBlock.deleteAction}
          onClick={onDelete}
        >
          ✕
        </button>
      </div>

      {/* Array accessor — shown below when var is array */}
      {isArray && (
        <ArrayAccessorInput
          accessor={action.accessor}
          onChange={acc => {
            const newOps = acc.kind === 'index'
              ? [{ value: '=' as VarOperator, label: '=' }]
              : [{ value: '=' as VarOperator, label: '=' }, { value: 'push' as VarOperator, label: 'push' }, { value: 'remove' as VarOperator, label: 'remove' }, { value: 'clear' as VarOperator, label: 'clear' }];
            const opStillValid = newOps.some(op => op.value === action.operator);
            onChange({
              accessor: acc,
              ...(!opStillValid ? { operator: '=' as VarOperator } : {}),
            });
          }}
          vars={variables}
          allowLength={false}
        />
      )}
    </div>
  );
}

// ─── Main editor ──────────────────────────────────────────────────────────────

export function ButtonBlockEditor({
  block,
  sceneId,
}: {
  block: ButtonBlock;
  sceneId: string;
}) {
  const t = useT();
  const { project, updateBlock, saveSnapshot } = useProjectStore();
  const variables = flattenVariables(project.variableNodes);
  const labelRef = useRef<HTMLInputElement>(null);

  // Patch helpers
  const patchStyle = (patch: Partial<ButtonStyle>) =>
    updateBlock(sceneId, block.id, { style: { ...block.style, ...patch } });

  const patchAction = (actionId: string, patch: Partial<ButtonAction>) =>
    updateBlock(sceneId, block.id, {
      actions: block.actions.map(a => a.id === actionId ? { ...a, ...patch } : a) as ButtonAction[],
    });

  const addAction = () =>
    updateBlock(sceneId, block.id, {
      actions: [
        ...block.actions,
        { id: crypto.randomUUID(), variableId: '', operator: '=' as VarOperator, value: '' },
      ],
    });

  const removeAction = (actionId: string) =>
    updateBlock(sceneId, block.id, {
      actions: block.actions.filter(a => a.id !== actionId),
    });

  return (
    <div className="flex flex-col gap-3">
      {/* Label */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-24 shrink-0">{t.buttonBlock.labelField}</label>
        <input
          ref={labelRef}
          className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 border border-slate-600 focus:border-indigo-500 outline-none"
          placeholder={t.buttonBlock.labelPlaceholder}
          value={block.label}
          onFocus={saveSnapshot}
          onChange={e => updateBlock(sceneId, block.id, { label: e.target.value })}
        />
        <VarInsertButton
          targetRef={labelRef}
          value={block.label}
          onChange={label => updateBlock(sceneId, block.id, { label })}
          vars={variables}
          variableNodes={project.variableNodes}
        />
      </div>

      {/* Style */}
      <StyleEditor style={block.style} onChange={patchStyle} />

      {/* Actions */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {t.buttonBlock.actionsTitle}
          </span>
          <button
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
            onClick={addAction}
          >
            {t.buttonBlock.addAction}
          </button>
        </div>

        {block.actions.length === 0 && (
          <div className="text-xs text-slate-500 italic px-1">
            {t.buttonBlock.noActions}
          </div>
        )}

        {block.actions.map(a => (
          <ActionRow
            key={a.id}
            action={a}
            variables={variables}
            onChange={patch => patchAction(a.id, patch)}
            onDelete={() => removeAction(a.id)}
            onFocusValue={saveSnapshot}
          />
        ))}
      </div>

      {/* Refresh scene option */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={block.refreshScene ?? false}
          onChange={e => updateBlock(sceneId, block.id, { refreshScene: e.target.checked })}
          className="accent-indigo-500 cursor-pointer"
        />
        <span className="text-xs text-slate-400">
          {t.buttonBlock.refreshScene} <span className="font-mono text-slate-500">(Engine.show)</span>
        </span>
      </label>
      <BlockEffectsPanel
        delay={block.delay}
        onDelayChange={v => updateBlock(sceneId, block.id, { delay: v })}
      />
    </div>
  );
}
