import { useProjectStore } from '../../store/projectStore';
import type { RawBlock } from '../../types';

export function RawBlockEditor({
  block,
  sceneId,
  onUpdate,
}: {
  block: RawBlock;
  sceneId: string;
  onUpdate?: (patch: Partial<RawBlock>) => void;
}) {
  const { updateBlock } = useProjectStore();
  const update = onUpdate ?? ((p: Partial<RawBlock>) => updateBlock(sceneId, block.id, p as never));

  return (
    <div className="flex flex-col gap-1">
      <textarea
        className="w-full min-h-[80px] bg-slate-800 text-sm text-white font-mono rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500 resize-y leading-relaxed"
        placeholder={"<<set $x to 1>>\n<<audio 'theme' play>>\n..."}
        value={block.code}
        onChange={e => update({ code: e.target.value })}
        spellCheck={false}
      />
      <span className="text-xs text-slate-600 italic">Вставляется в экспорт как есть, без изменений</span>
    </div>
  );
}
