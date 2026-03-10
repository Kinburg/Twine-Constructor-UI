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
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useProjectStore } from '../../store/projectStore';
import { useT } from '../../i18n';
import type { Scene } from '../../types';

function SortableSceneItem({
  scene,
  isActive,
  noteOpen,
  onSelect,
  onStartRename,
  onDuplicate,
  onDelete,
  onNoteToggle,
  onNoteClose,
  canDelete,
}: {
  scene: Scene;
  isActive: boolean;
  noteOpen: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onNoteToggle: () => void;
  onNoteClose: (text: string) => void;
  canDelete: boolean;
}) {
  const t = useT();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasNote = !!scene.notes;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`group flex items-center rounded px-2 py-1.5 cursor-pointer transition-colors ${
          isActive ? 'bg-indigo-700/40 text-white' : 'hover:bg-slate-800 text-slate-300'
        }`}
        onClick={onSelect}
      >
        <span
          {...listeners}
          {...attributes}
          className="drag-handle text-slate-600 hover:text-slate-400 text-xs mr-1.5 select-none shrink-0 cursor-grab active:cursor-grabbing"
          title={t.scene.drag}
          onClick={e => e.stopPropagation()}
        >
          ⠿
        </span>
        <span className="flex-1 text-xs truncate">{scene.name}</span>

        {/* Note button — always visible if note exists, otherwise on hover */}
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

      {/* Inline note editor */}
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
    </div>
  );
}

function RenamingSceneItem({
  initialName,
  onCommit,
  onCancel,
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

  const [editingId, setEditingId]       = useState<string | null>(null);
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = project.scenes.findIndex(s => s.id === active.id);
    const newIndex = project.scenes.findIndex(s => s.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderScenes(arrayMove(project.scenes, oldIndex, newIndex));
    }
  };

  return (
    <div className="p-2 flex flex-col gap-0.5">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={project.scenes.map((s: Scene) => s.id)} strategy={verticalListSortingStrategy}>
          {project.scenes.map((scene: Scene) =>
            editingId === scene.id ? (
              <RenamingSceneItem
                key={scene.id}
                initialName={scene.name}
                onCommit={(name) => { renameScene(scene.id, name); setEditingId(null); }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <SortableSceneItem
                key={scene.id}
                scene={scene}
                isActive={scene.id === activeSceneId}
                noteOpen={noteEditingId === scene.id}
                onSelect={() => setActiveScene(scene.id)}
                onStartRename={() => setEditingId(scene.id)}
                onDuplicate={() => duplicateScene(scene.id)}
                onDelete={() => { if (confirm(t.scene.confirmDelete(scene.name))) deleteScene(scene.id); }}
                onNoteToggle={() => setNoteEditingId(id => id === scene.id ? null : scene.id)}
                onNoteClose={(text) => {
                  updateSceneNote(scene.id, text.trim() || undefined);
                  setNoteEditingId(null);
                }}
                canDelete={project.scenes.length > 1}
              />
            )
          )}
        </SortableContext>
      </DndContext>

      <button
        className="mt-1 w-full text-xs text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded px-2 py-1.5 text-left transition-colors cursor-pointer"
        onClick={addScene}
      >
        {t.scene.add}
      </button>
    </div>
  );
}
