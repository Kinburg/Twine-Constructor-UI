import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useProjectStore } from '../../store/projectStore';
import { useEditorStore } from '../../store/editorStore';
import { useEditorPrefsStore } from '../../store/editorPrefsStore';
import { useConfirm } from '../shared/ConfirmModal';
import { useT, blockTypeLabel } from '../../i18n';
import type { Block } from '../../types';
import { TextBlockEditor } from './TextBlockEditor';
import { DialogueBlockEditor } from './DialogueBlockEditor';
import { ChoiceBlockEditor } from './ChoiceBlockEditor';
import { ConditionBlockEditor } from './ConditionBlockEditor';
import { VariableSetBlockEditor } from './VariableSetBlockEditor';
import { ImageBlockEditor } from './ImageBlockEditor';
import { ImageGenBlockEditor } from './ImageGenBlockEditor';
import { VideoBlockEditor } from './VideoBlockEditor';
import { ButtonBlockEditor } from './ButtonBlockEditor';
import { LinkBlockEditor } from './LinkBlockEditor';
import { InputFieldBlockEditor } from './InputFieldBlockEditor';
import { RawBlockEditor } from './RawBlockEditor';
import { NoteBlockEditor } from './NoteBlockEditor';
import { TableBlockEditor } from './TableBlockEditor';
import { DividerBlockEditor } from './DividerBlockEditor';
import { IncludeBlockEditor } from './IncludeBlockEditor';
import { CheckboxBlockEditor } from './CheckboxBlockEditor';
import { RadioBlockEditor } from './RadioBlockEditor';
import { FunctionBlockEditor } from './FunctionBlockEditor';
import { PopupBlockEditor } from './PopupBlockEditor';
import { AudioBlockEditor } from './AudioBlockEditor';

const BLOCK_COLORS: Record<Block['type'], string> = {
  'text':         'bg-slate-700',
  'dialogue':     'bg-indigo-900/40',
  'choice':       'bg-emerald-900/40',
  'condition':    'bg-amber-900/40',
  'variable-set': 'bg-purple-900/40',
  'button':       'bg-blue-900/40',
  'link':         'bg-emerald-900/40',
  'input-field':  'bg-teal-900/40',
  'image':        'bg-pink-900/40',
  'image-gen':    'bg-fuchsia-900/30',
  'video':        'bg-red-900/40',
  'raw':          'bg-zinc-700/60',
  'note':         'bg-amber-950/60',
  'table':        'bg-cyan-900/40',
  'include':      'bg-sky-900/40',
  'divider':      'bg-slate-700/40',
  'checkbox':     'bg-violet-900/40',
  'radio':        'bg-fuchsia-900/40',
  'function':     'bg-purple-900/40',
  'popup':        'bg-blue-900/40',
  'audio':        'bg-amber-900/40',
};

interface Props {
  block: Block;
  sceneId: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function BlockItem({ block, sceneId, collapsed, onToggleCollapse }: Props) {
  const { deleteBlock, duplicateBlock } = useProjectStore();
  const { copyToClipboard } = useEditorStore();
  const confirmDeleteBlock = useEditorPrefsStore(s => s.confirmDeleteBlock);
  const { ask, modal: confirmModal } = useConfirm();
  const t = useT();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const color = BLOCK_COLORS[block.type];
  const label = blockTypeLabel(t, block.type);
  const border = block.type === 'note' ? 'border-amber-800/50' : 'border-slate-700';

  return (
    <>
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded border ${border} ${color} overflow-hidden`}
    >
      {/* Block header */}
      <div className="block-header flex items-center justify-between px-3 py-1.5 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <span
            {...listeners}
            {...attributes}
            className="drag-handle text-slate-500 hover:text-slate-300 text-sm select-none cursor-grab active:cursor-grabbing"
            title={t.block.drag}
          >
            ⠿
          </span>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="text-slate-600 hover:text-slate-300 text-sm transition-colors cursor-pointer"
            title={collapsed ? t.block.expand : t.block.collapse}
            onClick={onToggleCollapse}
          >
            {collapsed ? '▸' : '▾'}
          </button>
          <button
            className="text-slate-600 hover:text-slate-300 text-sm transition-colors cursor-pointer"
            title={t.block.copy}
            onClick={() => copyToClipboard(block)}
          >
            📋
          </button>
          <button
            className="text-slate-600 hover:text-indigo-400 text-sm transition-colors cursor-pointer"
            title={t.block.duplicate}
            onClick={() => duplicateBlock(sceneId, block.id)}
          >
            ⧉
          </button>
          <button
            className="text-slate-600 hover:text-red-400 text-sm transition-colors cursor-pointer"
            title={t.block.delete}
            onClick={() => {
              if (confirmDeleteBlock) {
                ask({ message: `${t.block.delete}?`, variant: 'danger' }, () => deleteBlock(sceneId, block.id));
              } else {
                deleteBlock(sceneId, block.id);
              }
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Block body */}
      {!collapsed && <div className="block-body p-3">
        {block.type === 'text'         && <TextBlockEditor        block={block} sceneId={sceneId} />}
        {block.type === 'dialogue'     && <DialogueBlockEditor    block={block} sceneId={sceneId} />}
        {block.type === 'choice'       && <ChoiceBlockEditor      block={block} sceneId={sceneId} />}
        {block.type === 'condition'    && <ConditionBlockEditor   block={block} sceneId={sceneId} />}
        {block.type === 'variable-set' && <VariableSetBlockEditor block={block} sceneId={sceneId} />}
        {block.type === 'image'        && <ImageBlockEditor       block={block} sceneId={sceneId} />}
        {block.type === 'image-gen'    && <ImageGenBlockEditor    block={block} sceneId={sceneId} />}
        {block.type === 'video'        && <VideoBlockEditor       block={block} sceneId={sceneId} />}
        {block.type === 'button'       && <ButtonBlockEditor      block={block} sceneId={sceneId} />}
        {block.type === 'link'         && <LinkBlockEditor        block={block} sceneId={sceneId} />}
        {block.type === 'input-field'  && <InputFieldBlockEditor  block={block} sceneId={sceneId} />}
        {block.type === 'raw'          && <RawBlockEditor         block={block} sceneId={sceneId} />}
        {block.type === 'note'         && <NoteBlockEditor        block={block} sceneId={sceneId} />}
        {block.type === 'table'        && <TableBlockEditor       block={block} sceneId={sceneId} />}
        {block.type === 'include'      && <IncludeBlockEditor     block={block} sceneId={sceneId} />}
        {block.type === 'divider'      && <DividerBlockEditor     block={block} sceneId={sceneId} />}
        {block.type === 'checkbox'     && <CheckboxBlockEditor    block={block} sceneId={sceneId} />}
        {block.type === 'radio'        && <RadioBlockEditor       block={block} sceneId={sceneId} />}
        {block.type === 'function'     && <FunctionBlockEditor    block={block} sceneId={sceneId} />}
        {block.type === 'popup'        && <PopupBlockEditor       block={block} sceneId={sceneId} />}
        {block.type === 'audio'        && <AudioBlockEditor       block={block} sceneId={sceneId} />}
      </div>}
    </div>
    {confirmModal}
    </>
  );
}
