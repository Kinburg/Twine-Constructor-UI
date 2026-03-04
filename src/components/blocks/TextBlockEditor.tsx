import { useProjectStore } from '../../store/projectStore';
import type { TextBlock } from '../../types';

export function TextBlockEditor({ block, sceneId }: { block: TextBlock; sceneId: string }) {
  const { updateBlock } = useProjectStore();
  return (
    <textarea
      className="w-full bg-slate-800 text-slate-200 text-sm rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500 min-h-[80px]"
      placeholder="Введите нарративный текст..."
      value={block.content}
      onChange={e => updateBlock(sceneId, block.id, { content: e.target.value })}
    />
  );
}
