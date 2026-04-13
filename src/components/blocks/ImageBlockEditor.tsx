import { useProjectStore, flattenAssets } from '../../store/projectStore';
import type { ImageBlock } from '../../types';
import { toLocalFileUrl, resolveAssetPath } from '../../lib/fsApi';
import { useT } from '../../i18n';
import { BlockEffectsPanel } from './BlockEffectsPanel';
import { VariablePicker } from '../shared/VariablePicker';
import { ImageMappingEditor } from '../shared/ImageMappingEditor';

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
      return toLocalFileUrl(resolveAssetPath(projectDir, src));
    }
    return src;
  }


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

          <ImageMappingEditor
            mapping={mapping}
            onChange={mapping => update({ mapping })}
            defaultSrc={block.defaultSrc ?? ''}
            onDefaultSrcChange={defaultSrc => update({ defaultSrc })}
            assets={imageAssets}
          />
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
