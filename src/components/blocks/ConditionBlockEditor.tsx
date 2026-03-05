import { useProjectStore, flattenVariables } from '../../store/projectStore';
import type {
  ConditionBlock, ConditionBranchType, ConditionOperator, Block,
  TextBlock, DialogueBlock, ChoiceBlock, VariableSetBlock, ImageBlock, VideoBlock,
} from '../../types';
import { AddBlockMenu } from './AddBlockMenu';
import { TextBlockEditor } from './TextBlockEditor';
import { DialogueBlockEditor } from './DialogueBlockEditor';
import { ChoiceBlockEditor } from './ChoiceBlockEditor';
import { VariableSetBlockEditor } from './VariableSetBlockEditor';
import { ImageBlockEditor } from './ImageBlockEditor';
import { VideoBlockEditor } from './VideoBlockEditor';

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: '==', label: '==' },
  { value: '!=', label: '!=' },
  { value: '>',  label: '>'  },
  { value: '<',  label: '<'  },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
];

/** Simplified block renderer for nested blocks (no DnD, no further nesting) */
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onUpdate = (patch: any) => updateNestedBlock(sceneId, conditionBlockId, branchId, block.id, patch);
  switch (block.type) {
    case 'text':         return <TextBlockEditor block={block} sceneId={sceneId} onUpdate={onUpdate as (p: Partial<TextBlock>) => void} />;
    case 'dialogue':     return <DialogueBlockEditor block={block} sceneId={sceneId} onUpdate={onUpdate as (p: Partial<DialogueBlock>) => void} />;
    case 'choice':       return <ChoiceBlockEditor block={block} sceneId={sceneId} onUpdate={onUpdate as (p: Partial<ChoiceBlock>) => void} />;
    case 'variable-set': return <VariableSetBlockEditor block={block} sceneId={sceneId} onUpdate={onUpdate as (p: Partial<VariableSetBlock>) => void} />;
    case 'image':        return <ImageBlockEditor block={block} sceneId={sceneId} onUpdate={onUpdate as (p: Partial<ImageBlock>) => void} />;
    case 'video':        return <VideoBlockEditor block={block} sceneId={sceneId} onUpdate={onUpdate as (p: Partial<VideoBlock>) => void} />;
    default:             return <span className="text-xs text-slate-500">Вложенный тип не поддерживается</span>;
  }
}

const BLOCK_TYPE_LABEL: Record<string, string> = {
  text: 'Текст', dialogue: 'Диалог', choice: 'Выбор',
  'variable-set': 'Переменная', image: 'Картинка', video: 'Видео',
};

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
  } = useProjectStore();
  const variables = flattenVariables(project.variableNodes);

  const hasElse = block.branches.some(b => b.branchType === 'else');

  const addElseBranch = () => {
    // We add a branch (which defaults to elseif), then immediately flip it to 'else'
    // We do this by computing what the next id will be in the store after addConditionBranch fires
    // Instead: find the current branch count, add one, then in a microtask update it
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

            {branch.branchType !== 'else' && (
              <>
                <select
                  className="flex-1 min-w-0 bg-slate-800 text-xs text-white rounded px-1.5 py-0.5 outline-none border border-slate-600 cursor-pointer"
                  value={branch.variableId}
                  onChange={e =>
                    updateConditionBranch(sceneId, block.id, branch.id, { variableId: e.target.value })
                  }
                >
                  <option value="">— $переменная —</option>
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
                  {OPERATORS.map(op => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>

                <input
                  className="w-16 bg-slate-800 text-xs text-white rounded px-1.5 py-0.5 outline-none border border-slate-600 font-mono"
                  placeholder="значение"
                  value={branch.value}
                  onChange={e =>
                    updateConditionBranch(sceneId, block.id, branch.id, { value: e.target.value })
                  }
                />
              </>
            )}

            <button
              className="ml-auto text-slate-600 hover:text-red-400 text-xs cursor-pointer shrink-0"
              onClick={() => deleteConditionBranch(sceneId, block.id, branch.id)}
            >
              ✕
            </button>
          </div>

          {/* Nested blocks */}
          <div className="p-2 flex flex-col gap-1.5 bg-slate-900/20">
            {branch.blocks.map(nb => (
              <div key={nb.id} className="rounded border border-slate-700 bg-slate-800/50 overflow-hidden">
                <div className="flex items-center justify-between px-2 py-1 bg-slate-800/80 border-b border-slate-700">
                  <span className="text-xs text-slate-400 uppercase tracking-wider">
                    {BLOCK_TYPE_LABEL[nb.type] ?? nb.type}
                  </span>
                  <button
                    className="text-slate-600 hover:text-red-400 text-xs cursor-pointer"
                    onClick={() => deleteNestedBlock(sceneId, block.id, branch.id, nb.id)}
                  >
                    ✕
                  </button>
                </div>
                <div className="p-2">
                  <NestedBlockEditor block={nb} sceneId={sceneId} conditionBlockId={block.id} branchId={branch.id} />
                </div>
              </div>
            ))}

            <AddBlockMenu
              sceneId={sceneId}
              excludeTypes={['condition']}
              onAdd={(nb) => addNestedBlock(sceneId, block.id, branch.id, nb)}
            />
          </div>
        </div>
      ))}

      <div className="flex gap-2 flex-wrap">
        {!hasElse && (
          <button
            className="text-xs text-amber-400 hover:text-amber-300 hover:bg-slate-800 rounded px-2 py-1 transition-colors cursor-pointer"
            onClick={() => addConditionBranch(sceneId, block.id)}
          >
            + Ветка (if/elseif)
          </button>
        )}
        {block.branches.length > 0 && !hasElse && (
          <button
            className="text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-800 rounded px-2 py-1 transition-colors cursor-pointer"
            onClick={addElseBranch}
          >
            + Ветка (else)
          </button>
        )}
        {block.branches.length === 0 && (
          <span className="text-xs text-slate-600 italic px-2">Добавьте ветку (if)</span>
        )}
      </div>
    </div>
  );
}
