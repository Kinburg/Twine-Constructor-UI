import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useProjectStore, flattenVariables } from '../../store/projectStore';
import { useEditorStore } from '../../store/editorStore';
import { useT, blockTypeLabel } from '../../i18n';
import type {
  ConditionBlock, ConditionBranchType, ConditionOperator, Block,
  TextBlock, DialogueBlock, ChoiceBlock, VariableSetBlock, ImageBlock, VideoBlock, RawBlock,
} from '../../types';
import { AddBlockMenu } from './AddBlockMenu';
import { TextBlockEditor } from './TextBlockEditor';
import { DialogueBlockEditor } from './DialogueBlockEditor';
import { ChoiceBlockEditor } from './ChoiceBlockEditor';
import { VariableSetBlockEditor } from './VariableSetBlockEditor';
import { ImageBlockEditor } from './ImageBlockEditor';
import { VideoBlockEditor } from './VideoBlockEditor';
import { RawBlockEditor } from './RawBlockEditor';

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: '==', label: '==' },
  { value: '!=', label: '!=' },
  { value: '>',  label: '>'  },
  { value: '<',  label: '<'  },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
];

/** Returns only the operators valid for the given variable type.
 *  boolean / string → == and != only (no arithmetic comparison)
 *  number / unknown → all operators
 */
function operatorsForType(varType: string | undefined): typeof OPERATORS {
  if (varType === 'boolean' || varType === 'string') {
    return OPERATORS.filter(op => op.value === '==' || op.value === '!=');
  }
  return OPERATORS;
}

/** Simplified block renderer for nested blocks (no further nesting) */
function NestedBlockEditor({
  block,
  sceneId,
  conditionBlockId,
  branchId,
}: {
  block: Block;
  sceneId: string;
  conditionBlockId: string;
  branchId: string;
}) {
  const { updateNestedBlock } = useProjectStore();
  const t = useT();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onUpdate = (patch: any) => updateNestedBlock(sceneId, conditionBlockId, branchId, block.id, patch);
  switch (block.type) {
    case 'text':         return <TextBlockEditor block={block} sceneId={sceneId} onUpdate={onUpdate as (p: Partial<TextBlock>) => void} />;
    case 'dialogue':     return <DialogueBlockEditor block={block} sceneId={sceneId} onUpdate={onUpdate as (p: Partial<DialogueBlock>) => void} />;
    case 'choice':       return <ChoiceBlockEditor block={block} sceneId={sceneId} onUpdate={onUpdate as (p: Partial<ChoiceBlock>) => void} />;
    case 'variable-set': return <VariableSetBlockEditor block={block} sceneId={sceneId} onUpdate={onUpdate as (p: Partial<VariableSetBlock>) => void} />;
    case 'image':        return <ImageBlockEditor block={block} sceneId={sceneId} onUpdate={onUpdate as (p: Partial<ImageBlock>) => void} />;
    case 'video':        return <VideoBlockEditor block={block} sceneId={sceneId} onUpdate={onUpdate as (p: Partial<VideoBlock>) => void} />;
    case 'raw':          return <RawBlockEditor block={block} sceneId={sceneId} onUpdate={onUpdate as (p: Partial<RawBlock>) => void} />;
    default:             return <span className="text-xs text-slate-500">{t.block.unsupportedNested}</span>;
  }
}

