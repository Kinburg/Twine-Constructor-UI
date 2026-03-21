import { useRef } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useT } from '../../i18n';
import type { TextBlock } from '../../types';
import { BlockEffectsPanel } from './BlockEffectsPanel';
import { TextInsertToolbar } from '../shared/TextInsertToolbar';
import { flattenVariables, flattenAssets } from '../../utils/treeUtils';

export function TextBlockEditor({
  block,
  sceneId,
  onUpdate,
}: {
  block: TextBlock;
  sceneId: string;
  onUpdate?: (patch: Partial<TextBlock>) => void;
}) {
  const { updateBlock, saveSnapshot, project } = useProjectStore();
  const t = useT();
  const update = onUpdate ?? ((p: Partial<TextBlock>) => updateBlock(sceneId, block.id, p as never));
  const vars = flattenVariables(project.variableNodes);
  const imgAssets = flattenAssets(project.assetNodes).filter(a => a.assetType === 'image');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <div className="absolute top-1 right-1 z-10">
          <TextInsertToolbar
            targetRef={textareaRef}
            value={block.content}
            onChange={content => update({ content })}
            vars={vars}
            imageAssets={imgAssets}
          />
        </div>
        <textarea
          ref={textareaRef}
          className="w-full bg-slate-800 text-slate-200 text-sm rounded px-2 py-1.5 pr-24 outline-none border border-slate-600 focus:border-indigo-500 min-h-[80px]"
          placeholder={t.textBlock.placeholder}
          value={block.content}
          onFocus={saveSnapshot}
          onChange={e => update({ content: e.target.value })}
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none mt-0.5">
        <input
          type="checkbox"
          checked={block.live ?? false}
          onChange={e => update({ live: e.target.checked })}
          className="accent-indigo-500 cursor-pointer"
        />
        <span className="text-xs text-slate-400">{t.textBlock.liveUpdateLabel} <span className="font-mono text-slate-500">&lt;&lt;live&gt;&gt;</span></span>
      </label>
      <BlockEffectsPanel
        delay={block.delay}
        typewriter={block.typewriter}
        onDelayChange={v => update({ delay: v })}
        onTypewriterChange={v => update({ typewriter: v })}
      />
    </div>
  );
}
