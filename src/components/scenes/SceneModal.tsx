import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useT } from '../../i18n';
import { SYSTEM_TAGS, SYSTEM_TAG_COLORS, START_TAG, START_TAG_COLOR } from '../../types';
import type { SystemTag } from '../../types';

interface SceneData {
  name: string;
  tags: string[];
  notes?: string;
}

interface Props {
  mode: 'create' | 'edit';
  initial: SceneData;
  takenNames: string[];
  onSave: (data: SceneData) => void;
  onClose: () => void;
  /** Scene ID — required in edit mode for "Make starting scene" */
  sceneId?: string;
}

export function SceneModal({ mode, initial, takenNames, onSave, onClose, sceneId }: Props) {
  const t = useT();
  const { project, makeStartScene } = useProjectStore();

  const [name, setName] = useState(initial.name);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [newTagInput, setNewTagInput] = useState('');
  const [startTagHint, setStartTagHint] = useState(false);

  const trimmedName = name.trim();
  const nameError = trimmedName === ''
    ? t.scene.nameEmpty
    : takenNames.includes(trimmedName)
      ? t.scene.nameTaken
      : null;

  const handleSave = () => {
    if (nameError) return;
    onSave({ name: trimmedName, tags, notes: notes.trim() || undefined });
    onClose();
  };

  const isStartScene = tags.includes(START_TAG);

  const toggleTag = (tag: string) => {
    if (tag === START_TAG) return; // start tag cannot be toggled
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const addCustomTag = () => {
    const tag = newTagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (!tag) { setNewTagInput(''); return; }
    if (tag === START_TAG) {
      setStartTagHint(true);
      setNewTagInput('');
      return;
    }
    if (tags.includes(tag)) { setNewTagInput(''); return; }
    setStartTagHint(false);
    setTags(prev => [...prev, tag]);
    setNewTagInput('');
  };

  const handleMakeStart = () => {
    if (sceneId) makeStartScene(sceneId);
    onClose();
  };

  const allCustomTags = [...new Set([
    ...project.scenes.flatMap(s => s.tags),
    ...tags,
  ].filter(tag => !(SYSTEM_TAGS as readonly string[]).includes(tag) && tag !== START_TAG),
  )].sort();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Modal */}
      <div className="relative bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-96 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
          <h2 className="text-sm font-semibold text-white">
            {mode === 'create' ? t.scene.createTitle : t.scene.editTitle}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors cursor-pointer text-base leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t.scene.fieldName}
            </label>
            <input
              autoFocus
              className={`w-full bg-slate-700 text-xs text-white rounded px-2 py-1.5 outline-none border ${nameError ? 'border-red-500 focus:border-red-400' : 'border-slate-600 focus:border-indigo-500'}`}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            />
            {nameError && <span className="text-xs text-red-400">{nameError}</span>}
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t.sceneSettings.tagsLabel}
            </div>

            {/* Start tag (read-only) */}
            {isStartScene && (
              <div className="flex flex-wrap gap-1.5">
                <span
                  className="px-2.5 py-1 rounded text-xs font-medium border"
                  style={{ background: START_TAG_COLOR, borderColor: START_TAG_COLOR, color: '#fff' }}
                >
                  {START_TAG}
                </span>
              </div>
            )}

            {/* System tags */}
            <div className="flex flex-wrap gap-1.5">
              {SYSTEM_TAGS.map(tag => {
                const active = tags.includes(tag);
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
                  const active = tags.includes(tag);
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
            <div className="flex flex-col gap-1">
              <div className="flex gap-1.5">
                <input
                  className="flex-1 bg-slate-700 text-xs text-white rounded px-2 py-1 border border-slate-600 focus:border-indigo-500 outline-none"
                  placeholder={t.sceneSettings.addTagPlaceholder}
                  value={newTagInput}
                  onChange={e => { setNewTagInput(e.target.value); setStartTagHint(false); }}
                  onKeyDown={e => { if (e.key === 'Enter') addCustomTag(); }}
                />
                <button
                  onClick={addCustomTag}
                  className="text-xs text-indigo-400 hover:text-indigo-300 px-2.5 py-1 rounded border border-slate-600 hover:border-indigo-500 transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>
              {startTagHint && (
                <span className="text-xs text-amber-400">{t.scene.startTagHint}</span>
              )}
            </div>
          </div>

          {/* Note */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t.scene.note}
            </label>
            <textarea
              className="w-full bg-slate-700 text-xs text-slate-200 rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500 resize-none placeholder-slate-500"
              rows={3}
              placeholder={t.scene.notePlaceholder}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-700 shrink-0 flex flex-col gap-2">
          {mode === 'edit' && !isStartScene && (
            <button
              onClick={handleMakeStart}
              className="w-full py-1.5 text-xs rounded transition-colors cursor-pointer border text-white"
              style={{ borderColor: START_TAG_COLOR, background: 'transparent', color: START_TAG_COLOR }}
              onMouseEnter={e => { e.currentTarget.style.background = START_TAG_COLOR; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = START_TAG_COLOR; }}
            >
              {t.scene.makeStart}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!!nameError}
            className="w-full py-1.5 text-xs rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-500 disabled:hover:bg-indigo-600 text-white"
          >
            {t.common.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
