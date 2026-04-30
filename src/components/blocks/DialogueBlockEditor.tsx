import { useState, useEffect, useRef } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useProjectStore } from '../../store/projectStore';
import { useT } from '../../i18n';
import { toLocalFileUrl, resolveAssetPath } from '../../lib/fsApi';
import type {
  DialogueBlock, Block,
  TextBlock, VariableSetBlock, ImageBlock,
  VideoBlock, RawBlock, TableBlock, NoteBlock,
} from '../../types';
import { AddBlockMenu } from './AddBlockMenu';
import { TextBlockEditor } from './TextBlockEditor';
import { VariableSetBlockEditor } from './VariableSetBlockEditor';
import { ImageBlockEditor } from './ImageBlockEditor';
import { VideoBlockEditor } from './VideoBlockEditor';
import { RawBlockEditor } from './RawBlockEditor';
import { TableBlockEditor } from './TableBlockEditor';
import { NoteBlockEditor } from './NoteBlockEditor';
import { BlockEffectsPanel } from './BlockEffectsPanel';
import { TextInsertToolbar } from '../shared/TextInsertToolbar';
import { LLMGenerateButton } from '../shared/LLMGenerateButton';
import { flattenVariables, flattenAssets } from '../../utils/treeUtils';
import { useVariableNodes } from '../shared/VariableScope';
import { EmojiIcon } from '../shared/EmojiIcons';

/**
 * Converts an avatar src value to a URL the editor renderer can actually load:
 * - External http(s):// and data: URIs — used as-is
 * - Already-resolved localfile:// URLs — used as-is
 * - Relative asset paths (e.g. "assets/chars/hero.png") — converted to
 *   localfile:// using the project directory from the Electron store
 * - Relative path with no projectDir (project not yet saved) — returns ''
 *   so the editor falls back to the 👤 placeholder gracefully
 */
function resolveEditorSrc(src: string, projectDir: string | null): string {
  if (!src) return '';
  if (/^https?:\/\//i.test(src) || src.startsWith('data:') || src.startsWith('localfile://')) {
    return src;
  }
  if (projectDir) {
    return toLocalFileUrl(resolveAssetPath(projectDir, src));
  }
  return ''; // can't resolve local path without projectDir
}

// ─── Inner block renderer ──────────────────────────────────────────────────────

function InnerBlockEditor({
  block,
  sceneId,
  dialogueBlockId,
}: {
  block: Block;
  sceneId: string;
  dialogueBlockId: string;
}) {
  const { updateDialogueInnerBlock } = useProjectStore();
  const t = useT();
  const onUpdate = (patch: Partial<Block>) =>
    updateDialogueInnerBlock(sceneId, dialogueBlockId, block.id, patch);

  switch (block.type) {
    case 'text':
      return <TextBlockEditor block={block} sceneId={sceneId} onUpdate={onUpdate as (p: Partial<TextBlock>) => void} />;
    case 'variable-set':
      return <VariableSetBlockEditor block={block} sceneId={sceneId} onUpdate={onUpdate as (p: Partial<VariableSetBlock>) => void} />;
    case 'image':
      return <ImageBlockEditor block={block} sceneId={sceneId} onUpdate={onUpdate as (p: Partial<ImageBlock>) => void} />;
    case 'video':
      return <VideoBlockEditor block={block} sceneId={sceneId} onUpdate={onUpdate as (p: Partial<VideoBlock>) => void} />;
    case 'raw':
      return <RawBlockEditor block={block} sceneId={sceneId} onUpdate={onUpdate as (p: Partial<RawBlock>) => void} />;
    case 'table':
      return <TableBlockEditor block={block} sceneId={sceneId} onUpdate={onUpdate as (p: Partial<TableBlock>) => void} />;
    case 'note':
      return <NoteBlockEditor block={block} sceneId={sceneId} onUpdate={onUpdate as (p: Partial<NoteBlock>) => void} />;
    default:
      return <span className="text-xs text-slate-500">{t.block.unsupportedNested}</span>;
  }
}

// ─── Sortable inner block item ─────────────────────────────────────────────────

function SortableInnerBlock({
  block,
  sceneId,
  dialogueBlockId,
  onDelete,
}: {
  block: Block;
  sceneId: string;
  dialogueBlockId: string;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex gap-1 items-start group border border-slate-700/60 rounded bg-slate-900/40 p-1.5"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-slate-600 hover:text-slate-400 text-xs cursor-grab active:cursor-grabbing shrink-0 mt-0.5 px-0.5"
        title="Drag to reorder"
      >
        ⠿
      </button>

      {/* Block editor */}
      <div className="flex-1 min-w-0">
        <InnerBlockEditor block={block} sceneId={sceneId} dialogueBlockId={dialogueBlockId} />
      </div>

      {/* Delete */}
      <button
        className="text-slate-600 hover:text-red-400 text-xs cursor-pointer shrink-0 mt-0.5"
        onClick={onDelete}
        title="Delete"
      >
        <EmojiIcon name="close" size={20} />
      </button>
    </div>
  );
}

