import { useState, useEffect, useRef } from 'react';
import type { Variable, VariableTreeNode } from '../../types';
import { getVariablePath } from '../../utils/treeUtils';
import { PickerTree } from '../shared/VariablePicker';

/**
 * A text input with an inline "$" button that opens a hierarchical variable picker dropdown.
 * Allows both free-text values (literals) and variable references ($path.to.var).
 */
export function VarValueInput({
  value,
  onChange,
  vars,
  placeholder,
  className,
  variableNodes,
}: {
  value: string;
  onChange: (v: string) => void;
  vars: Variable[];
  placeholder?: string;
  className?: string;
  variableNodes?: VariableTreeNode[];
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  const nodes = variableNodes ?? [];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node) &&
          dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => { if (open) setTimeout(() => filterRef.current?.focus(), 0); }, [open]);

  const toggleGroup = (id: string) => {
    setExpanded(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const handleSelect = (id: string) => {
    const path = variableNodes ? getVariablePath(id, variableNodes) : (vars.find(v => v.id === id)?.name ?? '???');
    onChange(`$${path}`);
    setOpen(false);
    setFilter('');
  };

  // Calculate fixed position for the dropdown
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const openPicker = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 2, left: Math.min(rect.left, window.innerWidth - 220) });
    }
    setOpen(true);
    setFilter('');
  };

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
          onClick={() => open ? setOpen(false) : openPicker()}
        >
          $
        </button>
      )}
      {open && pos && (
        <div
          ref={dropRef}
          className="fixed z-[9999] bg-slate-900 border border-slate-600 rounded shadow-xl flex flex-col"
          style={{ top: pos.top, left: pos.left, width: 220, maxHeight: 240 }}
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
    </div>
  );
}
