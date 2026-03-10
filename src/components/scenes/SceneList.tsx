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
import type { Scene } from '../../types';

// ─── Shared scene row content (no DnD bindings) ───────────────────────────────

type SceneRowProps = {
  scene: Scene;
  isActive: boolean;
  noteOpen: boolean;
  dragHandle: React.ReactNode;
  canDelete: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onNoteToggle: () => void;
  onNoteClose: (text: string) => void;
};

function SceneItemRow({
  scene, isActive, noteOpen, dragHandle, canDelete,
  onSelect, onStartRename, onDuplicate, onDelete, onNoteToggle, onNoteClose,
}: SceneRowProps) {
  const t = useT();
  const hasNote = !!scene.notes;

  return (
    <>
      <div
        className={`group flex items-center rounded px-2 py-1.5 cursor-pointer transition-colors ${
          isActive ? 'bg-indigo-700/40 text-white' : 'hover:bg-slate-800 text-slate-300'
        }`}
        onClick={onSelect}
      >
        {dragHandle}
        <span className="flex-1 text-xs truncate">{scene.name}</span>

        <button
          className={`text-xs px-0.5 cursor-pointer transition-all ${
            hasNote
              ? 'text-amber-400 hover:text-amber-300'
              : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-amber-300'
          }`}
          title={hasNote ? `${t.scene.note}: ${scene.notes}` : t.scene.note}
          onClick={e => { e.stopPropagation(); onNoteToggle(); }}
        >
          📝
        </button>
        <button
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white text-xs px-0.5 transition-opacity cursor-pointer"
          title={t.scene.rename}
          onClick={e => { e.stopPropagation(); onStartRename(); }}
        >
          ✏️
        </button>
        <button
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-300 text-xs px-0.5 transition-opacity cursor-pointer"
          title={t.scene.duplicate}
          onClick={e => { e.stopPropagation(); onDuplicate(); }}
        >
          ⧉
        </button>
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

      {noteOpen && (
        <div className="px-2 pb-1.5" onClick={e => e.stopPropagation()}>
          <textarea
            autoFocus
            className="w-full bg-slate-700 text-xs text-slate-200 rounded px-2 py-1 outline-none border border-amber-800/60 focus:border-amber-600 resize-none placeholder-slate-500"
            rows={3}
            placeholder={t.scene.notePlaceholder}
            defaultValue={scene.notes ?? ''}
            onBlur={e => onNoteClose(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') onNoteClose(scene.notes ?? '');
            }}
          />
        </div>
      )}
    </>
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
  // Drag handle shown but dimmed to indicate sorting is unavailable
  const dragHandle = (
    <span className="text-slate-800 text-xs mr-1.5 select-none shrink-0">⠿</span>
  );
  return (
    <div>
      <SceneItemRow {...props} dragHandle={dragHandle} />
    </div>
  );
}

// ─── Renaming item ─────────────────────────────────────────────────────────────

function RenamingSceneItem({
  initialName, onCommit, onCancel,
}: {
  initialName: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initialName);

  return (
    <div className="flex items-center rounded px-2 py-1.5 bg-indigo-700/20">
      <span className="text-slate-600 text-xs mr-1.5 select-none">⠿</span>
      <input
        autoFocus
        className="flex-1 bg-slate-700 text-white px-1 py-0 rounded text-xs outline-none border border-indigo-500"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { if (draft.trim()) onCommit(draft.trim()); else onCancel(); }}
        onKeyDown={e => {
          if (e.key === 'Enter' && draft.trim()) onCommit(draft.trim());
          if (e.key === 'Escape') onCancel();
        }}
      />
    </div>
  );
}

// ─── Main SceneList ────────────────────────────────────────────────────────────

export function SceneList() {
  const {
    project,
    activeSceneId,
    setActiveScene,
    addScene,
    deleteScene,
    renameScene,
    updateSceneNote,
    duplicateScene,
    reorderScenes,
  } = useProjectStore();
  const t = useT();

  const searchQuery = useEditorStore(s => s.searchQuery);

  const [editingId, setEditingId]         = useState<string | null>(null);
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null);
  const [activeTags, setActiveTags]       = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode]       = useState<'or' | 'and'>('or');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  /** Flat variable list for variable-name search. */
  const variables = useMemo(
    () => flattenVariables(project.variableNodes ?? []),
    [project.variableNodes],
  );

  /** All unique tags used across all scenes, sorted. */
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

  /** Tag filter is active when at least one tag is selected. */
  const isTagFiltering = activeTags.size > 0;
  /** Any filter is active (tags OR search query). */
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

  /** Shared scene-item callback props (same for both sortable and plain). */
  const itemCallbacks = (scene: Scene) => ({
    isActive:      scene.id === activeSceneId,
    noteOpen:      noteEditingId === scene.id,
    canDelete:     project.scenes.length > 1,
    onSelect:      () => setActiveScene(scene.id),
    onStartRename: () => setEditingId(scene.id),
    onDuplicate:   () => duplicateScene(scene.id),
    onDelete:      () => { if (confirm(t.scene.confirmDelete(scene.name))) deleteScene(scene.id); },
    onNoteToggle:  () => setNoteEditingId(id => id === scene.id ? null : scene.id),
    onNoteClose:   (text: string) => { updateSceneNote(scene.id, text.trim() || undefined); setNoteEditingId(null); },
  });

  return (
    <div className="p-2 flex flex-col gap-0.5">

      {/* Tag filter strip — only shown when there are tags in the project */}
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

            {/* OR / AND toggle — shown only when tag filter is active */}
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
            visibleScenes.map(scene =>
              editingId === scene.id ? (
                <RenamingSceneItem
                  key={scene.id}
                  initialName={scene.name}
                  onCommit={name => { renameScene(scene.id, name); setEditingId(null); }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <PlainSceneItem key={scene.id} scene={scene} {...itemCallbacks(scene)} />
              )
            )
          )}
        </div>
      ) : (
        /* Normal view with DnD */
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={project.scenes.map((s: Scene) => s.id)} strategy={verticalListSortingStrategy}>
            {project.scenes.map((scene: Scene) =>
              editingId === scene.id ? (
                <RenamingSceneItem
                  key={scene.id}
                  initialName={scene.name}
                  onCommit={name => { renameScene(scene.id, name); setEditingId(null); }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <SortableSceneItem key={scene.id} scene={scene} {...itemCallbacks(scene)} />
              )
            )}
          </SortableContext>
        </DndContext>
      )}

      <button
        className="mt-1 w-full text-xs text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded px-2 py-1.5 text-left transition-colors cursor-pointer"
        onClick={addScene}
      >
        {t.scene.add}
      </button>
    </div>
  );
}
