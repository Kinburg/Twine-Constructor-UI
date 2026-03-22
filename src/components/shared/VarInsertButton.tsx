import { useState, useEffect, useRef, useCallback } from 'react';
import type { Variable, VariableTreeNode } from '../../types';
import { getVariablePath } from '../../utils/treeUtils';
import { PickerTree } from './VariablePicker';

/**
 * A small `$` button that opens a hierarchical variable picker dropdown.
 * On selection, inserts `$path.to.var` at the cursor position of the target element.
 *
 * Uses position:fixed so the dropdown escapes any overflow:hidden parents.
 */
export function VarInsertButton({
  targetRef,
  value,
  onChange,
  vars,
  variableNodes,
}: {
  targetRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  value: string;
  onChange: (v: string) => void;
  vars: Variable[];
  variableNodes?: VariableTreeNode[];
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  const nodes = variableNodes ?? [];

  const openDropdown = useCallback(() => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const maxH = Math.min(Math.max(spaceBelow, 120), 320);
      const left = Math.min(rect.left, window.innerWidth - 220);
      setPos({ top: rect.bottom + 2, left, maxHeight: maxH });
    }
    setOpen(true);
    setFilter('');
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

  // Close on scroll (but not when scrolling inside the dropdown itself)
  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      if (dropRef.current && dropRef.current.contains(e.target as Node)) return;
      setOpen(false); setFilter('');
    };
    document.addEventListener('scroll', handler, true);
    return () => document.removeEventListener('scroll', handler, true);
  }, [open]);

  // Focus filter on open
  useEffect(() => { if (open) setTimeout(() => filterRef.current?.focus(), 0); }, [open]);

  const toggleGroup = (id: string) => {
    setExpanded(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const handleSelect = (id: string) => {
    const el = targetRef.current;
    const path = variableNodes ? getVariablePath(id, variableNodes) : (vars.find(v => v.id === id)?.name ?? '???');
    const text = `$${path}`;
    if (el) {
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const newValue = value.slice(0, start) + text + value.slice(end);
      onChange(newValue);
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
          className="fixed z-[9999] bg-slate-900 border border-slate-600 rounded shadow-xl flex flex-col"
          style={{ top: pos.top, left: pos.left, width: 220, maxHeight: pos.maxHeight }}
        >
          <input
            ref={filterRef}
            className="text-xs bg-slate-800 text-white px-2 py-1 outline-none border-b border-slate-700 rounded-t"
            placeholder="Filter..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
          />
          <div className="overflow-y-auto flex-1 py-1">
            {nodes.length > 0 ? (
              <PickerTree
                nodes={nodes}
                depth={0}
                expanded={expanded}
                onToggleGroup={toggleGroup}
                onSelect={handleSelect}
                selectedId=""
                filterText={filter.toLowerCase()}
                allNodes={nodes}
              />
            ) : (
              /* Fallback: flat list when variableNodes not provided */
              vars.map(v => (
                <div
                  key={v.id}
                  className="flex items-center gap-1.5 px-2 py-0.5 cursor-pointer hover:bg-slate-800 text-slate-300"
                  style={{ paddingLeft: 8 }}
                  onClick={() => handleSelect(v.id)}
                >
                  <span className="text-xs font-mono truncate flex-1">${v.name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
