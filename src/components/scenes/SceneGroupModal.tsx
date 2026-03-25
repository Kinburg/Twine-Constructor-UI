import { useState } from 'react';
import { useT } from '../../i18n';

interface SceneGroupData {
  name: string;
  notes?: string;
}

interface Props {
  mode: 'create' | 'edit';
  initial: SceneGroupData;
  takenNames: string[];
  onSave: (data: SceneGroupData) => void;
  onClose: () => void;
}

export function SceneGroupModal({ mode, initial, takenNames, onSave, onClose }: Props) {
  const t = useT();
  const [name, setName] = useState(initial.name);
  const [notes, setNotes] = useState(initial.notes ?? '');

  const trimmedName = name.trim();
  const nameError = trimmedName === ''
    ? t.scene.groupNameEmpty
    : takenNames.includes(trimmedName)
      ? t.scene.groupNameTaken
      : null;

  const handleSave = () => {
    if (nameError) return;
    onSave({ name: trimmedName, notes: notes.trim() || undefined });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-80 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-white">
            {mode === 'create' ? t.scene.groupCreateTitle : t.scene.groupEditTitle}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors cursor-pointer text-base leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t.scene.groupFieldName}
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

          {/* Notes */}
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
        <div className="px-4 py-3 border-t border-slate-700">
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
