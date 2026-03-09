import { useState } from 'react';
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
  arrayMove,
} from '@dnd-kit/sortable';
import { useProjectStore } from '../../store/projectStore';
import { useEditorStore } from '../../store/editorStore';
import { useT, blockTypeLabel } from '../../i18n';
import { BlockItem } from '../blocks/BlockItem';
import { AddBlockMenu } from '../blocks/AddBlockMenu';
import type { Block } from '../../types';

export function SceneEditor() {
  const { project, activeSceneId, reorderBlocks, updateSceneTags, pasteToScene } = useProjectStore();
  const { clipboardBlock } = useEditorStore();
  const t = useT();
  const [editTags, setEditTags] = useState(false);
  const [tagsDraft, setTagsDraft] = useState('');

  const scene = project.scenes.find(s => s.id === activeSceneId);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  if (!scene) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        {t.scene.selectPrompt}
      </div>
    );
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = scene.blocks.findIndex((b: Block) => b.id === active.id);
    const newIndex = scene.blocks.findIndex((b: Block) => b.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderBlocks(scene.id, arrayMove(scene.blocks, oldIndex, newIndex));
    }
  };

  const startEditTags = () => {
    setTagsDraft(scene.tags.join(' '));
    setEditTags(true);
  };

  const commitTags = () => {
    const tags = tagsDraft.trim().split(/\s+/).filter(Boolean);
    updateSceneTags(scene.id, tags);
    setEditTags(false);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Scene header */}
      <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700 flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{t.scene.label}</span>
          <span className="text-sm font-semibold text-white">{scene.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400">{t.scene.tags}</span>
          {editTags ? (
            <input
              autoFocus
              className="bg-slate-700 text-white px-2 py-0.5 rounded text-xs border border-indigo-500 outline-none w-40"
              value={tagsDraft}
              onChange={e => setTagsDraft(e.target.value)}
              onBlur={commitTags}
              onKeyDown={e => { if (e.key === 'Enter') commitTags(); if (e.key === 'Escape') setEditTags(false); }}
              placeholder={t.scene.tagsPlaceholder}
            />
          ) : (
            <button
              className="text-xs text-slate-400 hover:text-indigo-300 px-1 cursor-pointer"
              onClick={startEditTags}
              title={t.scene.editTagsTitle}
            >
              {scene.tags.length > 0
                ? scene.tags.map(tag => (
                    <span key={tag} className="inline-block bg-slate-700 text-slate-300 rounded px-1.5 py-0.5 mr-1 text-xs">
                      {tag}
                    </span>
                  ))
                : <span className="text-slate-600 italic">{t.scene.noTags}</span>
              }
              <span className="ml-1 text-slate-500">✏️</span>
            </button>
          )}
        </div>
      </div>

      {/* Blocks */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        <div className="absolute inset-0 overflow-y-auto">
          <div className="px-4 py-3 flex flex-col gap-2">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={scene.blocks.map((b: Block) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                {scene.blocks.map((block: Block) => (
                  <BlockItem key={block.id} block={block} sceneId={scene.id} />
                ))}
              </SortableContext>
            </DndContext>

            {scene.blocks.length === 0 && (
              <div className="text-slate-600 text-sm text-center py-8">
                {t.scene.empty}
              </div>
            )}

            <AddBlockMenu sceneId={scene.id} />

            {clipboardBlock && (
              <button
                className="text-xs text-indigo-400 hover:text-indigo-300 hover:bg-slate-800/50 rounded px-2 py-1 transition-colors cursor-pointer text-left border border-dashed border-indigo-800/50"
                title={t.block.paste(blockTypeLabel(t, clipboardBlock.type))}
                onClick={() => pasteToScene(scene.id, clipboardBlock)}
              >
                {t.block.paste(blockTypeLabel(t, clipboardBlock.type))}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
