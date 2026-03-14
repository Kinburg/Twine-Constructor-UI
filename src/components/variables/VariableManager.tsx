import { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import type { Variable, VariableGroup, VariableTreeNode, VariableType } from '../../types';
import { useT } from '../../i18n';

const TYPE_DEFAULTS: Record<VariableType, string> = {
  number: '0', string: '', boolean: 'false', array: '[]',
};

const TYPE_COLOR: Record<VariableType, string> = {
  number: 'text-sky-400', string: 'text-emerald-400', boolean: 'text-amber-400', array: 'text-violet-400',
};

// ─── Root component ───────────────────────────────────────────────────────────

export function VariableManager() {
  const t = useT();
  const { project, addVariableGroup, addVariable } = useProjectStore();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingVarId, setEditingVarId] = useState<string | null>(null);

  // Inline "new group" input at root level
  const [addingRootGroup, setAddingRootGroup] = useState(false);
  const [rootGroupName, setRootGroupName] = useState('');
  const rootGroupRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (addingRootGroup) rootGroupRef.current?.focus(); }, [addingRootGroup]);

  const toggleExpand = (id: string) =>
    setExpandedIds(prev => { const s = new Set(prev); if (s.has(id)) { s.delete(id); } else { s.add(id); } return s; });

  const confirmRootGroup = () => {
    const name = rootGroupName.trim();
    if (name) addVariableGroup(null, name);
    setAddingRootGroup(false);
    setRootGroupName('');
  };

  const handleAddRootVar = () => {
    const nodes = project.variableNodes;
    const allFlat = countVars(nodes);
    addVariable(null, { name: `var${allFlat + 1}`, varType: 'number', defaultValue: '0', description: '' });
  };

  return (
    <div className="p-2 flex flex-col gap-1">
      <TreeLevel
        nodes={project.variableNodes}
        depth={0}
        expandedIds={expandedIds}
        editingVarId={editingVarId}
        onToggleExpand={toggleExpand}
        onEditVar={setEditingVarId}
        parentId={null}
      />

      {/* Root-level "add group" inline input */}
      {addingRootGroup ? (
        <input
          ref={rootGroupRef}
          className="text-xs bg-slate-800 text-white rounded px-2 py-1 outline-none border border-indigo-500 font-mono mt-1"
          placeholder={t.variables.groupNamePlaceholder}
          value={rootGroupName}
          onChange={e => setRootGroupName(e.target.value)}
          onBlur={confirmRootGroup}
          onKeyDown={e => {
            if (e.key === 'Enter') confirmRootGroup();
            if (e.key === 'Escape') { setAddingRootGroup(false); setRootGroupName(''); }
          }}
        />
      ) : (
        <div className="flex gap-1 mt-1 flex-wrap">
          <button
            className="text-xs text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded px-2 py-1 transition-colors cursor-pointer"
            onClick={handleAddRootVar}
          >
            {t.variables.addVariable}
          </button>
          <button
            className="text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded px-2 py-1 transition-colors cursor-pointer"
            onClick={() => setAddingRootGroup(true)}
          >
            {t.variables.addGroup}
          </button>
        </div>
      )}
    </div>
  );
}

function countVars(nodes: VariableTreeNode[]): number {
  return nodes.reduce((acc, n) => {
    if (n.kind === 'variable') return acc + 1;
    return acc + countVars(n.children);
  }, 0);
}

// ─── Tree level ───────────────────────────────────────────────────────────────