// ─── Inner blocks section ──────────────────────────────────────────────────────

function InnerBlocksList({
  block,
  sceneId,
}: {
  block: DialogueBlock;
  sceneId: string;
}) {
  const { addDialogueInnerBlock, deleteDialogueInnerBlock, reorderDialogueInnerBlocks } =
    useProjectStore();
  const t = useT();

  const innerBlocks = block.innerBlocks ?? [];

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = innerBlocks.findIndex(b => b.id === active.id);
    const newIdx = innerBlocks.findIndex(b => b.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    reorderDialogueInnerBlocks(sceneId, block.id, arrayMove(innerBlocks, oldIdx, newIdx));
  }

  return (
    <div className="flex flex-col gap-1 mt-1">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">
          {t.dialogueBlock.innerBlocksLabel}
        </span>
        <div className="flex-1 h-px bg-slate-700/60" />
      </div>

      {/* Blocks list */}
      {innerBlocks.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={innerBlocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-1">
              {innerBlocks.map(ib => (
                <SortableInnerBlock
                  key={ib.id}
                  block={ib}
                  sceneId={sceneId}
                  dialogueBlockId={block.id}
                  onDelete={() => deleteDialogueInnerBlock(sceneId, block.id, ib.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add block menu — exclude types that don't make sense inside a dialogue
          or would create circular imports (condition, choice, dialogue) */}
      <AddBlockMenu
        sceneId={sceneId}
        excludeTypes={['dialogue', 'condition', 'choice', 'button', 'input-field']}
        onAdd={newBlock => addDialogueInnerBlock(sceneId, block.id, newBlock)}
      />
    </div>
  );
}

// ─── Main editor ───────────────────────────────────────────────────────────────

export function DialogueBlockEditor({
  block,
  sceneId,
  onUpdate,
}: {
  block: DialogueBlock;
  sceneId: string;
  onUpdate?: (patch: Partial<DialogueBlock>) => void;
}) {
  const { project, projectDir, updateBlock, saveSnapshot } = useProjectStore();
  const t = useT();
  const variableNodes = useVariableNodes();
  const update = onUpdate ?? ((p: Partial<DialogueBlock>) => updateBlock(sceneId, block.id, p as never));
  const { characters } = project;
  const vars = flattenVariables(variableNodes);
  const imgAssets = flattenAssets(project.assetNodes).filter(a => a.assetType === 'image');
  const dialogueRef = useRef<HTMLTextAreaElement>(null);

  const selectedChar = characters.find(c => c.id === block.characterId);
  const align = block.align ?? 'left';
  const isRight = align === 'right';

  // Derive avatar preview source from avatarConfig (fallback to deprecated avatarUrl)
  const avatarCfg = selectedChar?.avatarConfig;
  const isBoundAvatar = avatarCfg?.mode === 'bound';
  const rawSrc = isBoundAvatar
    ? ''   // can't show a dynamic image in the editor
    : (avatarCfg?.src ?? selectedChar?.avatarUrl ?? '');
  const avatarPreviewSrc = resolveEditorSrc(rawSrc, projectDir);

  // Track if the resolved URL fails to load (e.g. file was deleted, bad URL, etc.)
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => {
    setImgFailed(false);
  }, [avatarPreviewSrc]);

  const showImg       = Boolean(avatarPreviewSrc) && !imgFailed;
  const showBound     = !showImg && Boolean(selectedChar) && isBoundAvatar;
  const showNoAvatar  = !showImg && Boolean(selectedChar) && !isBoundAvatar;

  // Inline preview: body style
  const bodyStyle = selectedChar ? {
    background: selectedChar.bgColor,
    borderLeft:  isRight ? undefined           : `4px solid ${selectedChar.borderColor}`,
    borderRight: isRight ? `4px solid ${selectedChar.borderColor}` : undefined,
    borderRadius: '4px',
    padding: '6px 10px',
    flex: 1,
  } : { flex: 1 };

  return (
    <div className="flex flex-col gap-2">

      {/* Character selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{t.dialogueBlock.characterLabel}</label>
        <select
          className="flex-1 bg-slate-800 text-slate-200 text-sm rounded px-2 py-1 border border-slate-600 focus:border-indigo-500 outline-none cursor-pointer"
          value={block.characterId}
          onChange={e => update({ characterId: e.target.value })}
        >
          <option value="">{t.dialogueBlock.selectChar}</option>
          {characters.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {characters.length === 0 && (
          <span className="text-xs text-slate-500 italic">{t.dialogueBlock.noCharacters}</span>
        )}
      </div>

      {/* Alignment toggle */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{t.dialogueBlock.sideLabel}</label>
        <div className="flex gap-1">
          <button
            className={`text-xs px-3 py-1 rounded border transition-colors cursor-pointer ${
              !isRight
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
            onClick={() => update({ align: 'left' })}
          >
            {t.dialogueBlock.sideLeft}
          </button>
          <button
            className={`text-xs px-3 py-1 rounded border transition-colors cursor-pointer ${
              isRight
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
            onClick={() => update({ align: 'right' })}
          >
            {t.dialogueBlock.sideRight}
          </button>
        </div>
      </div>

      {/* Name suffix */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{t.dialogueBlock.nameSuffixLabel}</label>
        <input
          className="flex-1 bg-slate-800 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:border-indigo-500 outline-none placeholder-slate-600"
          placeholder={t.dialogueBlock.nameSuffixPlaceholder}
          value={block.nameSuffix ?? ''}
          onFocus={saveSnapshot}
          onChange={e => update({ nameSuffix: e.target.value })}
        />
      </div>

      {/* Live update toggle */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{t.dialogueBlock.liveUpdateLabel}</label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={block.live ?? false}
            onChange={e => update({ live: e.target.checked })}
            className="accent-indigo-500 cursor-pointer"
          />
          <span className="text-xs text-slate-400">{t.dialogueBlock.liveUpdateDesc} <span className="font-mono text-slate-500">&lt;&lt;live&gt;&gt;</span></span>
        </label>
      </div>

      {/* Text + preview */}
      <div className={`flex gap-2 items-start ${isRight ? 'flex-row-reverse' : ''}`}>
        {/* Avatar thumbnail */}
        {showImg && (
          <img
            src={avatarPreviewSrc}
            className="w-10 h-10 object-cover rounded flex-shrink-0"
            alt=""
            onError={() => setImgFailed(true)}
          />
        )}
        {showBound && (
          <div
            className="w-10 h-10 rounded flex-shrink-0 bg-slate-700 flex items-center justify-center text-slate-500 text-xs"
            title={t.dialogueBlock.dynamicAvatarTitle}
          >
            <EmojiIcon name="chart" size={20} />
          </div>
        )}
        {showNoAvatar && (
          <div className="w-10 h-10 rounded flex-shrink-0 bg-slate-700 flex items-center justify-center text-slate-500 text-xs">
            <EmojiIcon name="person" size={20} />
          </div>
        )}

        {/* Name + text area */}
        <div style={bodyStyle} className="relative">
          {selectedChar && (
            <span className="text-xs font-bold block mb-1" style={{ color: selectedChar.nameColor, textAlign: isRight ? 'right' : 'left' }}>
              {selectedChar.name}{block.nameSuffix ? ` (${block.nameSuffix})` : ''}
            </span>
          )}
          <div className={`absolute top-0.5 z-10 flex gap-0.5 ${isRight ? 'left-0.5' : 'right-0.5'}`}>
            <LLMGenerateButton
              sceneId={sceneId}
              blockId={block.id}
              currentValue={block.text}
              onGenerated={text => update({ text })}
              onStreaming={text => update({ text })}
            />
            <TextInsertToolbar
              targetRef={dialogueRef}
              value={block.text}
              onChange={text => update({ text })}
              vars={vars}
              imageAssets={imgAssets}
              variableNodes={variableNodes}
              scenes={project.scenes}
            />
          </div>
          <textarea
            ref={dialogueRef}
            className={`w-full bg-transparent text-sm rounded px-0 py-0 outline-none min-h-[60px] placeholder-slate-500 ${isRight ? 'pl-20' : 'pr-20'}`}
            style={{ color: selectedChar ? (selectedChar.textColor ?? '#e2e8f0') : undefined }}
            placeholder={t.dialogueBlock.linePlaceholder}
            value={block.text}
            onFocus={saveSnapshot}
            onChange={e => update({ text: e.target.value })}
          />
        </div>
      </div>

      {/* Inner blocks — only when not used as a nested block inside a condition
          (onUpdate is set when called from ConditionBlockEditor) */}
      {!onUpdate && (
        <InnerBlocksList block={block} sceneId={sceneId} />
      )}

      <BlockEffectsPanel
        delay={block.delay}
        typewriter={block.typewriter}
        onDelayChange={v => update({ delay: v })}
        onTypewriterChange={v => update({ typewriter: v })}
      />
    </div>
  );
}
