import { useState, useEffect, useRef, useCallback } from 'react';
import type { Variable } from '../../types';

/**
 * A small `$` button that opens a variable picker dropdown.
 * On selection, inserts `$varName` at the cursor position of the target element.
 *
 * Uses position:fixed so the dropdown escapes any overflow:hidden parents.
 */
export function VarInsertButton({
  targetRef,
  value,
  onChange,
  vars,
}: {
  targetRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  value: string;
  onChange: (v: string) => void;
  vars: Variable[];
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Calculate dropdown position from button's bounding rect
  const openDropdown = useCallback(() => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      // Prefer dropping down-right; flip left if it would overflow viewport
      const left = Math.min(rect.left, window.innerWidth - 180);
      setPos({ top: rect.bottom + 2, left });
    }
    setOpen(true);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        btnRef.current && !btnRef.current.contains(target) &&
        dropRef.current && !dropRef.current.contains(target)
      ) {
        setOpen(false);
        setFilter('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on scroll (dropdown is fixed, so it would detach)
  useEffect(() => {
    if (!open) return;
    const handler = () => { setOpen(false); setFilter(''); };
    // Capture phase catches scrolls on any ancestor
    document.addEventListener('scroll', handler, true);
    return () => document.removeEventListener('scroll', handler, true);
  }, [open]);

  const filtered = filter
    ? vars.filter(v => v.name.toLowerCase().includes(filter.toLowerCase()))
    : vars;

  const insert = (varName: string) => {
    const el = targetRef.current;
    const text = `$${varName}`;
    if (el) {
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const newValue = value.slice(0, start) + text + value.slice(end);
      onChange(newValue);
      // Restore cursor after React re-render
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + text.length;
        el.focus();
      });
    } else {
      onChange(value + text);
    }
    setOpen(false);
    setFilter('');
  };

  if (vars.length === 0) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="px-1.5 py-0.5 text-xs text-slate-500 hover:text-indigo-400 bg-slate-800 border border-slate-600 hover:border-indigo-500 rounded cursor-pointer transition-colors leading-none font-mono"
        title="Insert variable"
        onClick={() => open ? setOpen(false) : openDropdown()}
      >
        $
      </button>
      {open && pos && (
        <div
          ref={dropRef}
          className="fixed z-[9999] min-w-40 bg-slate-800 border border-slate-600 rounded shadow-lg overflow-hidden"
          style={{ top: pos.top, left: pos.left }}
        >
          {vars.length > 6 && (
            <input
              className="w-full bg-slate-900 text-xs text-white px-2 py-1 outline-none border-b border-slate-600 font-mono"
              placeholder="filter..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              autoFocus
            />
          )}
          <div className="max-h-40 overflow-y-auto">
            {filtered.map(v => (
              <button
                key={v.id}
                type="button"
                className="w-full text-left px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 font-mono cursor-pointer"
                onClick={() => insert(v.name)}
              >
                ${v.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <span className="block px-2 py-1 text-xs text-slate-500 italic">—</span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
