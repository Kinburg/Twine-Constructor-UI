import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useT } from '../../i18n';

interface Props {
  onResolved: (sceneId: string) => void;
}

export function InventoryPopupShortcut({ onResolved }: Props) {
  const t = useT();
  const project = useProjectStore(s => s.project);
  const findOrCreate = useProjectStore(s => s.findOrCreateInventoryPopup);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const chars = project.characters;
  if (chars.length === 0) return null;

  const sorted = [...chars].sort((a, b) => Number(!!b.isHero) - Number(!!a.isHero));

  const pick = (charId: string) => {
    const sceneId = findOrCreate(charId);
    onResolved(sceneId);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        className="text-xs px-1.5 py-1 rounded border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
        title={t.actionType.createInventoryPopupTitle}
        onClick={() => setOpen(v => !v)}
      >
        {t.actionType.createInventoryPopup}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-50 min-w-[180px] bg-slate-900 border border-slate-700 rounded shadow-lg p-1">
          {sorted.map(c => (
            <button
              key={c.id}
              type="button"
              className="w-full text-left text-xs px-2 py-1 rounded hover:bg-slate-700 text-slate-200 cursor-pointer"
              onClick={() => pick(c.id)}
            >
              {c.name}{c.isHero ? ' ★' : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
