import { useState, useMemo } from 'react';
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
import { sceneMatchesQuery } from '../../utils/searchUtils';
import { useT } from '../../i18n';
import { SYSTEM_TAGS, SYSTEM_TAG_COLORS } from '../../types';
import type { Scene, SystemTag } from '../../types';
import { useConfirm } from '../shared/ConfirmModal';
import { SceneModal } from './SceneModal';

// ─── Shared scene row content (no DnD bindings) ───────────────────────────────

type SceneRowProps = {
  scene: Scene;
  isActive: boolean;
  dragHandle: React.ReactNode;
  canDelete: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

function SceneItemRow({
  scene, isActive, dragHandle, canDelete,
  onSelect, onEdit, onDuplicate, onDelete,
}: SceneRowProps) {
  const t = useT();
  const hasNote = !!scene.notes;

  // Color dot: first system tag wins
  const systemTag = scene.tags.find(tag =>
    (SYSTEM_TAGS as readonly string[]).includes(tag),
  ) as SystemTag | undefined;
  const dotColor = systemTag ? SYSTEM_TAG_COLORS[systemTag] : null;

  return (
    <div
      className={`group flex items-center rounded px-2 py-1.5 cursor-pointer transition-colors ${
        isActive ? 'bg-indigo-700/40 text-white' : 'hover:bg-slate-800 text-slate-300'
      }`}
      onClick={onSelect}
      onDoubleClick={e => { e.stopPropagation(); onEdit(); }}
    >
      {dragHandle}

      {/* Color dot for system tags */}
      {dotColor && (
        <span
          className="w-2 h-2 rounded-full shrink-0 mr-1.5"
          style={{ background: dotColor }}
        />
      )}

      <span className="flex-1 text-xs truncate">{scene.name}</span>

      {/* Note indicator */}
      <button
        className={`text-xs px-0.5 cursor-pointer transition-all ${
          hasNote
            ? 'text-amber-400 hover:text-amber-300'
            : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-amber-300'
        }`}
        title={hasNote ? `${t.scene.note}: ${scene.notes}` : t.scene.note}
        onClick={e => { e.stopPropagation(); onEdit(); }}
      >
        📝
      </button>

      {/* Duplicate */}
      <button
        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-300 text-xs px-0.5 transition-opacity cursor-pointer"
        title={t.scene.duplicate}
        onClick={e => { e.stopPropagation(); onDuplicate(); }}
      >
        ⧉
      </button>

      {/* Delete */}
      {canDelete && (
        <button
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 text-xs px-0.5 transition-opacity cursor-pointer"
          title={t.scene.delete}
          onClick={e => { e.stopPropagation(); onDelete(); }}
        >
          🗑️
        </button>
      )}
    </div>
  );
}

// ─── Sortable wrapper (DnD enabled) ───────────────────────────────────────────

function SortableSceneItem(props: Omit<SceneRowProps, 'dragHandle'>) {
  const t = useT();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.scene.id });

  const dragHandle = (
    <span
      {...listeners}
      {...attributes}
      className="drag-handle text-slate-600 hover:text-slate-400 text-xs mr-1.5 select-none shrink-0 cursor-grab active:cursor-grabbing"
      title={t.scene.drag}
      onClick={e => e.stopPropagation()}
    >
      ⠿
    </span>
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
    >
      <SceneItemRow {...props} dragHandle={dragHandle} />
    </div>
  );
}

// ─── Plain wrapper (no DnD, used when filter is active) ───────────────────────

function PlainSceneItem(props: Omit<SceneRowProps, 'dragHandle'>) {
  const dragHandle = (
    <span className="text-slate-800 text-xs mr-1.5 select-none shrink-0">⠿</span>
  );
  return (
    <div>
      <SceneItemRow {...props} dragHandle={dragHandle} />
    </div>
  );
}

// ─── Main SceneList ────────────────────────────────────────────────────────────

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; scene: Scene }
  | null;

