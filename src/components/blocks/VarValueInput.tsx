import { useState, useEffect, useRef } from 'react';
import type { Variable } from '../../types';

/**
 * A text input with an inline "$" button that opens a variable picker dropdown.
 * Allows both free-text values (literals) and variable references ($varName).
 */
export function VarValueInput({
  value,
  onChange,
  vars,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  vars: Variable[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <input
        className="w-full bg-slate-800 text-xs text-white rounded px-1.5 pr-5 py-1 border border-slate-600 focus:border-indigo-500 outline-none font-mono"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {vars.length > 0 && (
        <button
          type="button"
          title="Insert variable"
          className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 text-xs leading-none cursor-pointer"
          onClick={() => setOpen(o => !o)}
        >
          $
        </button>
      )}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-0.5 min-w-full w-max bg-slate-800 border border-slate-600 rounded shadow-lg max-h-36 overflow-y-auto">
          {vars.map(v => (
            <button
              key={v.id}
              type="button"
              className="w-full text-left px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 font-mono cursor-pointer whitespace-nowrap"
              onClick={() => { onChange(`$${v.name}`); setOpen(false); }}
            >
              ${v.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
