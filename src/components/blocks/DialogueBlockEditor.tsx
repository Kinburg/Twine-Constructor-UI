import { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { joinPath, toLocalFileUrl } from '../../lib/fsApi';
import type { DialogueBlock } from '../../types';

/**
 * Converts an avatar src value to a URL the editor renderer can actually load:
 * - External http(s):// and data: URIs — used as-is
 * - Already-resolved localfile:// URLs — used as-is
 * - Relative asset paths (e.g. "assets/chars/hero.png") — converted to
 *   localfile:// using the project directory from the Electron store
 * - Relative path with no projectDir (project not yet saved) — returns ''
 *   so the editor falls back to the 👤 placeholder gracefully
 */
function resolveEditorSrc(src: string, projectDir: string | null): string {
  if (!src) return '';
  if (/^https?:\/\//i.test(src) || src.startsWith('data:') || src.startsWith('localfile://')) {
    return src;
  }
  if (projectDir) {
    return toLocalFileUrl(joinPath(projectDir, src));
  }
  return ''; // can't resolve local path without projectDir
}

export function DialogueBlockEditor({
  block,
  sceneId,
  onUpdate,
}: {
  block: DialogueBlock;
  sceneId: string;
  onUpdate?: (patch: Partial<DialogueBlock>) => void;
}) {
  const { project, projectDir, updateBlock, saveSnapshot } = useProjectStore();
  const update = onUpdate ?? ((p: Partial<DialogueBlock>) => updateBlock(sceneId, block.id, p as never));
  const { characters } = project;

  const selectedChar = characters.find(c => c.id === block.characterId);
  const align = block.align ?? 'left';
  const isRight = align === 'right';

  // Derive avatar preview source from avatarConfig (fallback to deprecated avatarUrl)
  const avatarCfg = selectedChar?.avatarConfig;
  const isBoundAvatar = avatarCfg?.mode === 'bound';
  const rawSrc = isBoundAvatar
    ? ''   // can't show a dynamic image in the editor
    : (avatarCfg?.src ?? selectedChar?.avatarUrl ?? '');
  const avatarPreviewSrc = resolveEditorSrc(rawSrc, projectDir);

  // Track if the resolved URL fails to load (e.g. file was deleted, bad URL, etc.)
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => {
    setImgFailed(false);
  }, [avatarPreviewSrc]);

  const showImg       = Boolean(avatarPreviewSrc) && !imgFailed;
  const showBound     = !showImg && Boolean(selectedChar) && isBoundAvatar;
  const showNoAvatar  = !showImg && Boolean(selectedChar) && !isBoundAvatar;

  // Inline preview: body style
  const bodyStyle = selectedChar ? {
    background: selectedChar.bgColor,
    borderLeft:  isRight ? undefined           : `4px solid ${selectedChar.borderColor}`,
    borderRight: isRight ? `4px solid ${selectedChar.borderColor}` : undefined,
    borderRadius: '4px',
    padding: '6px 10px',
    flex: 1,
  } : { flex: 1 };

  return (
    <div className="flex flex-col gap-2">

      {/* Character selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">Персонаж:</label>
        <select
          className="flex-1 bg-slate-800 text-slate-200 text-sm rounded px-2 py-1 border border-slate-600 focus:border-indigo-500 outline-none cursor-pointer"
          value={block.characterId}
          onChange={e => update({ characterId: e.target.value })}
        >
          <option value="">— выбрать —</option>
          {characters.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {characters.length === 0 && (
          <span className="text-xs text-slate-500 italic">Нет персонажей</span>
        )}
      </div>

      {/* Alignment toggle */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">Сторона:</label>
        <div className="flex gap-1">
          <button
            className={`text-xs px-3 py-1 rounded border transition-colors cursor-pointer ${
              !isRight
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
            onClick={() => update({ align: 'left' })}
          >
            ◀ Слева
          </button>
          <button
            className={`text-xs px-3 py-1 rounded border transition-colors cursor-pointer ${
              isRight
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
            onClick={() => update({ align: 'right' })}
          >
            Справа ▶
          </button>
        </div>
      </div>

      {/* Live update toggle */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">Обновление:</label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={block.live ?? false}
            onChange={e => update({ live: e.target.checked })}
            className="accent-indigo-500 cursor-pointer"
          />
          <span className="text-xs text-slate-400">Живое обновление <span className="font-mono text-slate-500">&lt;&lt;live&gt;&gt;</span></span>
        </label>
      </div>

      {/* Text + preview */}
      <div className={`flex gap-2 items-start ${isRight ? 'flex-row-reverse' : ''}`}>
        {/* Avatar thumbnail */}
        {showImg && (
          <img
            src={avatarPreviewSrc}
            className="w-10 h-10 object-cover rounded flex-shrink-0"
            alt=""
            onError={() => setImgFailed(true)}
          />
        )}
        {showBound && (
          <div
            className="w-10 h-10 rounded flex-shrink-0 bg-slate-700 flex items-center justify-center text-slate-500 text-xs"
            title="Динамическая аватарка (зависит от переменной)"
          >
            📊
          </div>
        )}
        {showNoAvatar && (
          <div className="w-10 h-10 rounded flex-shrink-0 bg-slate-700 flex items-center justify-center text-slate-500 text-xs">
            👤
          </div>
        )}

        {/* Name + text area */}
        <div style={bodyStyle}>
          {selectedChar && (
            <span className="text-xs font-bold block mb-1" style={{ color: selectedChar.nameColor }}>
              {selectedChar.name}
            </span>
          )}
          <textarea
            className="w-full bg-transparent text-sm rounded px-0 py-0 outline-none min-h-[60px] placeholder-slate-500"
            style={{ color: selectedChar ? '#e2e8f0' : undefined }}
            placeholder="Введите реплику..."
            value={block.text}
            onFocus={saveSnapshot}
            onChange={e => update({ text: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