function TreeLevel({
  nodes, depth, expandedIds, editingVarId, onToggleExpand, onEditVar, parentId,
}: {
  nodes: VariableTreeNode[];
  depth: number;
  expandedIds: Set<string>;
  editingVarId: string | null;
  onToggleExpand: (id: string) => void;
  onEditVar: (id: string | null) => void;
  parentId: string | null;
}) {
  const t = useT();
  const { addVariable, addVariableGroup } = useProjectStore();
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupName, setGroupName]     = useState('');
  const groupInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (addingGroup) groupInputRef.current?.focus(); }, [addingGroup]);

  const confirmGroup = () => {
    const name = groupName.trim();
    if (name) addVariableGroup(parentId, name);
    setAddingGroup(false);
    setGroupName('');
  };

  if (nodes.length === 0 && depth === 0) {
    return <p className="text-xs text-slate-600 italic px-2 py-1">{t.variables.empty}</p>;
  }

  return (
    <>
      {nodes.map(node => {
        if (node.kind === 'group') {
          return (
            <GroupNode
              key={node.id}
              group={node}
              depth={depth}
              expanded={expandedIds.has(node.id)}
              expandedIds={expandedIds}
              editingVarId={editingVarId}
              onToggleExpand={onToggleExpand}
              onEditVar={onEditVar}
            />
          );
        }
        return (
          <VariableNode
            key={node.id}
            variable={node}
            depth={depth}
            expanded={editingVarId === node.id}
            onToggle={() => onEditVar(editingVarId === node.id ? null : node.id)}
          />
        );
      })}

      {/* Inline group add (only for non-root: root handles it separately) */}
      {depth > 0 && (
        addingGroup ? (
          <input
            ref={groupInputRef}
            className="text-xs bg-slate-800 text-white rounded px-2 py-1 outline-none border border-indigo-500 font-mono"
            style={{ marginLeft: depth * 12 + 4 }}
            placeholder={t.variables.groupNamePlaceholder}
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            onBlur={confirmGroup}
            onKeyDown={e => {
              if (e.key === 'Enter') confirmGroup();
              if (e.key === 'Escape') { setAddingGroup(false); setGroupName(''); }
            }}
          />
        ) : (
          <div className="flex gap-1 flex-wrap" style={{ paddingLeft: depth * 12 + 4 }}>
            <button
              className="text-xs text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded px-2 py-1 transition-colors cursor-pointer"
              onClick={() => {
                const allFlat = countVars(nodes);
                addVariable(parentId, { name: `var${allFlat + 1}`, varType: 'number', defaultValue: '0', description: '' });
              }}
            >
              {t.variables.addVariable}
            </button>
            <button
              className="text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded px-2 py-1 transition-colors cursor-pointer"
              onClick={() => setAddingGroup(true)}
            >
              {t.variables.addGroup}
            </button>
          </div>
        )
      )}
    </>
  );
}

// ─── Group node ───────────────────────────────────────────────────────────────

function GroupNode({
  group, depth, expanded, expandedIds, editingVarId, onToggleExpand, onEditVar,
}: {
  group: VariableGroup;
  depth: number;
  expanded: boolean;
  expandedIds: Set<string>;
  editingVarId: string | null;
  onToggleExpand: (id: string) => void;
  onEditVar: (id: string | null) => void;
}) {
  const t = useT();
  const { deleteVariableNode } = useProjectStore();

  return (
    <div>
      <div
        className="flex items-center gap-1 rounded px-2 py-1 cursor-pointer hover:bg-slate-800 transition-colors group/grp"
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={() => onToggleExpand(group.id)}
      >
        <span className="text-slate-500 text-xs w-3 shrink-0">{expanded ? '▾' : '▸'}</span>
        <span className="text-xs text-slate-300 font-medium flex-1 truncate">{group.name}</span>
        <button
          className="text-slate-700 hover:text-red-400 text-xs cursor-pointer opacity-0 group-hover/grp:opacity-100 transition-opacity"
          onClick={e => {
            e.stopPropagation();
            if (confirm(t.variables.confirmDeleteGroup(group.name)))
              deleteVariableNode(group.id);
          }}
        >
          ✕
        </button>
      </div>
      {expanded && (
        <div>
          <TreeLevel
            nodes={group.children}
            depth={depth + 1}
            expandedIds={expandedIds}
            editingVarId={editingVarId}
            onToggleExpand={onToggleExpand}
            onEditVar={onEditVar}
            parentId={group.id}
          />
        </div>
      )}
    </div>
  );
}

