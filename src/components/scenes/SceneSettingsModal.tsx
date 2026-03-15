import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useT } from '../../i18n';
import { SYSTEM_TAGS, SYSTEM_TAG_COLORS } from '../../types';
import type { Scene, SystemTag } from '../../types';

interface Props {
  scene: Scene;
  onClose: () => void;
}

export function SceneSettingsModal({ scene, onClose }: Props) {
  const { project, updateSceneTags } = useProjectStore();
  const t = useT();
  const [newTagInput, setNewTagInput] = useState('');

  // All unique custom tags across the project (excluding system tags)
  const allCustomTags = [...new Set(
    project.scenes
      .flatMap(s => s.tags)
      .filter(tag => !(SYSTEM_TAGS as readonly string[]).includes(tag)),
  )].sort();

  const toggleTag = (tag: string) => {
    const has = scene.tags.includes(tag);
    updateSceneTags(scene.id, has
      ? scene.tags.filter(t => t !== tag)
      : [...scene.tags, tag],
    );
  };

  const addCustomTag = () => {
    const tag = newTagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (!tag || scene.tags.includes(tag)) { setNewTagInput(''); return; }
    updateSceneTags(scene.id, [...scene.tags, tag]);
    setNewTagInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-80 p-4 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">{t.sceneSettings.title}</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors cursor-pointer text-base leading-none"
          >
            ✕
          </button>
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-2.5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {t.sceneSettings.tagsLabel}
          </div>

          {/* System tags — always visible */}
          <div className="flex flex-wrap gap-1.5">
            {SYSTEM_TAGS.map(tag => {
              const active = scene.tags.includes(tag);
              const color = SYSTEM_TAG_COLORS[tag as SystemTag];
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-all border"
                  style={active
                    ? { background: color, borderColor: color, color: '#fff' }
                    : { background: 'transparent', borderColor: color, color: color }
                  }
                >
                  {tag}
                </button>
              );
            })}
          </div>

          {/* Custom project tags */}
          {allCustomTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {allCustomTags.map(tag => {
                const active = scene.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 rounded text-xs cursor-pointer transition-colors border ${
                      active
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-transparent border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}

          {/* New tag input */}
          <div className="flex gap-1.5">
            <input
              className="flex-1 bg-slate-700 text-xs text-white rounded px-2 py-1 border border-slate-600 focus:border-indigo-500 outline-none"
              placeholder={t.sceneSettings.addTagPlaceholder}
              value={newTagInput}
              onChange={e => setNewTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCustomTag(); }}
            />
            <button
              onClick={addCustomTag}
              className="text-xs text-indigo-400 hover:text-indigo-300 px-2.5 py-1 rounded border border-slate-600 hover:border-indigo-500 transition-colors cursor-pointer"
            >
              +
            </button>
          </div>
        </div>

        {/* Done */}
        <button
          onClick={onClose}
          className="w-full py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors cursor-pointer"
        >
          {t.sceneSettings.done}
        </button>
      </div>
    </div>
  );
}
