import { useState } from 'react';
import type { ImageBoundMapping, Asset } from '../../types';
import { useT } from '../../i18n';

// ─── Shared image asset picker ────────────────────────────────────────────────
// Select from registered assets + manual path/URL input.

export function ImageAssetPicker({
  assets,
  value,
  onChange,
  placeholder = 'assets/img.png',
}: {
  assets: Asset[];
  value: string;
  onChange: (src: string) => void;
  placeholder?: string;
}) {
  const t = useT();
  const matched = assets.find(a => a.relativePath === value);

  return (
    <div className="flex-1 flex flex-col gap-1 min-w-0">
      {assets.length > 0 && (
        <select
          className="w-full bg-slate-800 text-xs text-white rounded px-1.5 py-0.5 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
          value={matched?.id ?? ''}
          onChange={e => {
            const asset = assets.find(a => a.id === e.target.value);
            if (asset) onChange(asset.relativePath);
            else if (e.target.value === '') onChange('');
          }}
        >
          <option value="">{t.imageMappingEditor.selectAsset}</option>
          {assets.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      )}
      <input
        className="w-full bg-slate-800 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 focus:border-indigo-500 font-mono"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

// ─── Mapping entry row ────────────────────────────────────────────────────────

function MappingEntry({
  m, assets, onChange, onDelete,
}: {
  m: ImageBoundMapping;
  assets: Asset[];
  onChange: (patch: Partial<ImageBoundMapping>) => void;
  onDelete: () => void;
}) {
  const t = useT();
  const mt = m.matchType ?? 'exact';
  const isEmpty = !m.src;

  return (
    <div className={`flex flex-col gap-1 border rounded p-1.5 ${isEmpty ? 'border-red-500/40' : 'border-slate-700/60'}`}>
      <div className="flex items-center gap-1">
        <select
          className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-0.5 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
          value={mt}
          onChange={e => onChange({ matchType: e.target.value as 'exact' | 'range' })}
        >
          <option value="exact">{t.imageMappingEditor.matchExact}</option>
          <option value="range">{t.imageMappingEditor.matchRange}</option>
        </select>
        <button
          className="text-slate-600 hover:text-red-400 text-xs cursor-pointer shrink-0 ml-1"
          onClick={onDelete}
        >✕</button>
      </div>

      {mt === 'exact' && (
        <div className="flex gap-1 items-center">
          <span className="text-xs text-slate-500 shrink-0 w-10">{t.imageMappingEditor.valueLabel}</span>
          <input
            className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 font-mono"
            placeholder="100"
            value={m.value}
            onChange={e => onChange({ value: e.target.value })}
          />
        </div>
      )}

      {mt === 'range' && (
        <div className="grid grid-cols-2 gap-1">
          <div className="flex gap-1 items-center">
            <span className="text-xs text-slate-500 shrink-0 w-6">{t.imageMappingEditor.fromLabel}</span>
            <input
              className="flex-1 min-w-0 bg-slate-800 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 font-mono"
              placeholder="0"
              value={m.rangeMin ?? ''}
              onChange={e => onChange({ rangeMin: e.target.value })}
            />
          </div>
          <div className="flex gap-1 items-center">
            <span className="text-xs text-slate-500 shrink-0">{t.imageMappingEditor.toLabel}</span>
            <input
              className="flex-1 min-w-0 bg-slate-800 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 font-mono"
              placeholder="20"
              value={m.rangeMax ?? ''}
              onChange={e => onChange({ rangeMax: e.target.value })}
            />
          </div>
        </div>
      )}

      <div className="flex gap-1 items-start">
        <span className="text-xs text-slate-500 shrink-0 pt-1.5 w-10">{t.imageMappingEditor.fileLabel}</span>
        <ImageAssetPicker assets={assets} value={m.src} onChange={src => onChange({ src })} />
      </div>
    </div>
  );
}

// ─── Generator helpers ────────────────────────────────────────────────────────

function generateRangeSlots(min: number, max: number, count: number): ImageBoundMapping[] {
  const step = (max - min) / count;
  return Array.from({ length: count }, (_, i) => ({
    id: crypto.randomUUID(),
    matchType: 'range' as const,
    value: '',
    rangeMin: String(Math.round(min + i * step)),
    rangeMax: i === count - 1
      ? String(max)
      : String(Math.round(min + (i + 1) * step) - 1),
    src: '',
  }));
}

function generateExactSlots(valuesStr: string): ImageBoundMapping[] {
  return valuesStr
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
    .map(value => ({
      id: crypto.randomUUID(),
      matchType: 'exact' as const,
      value,
      rangeMin: '',
      rangeMax: '',
      src: '',
    }));
}

// ─── Generator panel ──────────────────────────────────────────────────────────

function GeneratorPanel({
  onReplace, onAppend,
}: {
  onReplace: (slots: ImageBoundMapping[]) => void;
  onAppend: (slots: ImageBoundMapping[]) => void;
}) {
  const t = useT();
  const [rangeMin, setRangeMin] = useState('0');
  const [rangeMax, setRangeMax] = useState('100');
  const [count, setCount] = useState('10');
  const [exactValues, setExactValues] = useState('');

  const minN = parseFloat(rangeMin);
  const maxN = parseFloat(rangeMax);
  const countN = parseInt(count, 10);
  const rangeValid = !isNaN(minN) && !isNaN(maxN) && !isNaN(countN)
    && minN < maxN && countN >= 1 && countN <= 100;
  const step = rangeValid ? (maxN - minN) / countN : null;

  const exactSlots = exactValues.split(',').map(v => v.trim()).filter(Boolean);
  const exactValid = exactSlots.length > 0;

  const inputCls = 'bg-slate-800 text-xs text-white rounded px-1.5 py-0.5 outline-none border border-slate-600 focus:border-indigo-500 font-mono';
  const btnPrimary = 'text-xs px-2 py-0.5 rounded bg-indigo-700 hover:bg-indigo-600 text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
  const btnSecondary = 'text-xs px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

  return (
    <div className="flex flex-col gap-2 border border-slate-600/50 rounded p-2 bg-slate-900/40">

      {/* ── Range generator ── */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-slate-400 font-medium">{t.imageMappingEditor.genByRange}</span>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex gap-1 items-center">
            <span className="text-xs text-slate-500 shrink-0">{t.imageMappingEditor.genMin}</span>
            <input type="number" className={`w-14 ${inputCls}`} value={rangeMin} onChange={e => setRangeMin(e.target.value)} />
          </div>
          <div className="flex gap-1 items-center">
            <span className="text-xs text-slate-500 shrink-0">{t.imageMappingEditor.genMax}</span>
            <input type="number" className={`w-14 ${inputCls}`} value={rangeMax} onChange={e => setRangeMax(e.target.value)} />
          </div>
          <div className="flex gap-1 items-center">
            <span className="text-xs text-slate-500 shrink-0">{t.imageMappingEditor.genCount}</span>
            <input type="number" min={1} max={100} className={`w-12 ${inputCls}`} value={count} onChange={e => setCount(e.target.value)} />
          </div>
        </div>
        {rangeValid && step !== null && (
          <span className="text-xs text-slate-500 italic">
            {t.imageMappingEditor.genStepPreview(step, countN)}
          </span>
        )}
        <div className="flex gap-1">
          <button
            className={btnPrimary}
            disabled={!rangeValid}
            onClick={() => rangeValid && onReplace(generateRangeSlots(minN, maxN, countN))}
          >{t.imageMappingEditor.genReplace}</button>
          <button
            className={btnSecondary}
            disabled={!rangeValid}
            onClick={() => rangeValid && onAppend(generateRangeSlots(minN, maxN, countN))}
          >{t.imageMappingEditor.genAppend}</button>
        </div>
      </div>

      <div className="border-t border-slate-700/60" />

      {/* ── Exact values generator ── */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-slate-400 font-medium">{t.imageMappingEditor.genByValues}</span>
        <input
          className={`w-full ${inputCls}`}
          placeholder={t.imageMappingEditor.genValuesPlaceholder}
          value={exactValues}
          onChange={e => setExactValues(e.target.value)}
        />
        {exactValid && (
          <span className="text-xs text-slate-500 italic">
            {t.imageMappingEditor.genValuesPreview(exactSlots.length)}
          </span>
        )}
        <div className="flex gap-1">
          <button
            className={btnPrimary}
            disabled={!exactValid}
            onClick={() => onReplace(generateExactSlots(exactValues))}
          >{t.imageMappingEditor.genReplace}</button>
          <button
            className={btnSecondary}
            disabled={!exactValid}
            onClick={() => onAppend(generateExactSlots(exactValues))}
          >{t.imageMappingEditor.genAppend}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ImageMappingEditor({
  mapping,
  onChange,
  defaultSrc,
  onDefaultSrcChange,
  assets,
}: {
  mapping: ImageBoundMapping[];
  onChange: (mapping: ImageBoundMapping[]) => void;
  defaultSrc: string;
  onDefaultSrcChange: (src: string) => void;
  assets: Asset[];
}) {
  const t = useT();
  const [showGenerator, setShowGenerator] = useState(false);

  const addOne = () => onChange([...mapping, {
    id: crypto.randomUUID(),
    matchType: 'exact',
    value: '',
    rangeMin: '',
    rangeMax: '',
    src: '',
  }]);

  const patch = (i: number, p: Partial<ImageBoundMapping>) =>
    onChange(mapping.map((m, j) => j === i ? { ...m, ...p } : m));

  const remove = (i: number) => onChange(mapping.filter((_, j) => j !== i));

  const emptyCount = mapping.filter(m => !m.src).length;

  return (
    <div className="flex flex-col gap-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">{t.imageMappingEditor.mappingsLabel}</span>
          {emptyCount > 0 && (
            <span className="text-xs text-red-400/70">({t.imageMappingEditor.emptySlots(emptyCount)})</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className={`text-xs cursor-pointer px-1.5 py-0.5 rounded transition-colors ${
              showGenerator
                ? 'bg-indigo-700 text-white'
                : 'text-slate-400 hover:text-indigo-300 border border-slate-600 hover:border-indigo-500'
            }`}
            onClick={() => setShowGenerator(v => !v)}
          >
            {t.imageMappingEditor.generateBtn}
          </button>
          <button
            className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
            onClick={addOne}
          >
            {t.imageMappingEditor.addOne}
          </button>
        </div>
      </div>

      {/* Generator panel */}
      {showGenerator && (
        <GeneratorPanel
          onReplace={slots => { onChange(slots); setShowGenerator(false); }}
          onAppend={slots => onChange([...mapping, ...slots])}
        />
      )}

      {/* Mapping list */}
      {mapping.length === 0 && !showGenerator && (
        <p className="text-xs text-slate-600 italic">{t.imageMappingEditor.noMappings}</p>
      )}
      {mapping.map((m, i) => (
        <MappingEntry
          key={m.id ?? i}
          m={m}
          assets={assets}
          onChange={p => patch(i, p)}
          onDelete={() => remove(i)}
        />
      ))}

      {/* Default / fallback */}
      <div className="flex flex-col gap-1 mt-0.5">
        <span className="text-xs text-slate-400">{t.imageMappingEditor.defaultLabel}</span>
        <ImageAssetPicker assets={assets} value={defaultSrc} onChange={onDefaultSrcChange} />
      </div>
    </div>
  );
}
