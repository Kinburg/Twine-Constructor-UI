import { useProjectStore } from '../../store/projectStore';
import type { TextBlock } from '../../types';

export function TextBlockEditor({
  block,
  sceneId,
  onUpdate,
}: {
  block: TextBlock;
  sceneId: string;
  onUpdate?: (patch: Partial<TextBlock>) => void;
}) {
  const { updateBlock, saveSnapshot } = useProjectStore();
  const update = onUpdate ?? ((p: Partial<TextBlock>) => updateBlock(sceneId, block.id, p as never));

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        className="w-full bg-slate-800 text-slate-200 text-sm rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500 min-h-[80px]"
        placeholder="Введите нарративный текст..."
        value={block.content}
        onFocus={saveSnapshot}
        onChange={e => update({ content: e.target.value })}
      />
      <label className="flex items-center gap-2 cursor-pointer select-none mt-0.5">
        <input
          type="checkbox"
          checked={block.live ?? false}
          onChange={e => update({ live: e.target.checked })}
          className="accent-indigo-500 cursor-pointer"
        />
        <span className="text-xs text-slate-400">Живое обновление <span className="font-mono text-slate-500">&lt;&lt;live&gt;&gt;</span></span>
      </label>
    </div>
  );
}
