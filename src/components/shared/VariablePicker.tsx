import { useState, useRef, useEffect, useCallback } from 'react';
import type { VariableTreeNode, VariableType, VariableGroup } from '../../types';
import { getVariablePath, hasLeafVariables } from '../../utils/treeUtils';

export interface VariablePickerProps {
  value: string;                // currently selected variableId
  onChange: (id: string) => void;
  nodes: VariableTreeNode[];    // project.variableNodes
  placeholder?: string;
  filterType?: VariableType;    // optional: only show variables of this type
  className?: string;
}

export function VariablePicker({ value, onChange, nodes, placeholder, filterType, className }: VariablePickerProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  // Resolve selected variable's display path
  const selectedPath = value ? getVariablePath(value, nodes) : '';

  const openPanel = useCallback(() => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const maxH = Math.max(spaceBelow, spaceAbove, 120);
      const top = spaceBelow >= Math.min(maxH, 240) ? rect.bottom + 2 : rect.top - Math.min(maxH, 240) - 2;
      setPos({ top, left: Math.min(rect.left, window.innerWidth - 220), maxHeight: Math.min(maxH, 320) });
    }
    setOpen(true);
    setFilter('');
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Focus filter input when panel opens
  useEffect(() => { if (open) setTimeout(() => filterRef.current?.focus(), 0); }, [open]);

  const toggleGroup = (id: string) => {
    setExpanded(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const filterLower = filter.toLowerCase();

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={className || "flex-1 min-w-0 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer text-left truncate"}
        onClick={() => open ? setOpen(false) : openPanel()}
      >
        {selectedPath ? <span className="font-mono">${selectedPath}</span> : <span className="text-slate-500">{placeholder || 'Select variable...'}</span>}
      </button>

      {open && pos && (
        <div
          ref={panelRef}
          className="fixed z-[9999] bg-slate-900 border border-slate-600 rounded shadow-xl flex flex-col"
          style={{ top: pos.top, left: pos.left, width: 220, maxHeight: pos.maxHeight }}
        >
          {/* Filter */}
          <input
            ref={filterRef}
            className="text-xs bg-slate-800 text-white px-2 py-1 outline-none border-b border-slate-700 rounded-t"
            placeholder="Filter..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
          />

          {/* Tree */}
          <div className="overflow-y-auto flex-1 py-1">
            <PickerTree
              nodes={nodes}
              depth={0}
              expanded={expanded}
              onToggleGroup={toggleGroup}
              onSelect={handleSelect}
              selectedId={value}
              filterType={filterType}
              filterText={filterLower}
              allNodes={nodes}
            />
          </div>
        </div>
      )}
    </>
  );
}

// ─── Reusable tree renderer ──────────────────────────────────────────────────

export function PickerTree({
  nodes, depth, expanded, onToggleGroup, onSelect, selectedId, filterType, filterText, allNodes,
}: {
  nodes: VariableTreeNode[];
  depth: number;
  expanded: Set<string>;
  onToggleGroup: (id: string) => void;
  onSelect: (id: string) => void;
  selectedId: string;
  filterType?: VariableType;
  filterText: string;
  allNodes: VariableTreeNode[];
}) {
  return (
    <>
      {nodes.map(node => {
        if (node.kind === 'group') {
          // Skip groups with no matching leaf variables
          if (!hasLeafVariables(node, filterType)) return null;
          if (filterText && !groupMatchesFilter(node, filterText, filterType)) return null;

          const isExp = expanded.has(node.id) || !!filterText;
          return (
            <div key={node.id}>
              <div
                className="flex items-center gap-1 px-2 py-0.5 cursor-pointer hover:bg-slate-800 transition-colors"
                style={{ paddingLeft: depth * 12 + 8 }}
                onClick={() => onToggleGroup(node.id)}
              >
                <span className="text-slate-500 text-xs w-3 shrink-0">{isExp ? '▾' : '▸'}</span>
                <span className="text-orange-400/60 text-xs font-mono shrink-0">{'{}'}</span>
                <span className="text-xs text-slate-400 truncate">{node.name}</span>
              </div>
              {isExp && (
                <PickerTree
                  nodes={node.children}
                  depth={depth + 1}
                  expanded={expanded}
                  onToggleGroup={onToggleGroup}
                  onSelect={onSelect}
                  selectedId={selectedId}
                  filterType={filterType}
                  filterText={filterText}
                  allNodes={allNodes}
                />
              )}
            </div>
          );
        }

        // Variable leaf
        if (filterType && node.varType !== filterType) return null;
        const path = getVariablePath(node.id, allNodes) || node.name;
        if (filterText && !path.toLowerCase().includes(filterText) && !node.name.toLowerCase().includes(filterText)) return null;

        const isSelected = node.id === selectedId;
        return (
          <div
            key={node.id}
            className={`flex items-center gap-1.5 px-2 py-0.5 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-600/30 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
            style={{ paddingLeft: depth * 12 + 8 }}
            onClick={() => onSelect(node.id)}
          >
            <span className={`text-xs font-mono w-3 shrink-0 ${typeColor(node.varType)}`}>{node.varType[0].toUpperCase()}</span>
            <span className="text-xs font-mono truncate flex-1">{node.name}</span>
            {isSelected && <span className="text-xs text-indigo-400">✓</span>}
          </div>
        );
      })}
    </>
  );
}

export function typeColor(t: VariableType): string {
  switch (t) {
    case 'number': return 'text-sky-400';
    case 'string': return 'text-emerald-400';
    case 'boolean': return 'text-amber-400';
    case 'array': return 'text-violet-400';
    default: return 'text-slate-400';
  }
}

/** Check if any leaf variable in this group matches the filter text */
export function groupMatchesFilter(group: VariableGroup, filterText: string, filterType?: VariableType): boolean {
  return group.children.some(n => {
    if (n.kind === 'variable') {
      if (filterType && n.varType !== filterType) return false;
      return n.name.toLowerCase().includes(filterText);
    }
    if (n.kind === 'group') return groupMatchesFilter(n, filterText, filterType);
    return false;
  });
}
