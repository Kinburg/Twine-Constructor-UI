import { useProjectStore } from '../../store/projectStore';
import type { PopupBlock } from '../../types';
import { useT } from '../../i18n';
import { BlockEffectsPanel } from './BlockEffectsPanel';

export function PopupBlockEditor({
  block,
  sceneId,
}: {
  block: PopupBlock;
  sceneId: string;
}) {
  const t = useT();
  const { project, updateBlock } = useProjectStore();

  const popupScenes = project.scenes.filter(
    s => s.id !== sceneId && s.tags.includes('popup'),
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Popup scene + title */}
      <div className="flex flex-col gap-2 bg-slate-800/50 border border-slate-700 rounded p-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 w-24 shrink-0">{t.popupBlock.sceneLabel}</label>
          {popupScenes.length === 0 ? (
            <span className="text-xs text-slate-500 italic">{t.popupBlock.noPopupScenes}</span>
          ) : (
            <select
              className="flex-1 bg-slate-800 text-xs text-white rounded px-2 py-1 border border-slate-600 focus:border-indigo-500 outline-none cursor-pointer"
              value={block.targetSceneId}
              onChange={e => updateBlock(sceneId, block.id, { targetSceneId: e.target.value })}
            >
              <option value="">— select —</option>
              {popupScenes.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 w-24 shrink-0">{t.popupBlock.titleLabel}</label>
          <input
            className="flex-1 bg-slate-800 text-xs text-white rounded px-2 py-1 border border-slate-600 focus:border-indigo-500 outline-none"
            placeholder={t.popupBlock.titlePlaceholder}
            value={block.title ?? ''}
            onChange={e => updateBlock(sceneId, block.id, { title: e.target.value })}
          />
        </div>
      </div>

      <BlockEffectsPanel
        delay={block.delay}
        onDelayChange={v => updateBlock(sceneId, block.id, { delay: v })}
      />
    </div>
  );
}
