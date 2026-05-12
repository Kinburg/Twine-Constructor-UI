import { useState } from 'react';
import type {
  BlockStyleOverride, StyleMappingEntry, StyleMode, VariableTreeNode,
} from '../../types';
import { useT } from '../../i18n';
import { ColorSwatchInput, INPUT_CLS } from './ModalShell';
import { VariablePicker } from './VariablePicker';

/**
 * Shared editor for a BlockStyleOverride. Used in CharacterModal (per-character
 * common-custom dialogue style), DialogueBlockEditor (per-block spot custom),
 * and ProjectSettingsModal Block-defaults tab (per-block-type common-custom).
 *
 * Phase 1: dialogue fields hardcoded (bg / border / name / text colors).
 * Phase 2+: pass `fields` schema as a prop to support other block types.
 */

/** Field descriptors — keys correspond to BlockStyleOverride.fields keys. */
const DIALOGUE_COLOR_FIELDS = [
  { key: 'bgColor',     labelKey: 'fieldBgColor' },
  { key: 'borderColor', labelKey: 'fieldBorderColor' },
  { key: 'nameColor',   labelKey: 'fieldNameColor' },
  { key: 'textColor',   labelKey: 'fieldTextColor' },
] as const;

function emptyOverride(): BlockStyleOverride {
  return { enabled: false, mode: 'static', fields: {}, rawCss: '' };
}

function readField(fields: Record<string, string | number | boolean> | undefined, key: string): string {
  const v = fields?.[key];
  return typeof v === 'string' ? v : '';
}

function setField(
  fields: Record<string, string | number | boolean> | undefined,
  key: string,
  value: string,
): Record<string, string | number | boolean> {
  const next = { ...(fields ?? {}) };
  if (value === '') delete next[key];
  else next[key] = value;
  return next;
}

interface Props {
  value: BlockStyleOverride | undefined;
  onChange: (value: BlockStyleOverride | undefined) => void;
  variableNodes: VariableTreeNode[];
  /** Disable bound mode (only allowed at common-custom layer). */
  allowBound?: boolean;
}

