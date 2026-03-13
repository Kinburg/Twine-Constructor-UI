import { useProjectStore } from '../../store/projectStore';
import { useT } from '../../i18n';
import type { DividerBlock } from '../../types';
import { BlockEffectsPanel } from './BlockEffectsPanel';

export function DividerBlockEditor({
  block,
  sceneId,
  onUpdate,
}: {
  block: DividerBlock;
  sceneId: string;
  onUpdate?: (patch: Partial<DividerBlock>) => void;
}) {
  const { updateBlock, saveSnapshot } = useProjectStore();
  const t = useT();
  const update = onUpdate ?? ((p: Partial<DividerBlock>) => updateBlock(sceneId, block.id, p as never));

  const color     = block.color     ?? '#555555';
  const thickness = block.thickness ?? 1;
  const marginV   = block.marginV   ?? 8;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Preview */}
      <hr style={{
        border: 'none',
        borderTop: `${thickness}px solid ${color}`,
        margin: `${marginV}px 0`,
      }} />

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">{t.dividerBlock.colorLabel}</span>
          <input
            type="color"
            value={color}
            onFocus={saveSnapshot}
            onChange={e => update({ color: e.target.value })}
            className="w-7 h-6 rounded cursor-pointer bg-transparent border border-slate-600 p-0.5"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">{t.dividerBlock.thicknessLabel}</span>
          <input
            type="number"
            min={1}
            step={1}
            value={thickness}
            onFocus={saveSnapshot}
            onChange={e => update({ thickness: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-14 bg-slate-800 text-slate-200 text-xs rounded px-2 py-0.5 border border-slate-600 outline-none focus:border-indigo-500"
          />
          <span className="text-xs text-slate-500">{t.dividerBlock.thicknessSuffix}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">{t.dividerBlock.marginLabel}</span>
          <input
            type="number"
            min={0}
            step={1}
            value={marginV}
            onFocus={saveSnapshot}
            onChange={e => update({ marginV: Math.max(0, parseInt(e.target.value) || 0) })}
            className="w-14 bg-slate-800 text-slate-200 text-xs rounded px-2 py-0.5 border border-slate-600 outline-none focus:border-indigo-500"
          />
          <span className="text-xs text-slate-500">{t.dividerBlock.marginSuffix}</span>
        </div>
      </div>

      <BlockEffectsPanel
        delay={block.delay}
        onDelayChange={v => update({ delay: v })}
      />
    </div>
  );
}
