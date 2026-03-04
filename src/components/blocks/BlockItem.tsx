import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useProjectStore } from '../../store/projectStore';
import type { Block } from '../../types';
import { TextBlockEditor } from './TextBlockEditor';
import { DialogueBlockEditor } from './DialogueBlockEditor';
import { ChoiceBlockEditor } from './ChoiceBlockEditor';
import { ConditionBlockEditor } from './ConditionBlockEditor';
import { VariableSetBlockEditor } from './VariableSetBlockEditor';
import { ImageBlockEditor } from './ImageBlockEditor';
import { VideoBlockEditor } from './VideoBlockEditor';
import { ButtonBlockEditor } from './ButtonBlockEditor';
import { InputFieldBlockEditor } from './InputFieldBlockEditor';

const BLOCK_LABELS: Record<Block['type'], { label: string; color: string }> = {
  'text':         { label: 'Текст',       color: 'bg-slate-700' },
  'dialogue':     { label: 'Диалог',      color: 'bg-indigo-900/40' },
  'choice':       { label: 'Выбор',       color: 'bg-emerald-900/40' },
  'condition':    { label: 'Условие',     color: 'bg-amber-900/40' },
  'variable-set': { label: 'Переменная',  color: 'bg-purple-900/40' },
  'button':       { label: 'Кнопка',      color: 'bg-blue-900/40' },
  'input-field':  { label: 'Поле ввода',  color: 'bg-teal-900/40' },
  'image':        { label: 'Картинка',    color: 'bg-pink-900/40' },
  'video':        { label: 'Видео',       color: 'bg-red-900/40' },
};

interface Props {
  block: Block;
  sceneId: string;
}

export function BlockItem({ block, sceneId }: Props) {
  const { deleteBlock } = useProjectStore();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const { label, color } = BLOCK_LABELS[block.type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded border border-slate-700 ${color} overflow-hidden`}
    >
      {/* Block header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <span
            {...listeners}
            {...attributes}
            className="drag-handle text-slate-500 hover:text-slate-300 text-sm select-none"
            title="Перетащить"
          >
            ⠿
          </span>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
        </div>
        <button
          className="text-slate-600 hover:text-red-400 text-sm transition-colors cursor-pointer"
          title="Удалить блок"
          onClick={() => deleteBlock(sceneId, block.id)}
        >
          ✕
        </button>
      </div>

      {/* Block body */}
      <div className="p-3">
        {block.type === 'text'         && <TextBlockEditor        block={block} sceneId={sceneId} />}
        {block.type === 'dialogue'     && <DialogueBlockEditor    block={block} sceneId={sceneId} />}
        {block.type === 'choice'       && <ChoiceBlockEditor      block={block} sceneId={sceneId} />}
        {block.type === 'condition'    && <ConditionBlockEditor   block={block} sceneId={sceneId} />}
        {block.type === 'variable-set' && <VariableSetBlockEditor block={block} sceneId={sceneId} />}
        {block.type === 'image'        && <ImageBlockEditor       block={block} sceneId={sceneId} />}
        {block.type === 'video'        && <VideoBlockEditor       block={block} sceneId={sceneId} />}
        {block.type === 'button'       && <ButtonBlockEditor       block={block} sceneId={sceneId} />}
        {block.type === 'input-field'  && <InputFieldBlockEditor  block={block} sceneId={sceneId} />}
      </div>
    </div>
  );
}