/** Sortable wrapper for a nested block with drag handle, copy, duplicate, delete */
function SortableNestedBlock({
  block,
  sceneId,
  conditionBlockId,
  branchId,
  onDuplicate,
  onCopy,
  onDelete,
}: {
  block: Block;
  sceneId: string;
  conditionBlockId: string;
  branchId: string;
  onDuplicate: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded border border-slate-700 bg-slate-800/50 overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1 bg-slate-800/80 border-b border-slate-700">
        <div className="flex items-center gap-1.5">
          <span
            {...listeners}
            {...attributes}
            className="drag-handle text-slate-600 hover:text-slate-400 text-xs select-none cursor-grab active:cursor-grabbing"
            title={t.block.drag}
          >
            ⠿
          </span>
          <span className="text-xs text-slate-400 uppercase tracking-wider">
            {blockTypeLabel(t, block.type)}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            className="text-slate-600 hover:text-slate-300 text-xs cursor-pointer px-0.5 transition-colors"
            title={t.block.copy}
            onClick={onCopy}
          >
            📋
          </button>
          <button
            className="text-slate-600 hover:text-indigo-400 text-xs cursor-pointer px-0.5 transition-colors"
            title={t.block.duplicate}
            onClick={onDuplicate}
          >
            ⧉
          </button>
          <button
            className="text-slate-600 hover:text-red-400 text-xs cursor-pointer px-0.5 transition-colors"
            title={t.block.delete}
            onClick={onDelete}
          >
            ✕
          </button>
        </div>
      </div>
      <div className="p-2">
        <NestedBlockEditor block={block} sceneId={sceneId} conditionBlockId={conditionBlockId} branchId={branchId} />
      </div>
    </div>
  );
}

