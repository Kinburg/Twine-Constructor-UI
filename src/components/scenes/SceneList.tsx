import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';

export function SceneList() {
  const { project, activeSceneId, setActiveScene, addScene, deleteScene, renameScene } =
    useProjectStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');

  const startRename = (id: string, currentName: string) => {
    setEditingId(id);
    setNameDraft(currentName);
  };

  const commitRename = (id: string) => {
    if (nameDraft.trim()) renameScene(id, nameDraft.trim());
    setEditingId(null);
  };

  return (
    <div className="p-2 flex flex-col gap-0.5">
      {project.scenes.map(scene => (
        <div
          key={scene.id}
          className={`group flex items-center rounded px-2 py-1.5 cursor-pointer transition-colors ${
            scene.id === activeSceneId
              ? 'bg-indigo-700/40 text-white'
              : 'hover:bg-slate-800 text-slate-300'
          }`}
          onClick={() => setActiveScene(scene.id)}
        >
          {editingId === scene.id ? (
            <input
              autoFocus
              className="flex-1 bg-slate-700 text-white px-1 py-0 rounded text-xs outline-none border border-indigo-500"
              value={nameDraft}
              onClick={e => e.stopPropagation()}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={() => commitRename(scene.id)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename(scene.id);
                if (e.key === 'Escape') setEditingId(null);
              }}
            />
          ) : (
            <>
              <span className="flex-1 text-xs truncate">{scene.name}</span>
              <button
                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white text-xs px-0.5 transition-opacity cursor-pointer"
                title="Переименовать"
                onClick={e => { e.stopPropagation(); startRename(scene.id, scene.name); }}
              >
                ✏️
              </button>
              {project.scenes.length > 1 && (
                <button
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 text-xs px-0.5 transition-opacity cursor-pointer"
                  title="Удалить сцену"
                  onClick={e => {
                    e.stopPropagation();
                    if (confirm(`Удалить сцену "${scene.name}"?`)) deleteScene(scene.id);
                  }}
                >
                  🗑️
                </button>
              )}
            </>
          )}
        </div>
      ))}

      <button
        className="mt-1 w-full text-xs text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded px-2 py-1.5 text-left transition-colors cursor-pointer"
        onClick={addScene}
      >
        + Добавить сцену
      </button>
    </div>
  );
}
