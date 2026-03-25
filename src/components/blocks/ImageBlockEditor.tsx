import { useProjectStore, flattenAssets } from '../../store/projectStore';
import type { ImageBlock, ImageBoundMapping, Asset } from '../../types';
import { joinPath, toLocalFileUrl } from '../../lib/fsApi';
import { useT } from '../../i18n';
import { BlockEffectsPanel } from './BlockEffectsPanel';
import { VariablePicker } from '../shared/VariablePicker';

// ─── Asset image picker ───────────────────────────────────────────────────────
// Dropdown from registered assets + manual path/URL input.

function AssetPicker({
  imageAssets,
  value,
  onChange,
  placeholder = 'assets/img.png',
  small = false,
  noAssetLabel,
}: {
  imageAssets: Asset[];
  value: string;
  onChange: (src: string) => void;
  placeholder?: string;
  small?: boolean;
  noAssetLabel?: string;
}) {
  const t = useT();
  const matched = imageAssets.find(a => a.relativePath === value);
  const inputCls = small
    ? 'w-full bg-slate-800 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 focus:border-indigo-500 font-mono'
    : 'w-full bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500';
  const selectCls = small
    ? 'w-full bg-slate-800 text-xs text-white rounded px-1.5 py-0.5 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer'
    : 'w-full bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer';

  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      {imageAssets.length > 0 && (
        <select
          className={selectCls}
          value={matched?.id ?? ''}
          onChange={e => {
            const asset = imageAssets.find(a => a.id === e.target.value);
            if (asset) onChange(asset.relativePath);
            else if (e.target.value === '') onChange('');
          }}
        >
          <option value="">{noAssetLabel ?? t.imageBlock.noAssetOption}</option>
          {imageAssets.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      )}
      <input
        className={inputCls}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

// ─── Main editor ──────────────────────────────────────────────────────────────

export function ImageBlockEditor({
  block,
  sceneId,
  onUpdate,
}: {
  block: ImageBlock;
  sceneId: string;
  onUpdate?: (patch: Partial<ImageBlock>) => void;
}) {
  const { project, projectDir, updateBlock } = useProjectStore();
  const update = onUpdate ?? ((p: Partial<ImageBlock>) => updateBlock(sceneId, block.id, p as never));
  const t = useT();
  const imageAssets = flattenAssets(project.assetNodes).filter(a => a.assetType === 'image');
  const mode    = block.mode ?? 'static';
  const mapping = block.mapping ?? [];

  function resolvePreviewSrc(src: string): string {
    if (src.startsWith('assets/') && projectDir) {
      return toLocalFileUrl(joinPath(projectDir, src));
    }
    return src;
  }

  // ── Mapping helpers ────────────────────────────────────────────────────────

  const addMapping = () => {
    update({
      mapping: [...mapping, {
        id: crypto.randomUUID(),
        matchType: 'exact',
        value: '',
        rangeMin: '',
        rangeMax: '',
        src: '',
      } satisfies ImageBoundMapping],
    });
  };

  const patchMapping = (i: number, patch: Partial<ImageBoundMapping>) => {
    update({ mapping: mapping.map((m, j) => j === i ? { ...m, ...patch } : m) });
  };

  const removeMapping = (i: number) => {
    update({ mapping: mapping.filter((_, j) => j !== i) });
  };

  return (
    <div className="flex flex-col gap-2">

      {/* ── Mode selector ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{t.imageBlock.modeLabel}</label>
        <div className="flex gap-1">
          {([
            ['static', t.imageBlock.modeStatic],
            ['bound',  t.imageBlock.modeBound],
          ] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => update({ mode: m })}
              className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                mode === m
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Static mode ───────────────────────────────────────────────────── */}
      {mode === 'static' && (
        <>
          {imageAssets.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 w-20 shrink-0">{t.imageBlock.assetLabel}</label>
              <select
                className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
                value=""
                onChange={e => {
                  const asset = imageAssets.find(a => a.id === e.target.value);
                  if (asset) update({ src: asset.relativePath, alt: asset.name });
                }}
              >
                <option value="">{t.imageBlock.selectAsset}</option>
                {imageAssets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-20 shrink-0">{t.imageBlock.urlLabel}</label>
            <input
              className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
              placeholder={t.imageBlock.urlPlaceholder}
              value={block.src}
              onChange={e => update({ src: e.target.value })}
            />
          </div>

          {block.src && (
            <img
              src={resolvePreviewSrc(block.src)}
              alt={block.alt || 'preview'}
              className="max-h-32 object-contain rounded border border-slate-700"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </>
      )}

      {/* ── Bound mode ────────────────────────────────────────────────────── */}
      {mode === 'bound' && (
        <div className="flex flex-col gap-2 pl-2 border-l-2 border-indigo-800/50">

          {/* Variable selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-20 shrink-0">{t.imageBlock.variableLabel}</label>
            <VariablePicker
              value={block.variableId ?? ''}
              onChange={id => update({ variableId: id })}
              nodes={project.variableNodes}
              placeholder={t.imageBlock.selectVariable}
            />
          </div>

          {/* Mapping list */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{t.imageBlock.mappingsLabel}</span>
              <button
                className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                onClick={addMapping}
              >
                {t.imageBlock.addMapping}
              </button>
            </div>

            {mapping.length === 0 && (
              <p className="text-xs text-slate-600 italic">{t.imageBlock.noMappings}</p>
            )}

            {mapping.map((m, i) => {
              const mt = m.matchType ?? 'exact';
              return (
                <div key={m.id ?? i} className="flex flex-col gap-1.5 border border-slate-700/60 rounded p-1.5">

                  {/* Match type + delete */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500 shrink-0">{t.imageBlock.matchMode}</span>
                    <select
                      className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-0.5 outline-none border border-slate-600 cursor-pointer"
                      value={mt}
                      onChange={e => patchMapping(i, { matchType: e.target.value as 'exact' | 'range' })}
                    >
                      <option value="exact">{t.imageBlock.matchExact}</option>
                      <option value="range">{t.imageBlock.matchRange}</option>
                    </select>
                    <button
                      className="text-slate-600 hover:text-red-400 text-xs cursor-pointer shrink-0 ml-1"
                      onClick={() => removeMapping(i)}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Exact value */}
                  {mt === 'exact' && (
                    <div className="flex gap-1 items-center">
                      <span className="text-xs text-slate-500 shrink-0 w-12">{t.imageBlock.valueLabel}</span>
                      <input
                        className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 font-mono"
                        placeholder="100"
                        value={m.value}
                        onChange={e => patchMapping(i, { value: e.target.value })}
                      />
                    </div>
                  )}

                  {/* Range */}
                  {mt === 'range' && (
                    <div className="grid grid-cols-2 gap-1">
                      <div className="flex gap-1 items-center">
                        <span className="text-xs text-slate-500 shrink-0 w-12">{t.imageBlock.fromLabel}</span>
                        <input
                          className="flex-1 min-w-0 bg-slate-800 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 font-mono"
                          placeholder="0"
                          value={m.rangeMin ?? ''}
                          onChange={e => patchMapping(i, { rangeMin: e.target.value })}
                        />
                      </div>
                      <div className="flex gap-1 items-center">
                        <span className="text-xs text-slate-500 shrink-0">{t.imageBlock.toLabel}</span>
                        <input
                          className="flex-1 min-w-0 bg-slate-800 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 font-mono"
                          placeholder="20"
                          value={m.rangeMax ?? ''}
                          onChange={e => patchMapping(i, { rangeMax: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* File picker */}
                  <div className="flex gap-1 items-start">
                    <span className="text-xs text-slate-500 shrink-0 pt-1.5 w-12">{t.imageBlock.fileLabel}</span>
                    <AssetPicker
                      imageAssets={imageAssets}
                      value={m.src}
                      onChange={src => patchMapping(i, { src })}
                      small
                    />
                  </div>
                </div>
              );
            })}

            {/* Default / fallback image */}
            <div className="flex gap-1 items-start mt-0.5">
              <label className="text-xs text-slate-400 shrink-0 pt-1.5 w-20">{t.imageBlock.defaultLabel}</label>
              <AssetPicker
                imageAssets={imageAssets}
                value={block.defaultSrc ?? ''}
                onChange={defaultSrc => update({ defaultSrc })}
                small
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Shared fields (both modes) ─────────────────────────────────────── */}

      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{t.imageBlock.altLabel}</label>
        <input
          className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
          placeholder={t.imageBlock.altPlaceholder}
          value={block.alt}
          onChange={e => update({ alt: e.target.value })}
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{t.imageBlock.widthLabel}</label>
        <input
          type="number"
          className="w-24 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
          placeholder={t.imageBlock.widthPlaceholder}
          min={0}
          value={block.width || ''}
          onChange={e => update({ width: parseInt(e.target.value) || 0 })}
        />
      </div>
      <BlockEffectsPanel
        delay={block.delay}
        onDelayChange={v => update({ delay: v })}
      />
    </div>
  );
}