export function SceneList() {
  const {
    project,
    activeSceneId,
    setActiveScene,
    addSceneWithData,
    deleteScene,
    updateSceneSettings,
    duplicateScene,
    reorderScenes,
  } = useProjectStore();
  const t = useT();

  const searchQuery = useEditorStore(s => s.searchQuery);

  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<'or' | 'and'>('or');
  const [modalState, setModalState] = useState<ModalState>(null);
  const { ask, modal: confirmModal } = useConfirm();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const variables = useMemo(
    () => flattenVariables(project.variableNodes ?? []),
    [project.variableNodes],
  );

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const sc of project.scenes) {
      for (const tag of sc.tags) tags.add(tag);
    }
    return [...tags].sort();
  }, [project.scenes]);

  const toggleTag = (tag: string) => {
    setActiveTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const isTagFiltering = activeTags.size > 0;
  const isFiltering = isTagFiltering || searchQuery.trim() !== '';

  const visibleScenes = useMemo(() => {
    let scenes = project.scenes;

    if (activeTags.size > 0) {
      scenes = scenes.filter(sc => {
        if (filterMode === 'or') return sc.tags.some(tag => activeTags.has(tag));
        return [...activeTags].every(tag => sc.tags.includes(tag));
      });
    }

    if (searchQuery.trim()) {
      scenes = scenes.filter(sc => sceneMatchesQuery(sc, searchQuery, variables));
    }

    return scenes;
  }, [project.scenes, activeTags, filterMode, searchQuery, variables]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = project.scenes.findIndex(s => s.id === active.id);
    const newIndex = project.scenes.findIndex(s => s.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderScenes(arrayMove(project.scenes, oldIndex, newIndex));
    }
  };

  const openCreate = () => setModalState({ mode: 'create' });
  const openEdit = (scene: Scene) => setModalState({ mode: 'edit', scene });

  const takenNames = (excludeId?: string) =>
    project.scenes
      .filter(s => s.id !== excludeId)
      .map(s => s.name);

  const itemCallbacks = (scene: Scene) => ({
    isActive:    scene.id === activeSceneId,
    canDelete:   project.scenes.length > 1,
    onSelect:    () => setActiveScene(scene.id),
    onEdit:      () => openEdit(scene),
    onDuplicate: () => duplicateScene(scene.id),
    onDelete:    () => ask(
      { message: t.scene.confirmDelete(scene.name), variant: 'danger' },
      () => deleteScene(scene.id),
    ),
  });

  const defaultSceneName = () => {
    const base = 'Scene';
    const existing = project.scenes.map(s => s.name);
    let name = base;
    let i = project.scenes.length + 1;
    while (existing.includes(name)) { name = `${base} ${i}`; i++; }
    return name;
  };

  return (
    <div className="p-2 flex flex-col gap-0.5">

      {/* Add toolbar */}
      <div className="flex gap-1 pb-1 border-b border-slate-800 mb-1">
        <button
          className="flex-1 text-xs text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded px-2 py-1.5 transition-colors cursor-pointer border border-dashed border-slate-700 hover:border-indigo-600"
          onClick={openCreate}
        >
          {t.scene.add}
        </button>
      </div>

      {/* Tag filter strip */}
      {allTags.length > 0 && (
        <div className="mb-0.5">
          <div className="flex flex-wrap gap-1 items-center pb-1">
            {allTags.map(tag => (
              <button
                key={tag}
                className={`text-xs rounded px-1.5 py-0.5 transition-colors cursor-pointer ${
                  activeTags.has(tag)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}

            {isTagFiltering && (
              <div className="ml-auto flex items-center rounded overflow-hidden border border-slate-600 text-xs shrink-0">
                <button
                  className={`px-1.5 py-0.5 cursor-pointer transition-colors ${
                    filterMode === 'or' ? 'bg-indigo-700 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  onClick={() => setFilterMode('or')}
                >
                  OR
                </button>
                <button
                  className={`px-1.5 py-0.5 cursor-pointer transition-colors ${
                    filterMode === 'and' ? 'bg-indigo-700 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  onClick={() => setFilterMode('and')}
                >
                  AND
                </button>
              </div>
            )}
          </div>
          <div className="h-px bg-slate-700/60" />
        </div>
      )}

      {/* Filtered list — no DnD */}
      {isFiltering ? (
        <div className="flex flex-col gap-0.5">
          {visibleScenes.length === 0 ? (
            <div className="text-center py-4 px-2">
              <p className="text-xs text-slate-500">{t.scene.filterNoScenes}</p>
              {filterMode === 'and' && activeTags.size > 1 && (
                <button
                  className="mt-1.5 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                  onClick={() => setFilterMode('or')}
                >
                  → OR
                </button>
              )}
            </div>
          ) : (
            visibleScenes.map(scene => (
              <PlainSceneItem key={scene.id} scene={scene} {...itemCallbacks(scene)} />
            ))
          )}
        </div>
      ) : (
        /* Normal view with DnD */
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={project.scenes.map((s: Scene) => s.id)} strategy={verticalListSortingStrategy}>
            {project.scenes.map((scene: Scene) => (
              <SortableSceneItem key={scene.id} scene={scene} {...itemCallbacks(scene)} />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {modalState && (
        <SceneModal
          mode={modalState.mode}
          initial={modalState.mode === 'create'
            ? { name: defaultSceneName(), tags: [], notes: undefined }
            : { name: modalState.scene.name, tags: modalState.scene.tags, notes: modalState.scene.notes }
          }
          takenNames={modalState.mode === 'create'
            ? takenNames()
            : takenNames(modalState.scene.id)
          }
          onSave={data => {
            if (modalState.mode === 'create') {
              addSceneWithData(data);
            } else {
              updateSceneSettings(modalState.scene.id, data);
            }
          }}
          onClose={() => setModalState(null)}
        />
      )}

      {confirmModal}
    </div>
  );
}