// ─── Variable node ────────────────────────────────────────────────────────────

function VariableNode({
  variable: v, depth, expanded, onToggle,
}: {
  variable: Variable;
  depth: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const { updateVariable, deleteVariableNode } = useProjectStore();
  const upd = (patch: Partial<Variable>) => updateVariable(v.id, patch);

  return (
    <div className="rounded border border-slate-700/60 overflow-hidden" style={{ marginLeft: depth * 12 }}>
      {/* Header row */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-slate-800 transition-colors group/var"
        onClick={onToggle}
      >
        <span className={`text-xs font-mono font-bold ${TYPE_COLOR[v.varType]} w-3 shrink-0`}>
          {v.varType[0].toUpperCase()}
        </span>
        <span className="flex-1 text-xs text-white font-mono truncate">${v.name}</span>
        <span className="text-xs text-slate-500 font-mono truncate max-w-[50px]">{v.defaultValue || '…'}</span>
        <button
          className="text-slate-700 hover:text-red-400 text-xs cursor-pointer opacity-0 group-hover/var:opacity-100 transition-opacity"
          onClick={e => {
            e.stopPropagation();
            if (confirm(t.variables.confirmDeleteVar(v.name))) deleteVariableNode(v.id);
          }}
        >
          ✕
        </button>
        <span className="text-slate-500 text-xs">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 py-2 flex flex-col gap-2 border-t border-slate-700 bg-slate-800/30">
          <Field label={t.variables.fieldName}>
            <input
              className="flex-1 bg-slate-800 text-xs text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 font-mono"
              value={v.name}
              onChange={e => upd({ name: e.target.value.replace(/[^a-zA-Zа-яёА-ЯЁ0-9_]/g, '') })}
              placeholder="varName"
            />
            <span className="text-xs text-slate-500 font-mono ml-1">($)</span>
          </Field>

          <Field label={t.variables.fieldType}>
            <select
              className="flex-1 bg-slate-800 text-xs text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
              value={v.varType}
              onChange={e => {
                const varType = e.target.value as VariableType;
                upd({ varType, defaultValue: TYPE_DEFAULTS[varType] });
              }}
            >
              <option value="number">{t.variables.typeNumber}</option>
              <option value="string">{t.variables.typeString}</option>
              <option value="boolean">{t.variables.typeBoolean}</option>
              <option value="array">{t.variables.typeArray}</option>
            </select>
          </Field>

          <Field label={t.variables.fieldDefault}>
            {v.varType === 'boolean' ? (
              <select
                className="flex-1 bg-slate-800 text-xs text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
                value={v.defaultValue}
                onChange={e => upd({ defaultValue: e.target.value })}
              >
                <option value="false">false</option>
                <option value="true">true</option>
              </select>
            ) : (
              <input
                className="flex-1 bg-slate-800 text-xs text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 font-mono"
                value={v.defaultValue}
                placeholder={v.varType === 'number' ? t.variables.defaultPlaceholderNumber : v.varType === 'array' ? '[]' : t.variables.defaultPlaceholderText}
                onChange={e => upd({ defaultValue: e.target.value })}
              />
            )}
          </Field>

          <Field label={t.variables.fieldDescription}>
            <input
              className="flex-1 bg-slate-800 text-xs text-slate-300 rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
              value={v.description}
              placeholder={t.variables.descriptionPlaceholder}
              onChange={e => upd({ description: e.target.value })}
            />
          </Field>

          <div className="text-xs text-slate-500 font-mono bg-slate-800/60 px-2 py-1 rounded">
            {'<<set $' + v.name + ' to ' + (v.varType === 'string' ? `"${v.defaultValue}"` : v.defaultValue || (v.varType === 'array' ? '[]' : v.defaultValue)) + '>>'}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-400 w-20 shrink-0">{label}:</label>
      <div className="flex-1 flex items-center gap-1">{children}</div>
    </div>
  );
}