export function ConditionBlockEditor({
  block,
  sceneId,
}: {
  block: ConditionBlock;
  sceneId: string;
}) {
  const {
    project,
    addConditionBranch,
    updateConditionBranch,
    deleteConditionBranch,
    addNestedBlock,
    deleteNestedBlock,
    duplicateNestedBlock,
    pasteToNested,
    reorderNestedBlocks,
  } = useProjectStore();
  const { clipboardBlock, copyToClipboard } = useEditorStore();
  const t = useT();
  const variables = flattenVariables(project.variableNodes);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const hasElse = block.branches.some(b => b.branchType === 'else');

  const addElseBranch = () => {
    addConditionBranch(sceneId, block.id);
    setTimeout(() => {
      const state = useProjectStore.getState();
      const currentBlock = state.project.scenes
        .find(s => s.id === sceneId)?.blocks
        .find(b => b.id === block.id);
      if (currentBlock?.type === 'condition') {
        const last = currentBlock.branches[currentBlock.branches.length - 1];
        if (last && last.branchType !== 'else') {
          state.updateConditionBranch(sceneId, block.id, last.id, { branchType: 'else' });
        }
      }
    }, 0);
  };

  const handleNestedDragEnd = (event: DragEndEvent, branchId: string, branchBlocks: Block[]) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = branchBlocks.findIndex(b => b.id === active.id);
    const newIndex = branchBlocks.findIndex(b => b.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderNestedBlocks(sceneId, block.id, branchId, arrayMove(branchBlocks, oldIndex, newIndex));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {block.branches.map((branch, idx) => (
        <div key={branch.id} className="border border-amber-800/40 rounded overflow-hidden">
          {/* Branch header */}
          <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 bg-amber-950/30 border-b border-amber-800/30">
            <select
              className="bg-slate-800 text-xs text-amber-300 rounded px-1.5 py-0.5 outline-none border border-slate-600 cursor-pointer font-mono"
              value={branch.branchType}
              onChange={e =>
                updateConditionBranch(sceneId, block.id, branch.id, {
                  branchType: e.target.value as ConditionBranchType,
                })
              }
            >
              {idx === 0 ? (
                <option value="if">{'<<if>>'}</option>
              ) : (
                <>
                  <option value="elseif">{'<<elseif>>'}</option>
                  <option value="else">{'<<else>>'}</option>
                </>
              )}
            </select>

            {branch.branchType !== 'else' && (() => {
              const branchVar = variables.find(v => v.id === branch.variableId);
              const availableOps = operatorsForType(branchVar?.varType);
              return (
              <>
                <select
                  className="flex-1 min-w-0 bg-slate-800 text-xs text-white rounded px-1.5 py-0.5 outline-none border border-slate-600 cursor-pointer"
                  value={branch.variableId}
                  onChange={e => {
                    const newVar = variables.find(v => v.id === e.target.value);
                    const newOps = operatorsForType(newVar?.varType);
                    const opStillValid = newOps.some(op => op.value === branch.operator);
                    updateConditionBranch(sceneId, block.id, branch.id, {
                      variableId: e.target.value,
                      ...(!opStillValid ? { operator: newOps[0].value } : {}),
                    });
                  }}
                >
                  <option value="">{t.condition.varPlaceholder}</option>
                  {variables.map(v => (
                    <option key={v.id} value={v.id}>${v.name}</option>
                  ))}
                </select>

                <select
                  className="bg-slate-800 text-xs text-white rounded px-1.5 py-0.5 outline-none border border-slate-600 cursor-pointer font-mono"
                  value={branch.operator}
                  onChange={e =>
                    updateConditionBranch(sceneId, block.id, branch.id, {
                      operator: e.target.value as ConditionOperator,
                    })
                  }
                >
                  {availableOps.map(op => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>

                <input
                  className="w-16 bg-slate-800 text-xs text-white rounded px-1.5 py-0.5 outline-none border border-slate-600 font-mono"
                  placeholder={t.condition.valuePlaceholder}
                  value={branch.value}
                  onChange={e =>
                    updateConditionBranch(sceneId, block.id, branch.id, { value: e.target.value })
                  }
                />
              </>
              );
            })()}

            <button
              className="ml-auto text-slate-600 hover:text-red-400 text-xs cursor-pointer shrink-0"
              onClick={() => deleteConditionBranch(sceneId, block.id, branch.id)}
            >
              ✕
            </button>
          </div>

          {/* Nested blocks */}
          <div className="p-2 flex flex-col gap-1.5 bg-slate-900/20">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e) => handleNestedDragEnd(e, branch.id, branch.blocks)}
            >
              <SortableContext
                items={branch.blocks.map(nb => nb.id)}
                strategy={verticalListSortingStrategy}
              >
                {branch.blocks.map(nb => (
                  <SortableNestedBlock
                    key={nb.id}
                    block={nb}
                    sceneId={sceneId}
                    conditionBlockId={block.id}
                    branchId={branch.id}
                    onDuplicate={() => duplicateNestedBlock(sceneId, block.id, branch.id, nb.id)}
                    onCopy={() => copyToClipboard(nb)}
                    onDelete={() => deleteNestedBlock(sceneId, block.id, branch.id, nb.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>

            <AddBlockMenu
              sceneId={sceneId}
              excludeTypes={['condition', 'note']}
              onAdd={(nb) => addNestedBlock(sceneId, block.id, branch.id, nb)}
            />

            {clipboardBlock && (
              <button
                className="text-xs text-indigo-400 hover:text-indigo-300 hover:bg-slate-800/50 rounded px-2 py-1 transition-colors cursor-pointer text-left border border-dashed border-indigo-800/50"
                title={t.block.paste(blockTypeLabel(t, clipboardBlock.type))}
                onClick={() => pasteToNested(sceneId, block.id, branch.id, clipboardBlock)}
              >
                {t.block.paste(blockTypeLabel(t, clipboardBlock.type))}
              </button>
            )}
          </div>
        </div>
      ))}

      <div className="flex gap-2 flex-wrap">
        {!hasElse && (
          <button
            className="text-xs text-amber-400 hover:text-amber-300 hover:bg-slate-800 rounded px-2 py-1 transition-colors cursor-pointer"
            onClick={() => addConditionBranch(sceneId, block.id)}
          >
            {t.condition.addBranch}
          </button>
        )}
        {block.branches.length > 0 && !hasElse && (
          <button
            className="text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-800 rounded px-2 py-1 transition-colors cursor-pointer"
            onClick={addElseBranch}
          >
            {t.condition.addElse}
          </button>
        )}
        {block.branches.length === 0 && (
          <span className="text-xs text-slate-600 italic px-2">{t.condition.noBranches}</span>
        )}
      </div>
    </div>
  );
}