export function StyleOverrideEditor({ value, onChange, variableNodes, allowBound = true }: Props) {
  const t = useT();
  const tt = t.styleOverride as any;
  const v = value ?? emptyOverride();
  const enabled = v.enabled;
  const mode: StyleMode = v.mode ?? 'static';

  const patch = (p: Partial<BlockStyleOverride>) => onChange({ ...v, ...p });

  const reset = () => onChange(undefined);

  return (
    <div className="flex flex-col gap-2 text-xs">
      {/* Master toggle */}
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            className="accent-indigo-500 cursor-pointer"
            checked={enabled}
            onChange={e => patch({ enabled: e.target.checked })}
          />
          <span className="text-sm text-slate-200 font-medium">{tt.enable}</span>
        </label>
        {enabled && (
          <button
            type="button"
            onClick={reset}
            className="text-[11px] text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
          >
            {tt.reset}
          </button>
        )}
      </div>

      {!enabled && (
        <p className="text-[11px] text-slate-500 leading-relaxed">{tt.enableNote}</p>
      )}

      {enabled && (
        <div className="border border-slate-700/60 rounded p-3 flex flex-col gap-3 bg-slate-900/30">
          {/* Mode selector */}
          {allowBound && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={`flex-1 text-xs px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                  mode === 'static'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500'
                }`}
                onClick={() => patch({ mode: 'static' })}
              >
                {tt.modeStatic}
              </button>
              <button
                type="button"
                className={`flex-1 text-xs px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                  mode === 'bound'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500'
                }`}
                onClick={() => patch({ mode: 'bound' })}
              >
                {tt.modeBound}
              </button>
            </div>
          )}

          {mode === 'static' && (
            <StaticEditor
              fields={v.fields}
              rawCss={v.rawCss ?? ''}
              onFieldsChange={fields => patch({ fields })}
              onRawCssChange={rawCss => patch({ rawCss })}
            />
          )}

          {mode === 'bound' && allowBound && (
            <BoundEditor
              variableId={v.variableId ?? ''}
              mapping={v.mapping ?? []}
              defaultFields={v.defaultFields}
              defaultRawCss={v.defaultRawCss ?? ''}
              variableNodes={variableNodes}
              onVariableChange={variableId => patch({ variableId })}
              onMappingChange={mapping => patch({ mapping })}
              onDefaultFieldsChange={defaultFields => patch({ defaultFields })}
              onDefaultRawCssChange={defaultRawCss => patch({ defaultRawCss })}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Static-mode editor ──────────────────────────────────────────────────────

function StaticEditor({
  fields, rawCss, onFieldsChange, onRawCssChange,
}: {
  fields: Record<string, string | number | boolean> | undefined;
  rawCss: string;
  onFieldsChange: (fields: Record<string, string | number | boolean>) => void;
  onRawCssChange: (rawCss: string) => void;
}) {
  const t = useT();
  const tt = t.styleOverride as any;
  return (
    <>
      <FieldsEditor fields={fields} onChange={onFieldsChange} />
      <RawCssEditor value={rawCss} onChange={onRawCssChange} />
      <p className="text-[10px] text-slate-500 leading-relaxed">{tt.rawCssScopedNote}</p>
    </>
  );
}

// ─── Bound-mode editor ───────────────────────────────────────────────────────

function BoundEditor({
  variableId, mapping, defaultFields, defaultRawCss, variableNodes,
  onVariableChange, onMappingChange, onDefaultFieldsChange, onDefaultRawCssChange,
}: {
  variableId: string;
  mapping: StyleMappingEntry[];
  defaultFields: Record<string, string | number | boolean> | undefined;
  defaultRawCss: string;
  variableNodes: VariableTreeNode[];
  onVariableChange: (id: string) => void;
  onMappingChange: (mapping: StyleMappingEntry[]) => void;
  onDefaultFieldsChange: (fields: Record<string, string | number | boolean>) => void;
  onDefaultRawCssChange: (rawCss: string) => void;
}) {
  const t = useT();
  const tt = t.styleOverride as any;

  const addVariant = () => {
    const entry: StyleMappingEntry = {
      id: crypto.randomUUID(),
      matchType: 'exact',
      value: '',
      fields: {},
      rawCss: '',
    };
    onMappingChange([...mapping, entry]);
  };

  const updateVariant = (idx: number, patch: Partial<StyleMappingEntry>) => {
    onMappingChange(mapping.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };

  const deleteVariant = (idx: number) => {
    onMappingChange(mapping.filter((_, i) => i !== idx));
  };

  const moveVariant = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= mapping.length) return;
    const next = mapping.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    onMappingChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Variable picker */}
      <div>
        <label className="block text-[11px] text-slate-400 mb-1">{tt.bindVariableLabel}</label>
        <VariablePicker
          value={variableId}
          onChange={onVariableChange}
          nodes={variableNodes}
          placeholder={tt.bindVariableEmpty}
          filterType="number"
        />
      </div>

      <p className="text-[10px] text-slate-500 leading-relaxed">{tt.modeBoundNote}</p>

      {/* Variants */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
            {tt.variants}
          </span>
          <span className="text-[10px] text-slate-500">— {tt.variantConditionHint}</span>
        </div>

        <div className="flex flex-col gap-2">
          {mapping.length === 0 && (
            <p className="text-[11px] text-slate-500 italic">{tt.variantEmpty}</p>
          )}
          {mapping.map((entry, idx) => (
            <VariantRow
              key={entry.id}
              entry={entry}
              onChange={p => updateVariant(idx, p)}
              onDelete={() => deleteVariant(idx)}
              onMoveUp={idx > 0 ? () => moveVariant(idx, -1) : undefined}
              onMoveDown={idx < mapping.length - 1 ? () => moveVariant(idx, 1) : undefined}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addVariant}
          className="mt-2 text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors"
        >
          {tt.variantAdd}
        </button>
      </div>

      {/* Default variant */}
      <div className="pt-2 border-t border-slate-700/40">
        <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wide mb-1">
          {tt.variantDefault}
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed mb-2">{tt.variantDefaultNote}</p>
        <FieldsEditor fields={defaultFields} onChange={onDefaultFieldsChange} />
        <RawCssEditor value={defaultRawCss} onChange={onDefaultRawCssChange} />
      </div>
    </div>
  );
}

// ─── Variant row (one entry in the bound mapping) ───────────────────────────

function VariantRow({
  entry, onChange, onDelete, onMoveUp, onMoveDown,
}: {
  entry: StyleMappingEntry;
  onChange: (p: Partial<StyleMappingEntry>) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const t = useT();
  const tt = t.styleOverride as any;
  const [expanded, setExpanded] = useState(true);

  const isRange = entry.matchType === 'range';

  return (
    <div className="border border-slate-700/60 rounded bg-slate-800/30">
      {/* Header row */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button
          type="button"
          className="text-slate-500 hover:text-slate-300 cursor-pointer w-4 text-xs"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? '▾' : '▸'}
        </button>

        {/* Match type toggle */}
        <div className="flex gap-0.5">
          <button
            type="button"
            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
              !isRange
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => onChange({ matchType: 'exact' })}
          >
            {tt.variantMatchExact}
          </button>
          <button
            type="button"
            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
              isRange
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => onChange({ matchType: 'range' })}
          >
            {tt.variantMatchRange}
          </button>
        </div>

        {/* Match inputs */}
        {!isRange && (
          <input
            type="number"
            className={INPUT_CLS + ' w-20 text-xs'}
            placeholder={tt.variantMatchValue}
            value={entry.value ?? ''}
            onChange={e => onChange({ value: e.target.value })}
          />
        )}
        {isRange && (
          <>
            <input
              type="number"
              className={INPUT_CLS + ' w-16 text-xs'}
              placeholder={tt.variantMatchMin}
              value={entry.rangeMin ?? ''}
              onChange={e => onChange({ rangeMin: e.target.value })}
            />
            <span className="text-slate-500 text-[10px]">…</span>
            <input
              type="number"
              className={INPUT_CLS + ' w-16 text-xs'}
              placeholder={tt.variantMatchMax}
              value={entry.rangeMax ?? ''}
              onChange={e => onChange({ rangeMax: e.target.value })}
            />
          </>
        )}

        <div className="flex-1" />

        {/* Reorder + delete */}
        <button
          type="button"
          disabled={!onMoveUp}
          onClick={onMoveUp}
          className="text-slate-500 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-xs px-1"
          title="Move up"
        >▲</button>
        <button
          type="button"
          disabled={!onMoveDown}
          onClick={onMoveDown}
          className="text-slate-500 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-xs px-1"
          title="Move down"
        >▼</button>
        <button
          type="button"
          onClick={onDelete}
          className="text-slate-500 hover:text-red-400 cursor-pointer text-xs px-1"
          title="Delete"
        >×</button>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-2 pb-2 flex flex-col gap-2 border-t border-slate-700/40">
          <FieldsEditor
            fields={entry.fields}
            onChange={fields => onChange({ fields })}
          />
          <RawCssEditor
            value={entry.rawCss ?? ''}
            onChange={rawCss => onChange({ rawCss })}
          />
        </div>
      )}
    </div>
  );
}

// ─── Field editors (reused across static, variant, default) ─────────────────

function FieldsEditor({
  fields, onChange,
}: {
  fields: Record<string, string | number | boolean> | undefined;
  onChange: (fields: Record<string, string | number | boolean>) => void;
}) {
  const t = useT();
  const tt = t.styleOverride as any;

  return (
    <div className="grid grid-cols-2 gap-2">
      {DIALOGUE_COLOR_FIELDS.map(f => (
        <div key={f.key}>
          <label className="block text-[11px] text-slate-400 mb-1">{tt[f.labelKey]}</label>
          <ColorSwatchInput
            value={readField(fields, f.key)}
            onChange={v => onChange(setField(fields, f.key, v))}
            allowClear
          />
        </div>
      ))}
    </div>
  );
}

function RawCssEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT();
  const tt = t.styleOverride as any;
  return (
    <div>
      <label className="block text-[11px] text-slate-400 mb-1">{tt.rawCssLabel}</label>
      <textarea
        className={INPUT_CLS + ' font-mono text-[11px] resize-y min-h-[80px]'}
        rows={4}
        placeholder={tt.rawCssPlaceholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        spellCheck={false}
      />
      <details className="mt-1 text-[10px] text-slate-500">
        <summary className="cursor-pointer hover:text-slate-300 select-none">{tt.rawCssHelpToggle}</summary>
        <div className="mt-1.5 pl-2 border-l border-slate-700 leading-relaxed">
          <p>{tt.rawCssHelpIntro}</p>
          <ul className="list-none space-y-0.5 mt-1">
            <li><code className="text-indigo-300 font-mono">.char-body</code> — {tt.rawCssSelectorBody}</li>
            <li><code className="text-indigo-300 font-mono">.char-name</code> — {tt.rawCssSelectorName}</li>
            <li><code className="text-indigo-300 font-mono">.char-text</code> — {tt.rawCssSelectorText}</li>
            <li><code className="text-indigo-300 font-mono">.char-avatar</code> — {tt.rawCssSelectorAvatar}</li>
          </ul>
          <div className="mt-2">
            <div className="text-slate-400 mb-0.5">{tt.rawCssExampleLabel}</div>
            <pre className="font-mono text-[10px] bg-slate-900/60 border border-slate-700 rounded p-2 whitespace-pre overflow-x-auto leading-snug">{`.char-body { border-radius: 12px; padding: 14px 18px; box-shadow: 0 2px 10px rgba(0,0,0,0.3); }
.char-name { font-family: 'Georgia', serif; letter-spacing: 0.04em; }
.char-text { line-height: 1.6; }`}</pre>
          </div>
        </div>
      </details>
    </div>
  );
}
