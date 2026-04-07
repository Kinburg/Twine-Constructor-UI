import { useState, useEffect } from 'react';
import { useProjectStore, flattenAssets } from '../../store/projectStore';
import { joinPath, toLocalFileUrl } from '../../lib/fsApi';
import { VariablePicker } from '../shared/VariablePicker';
import { TreeLevel } from '../variables/VariableManager';
import type { TreeActions } from '../variables/variableTreeShared';
import type { Character, AvatarConfig, ImageBoundMapping, Variable, Asset, VariableTreeNode, VariableGroup } from '../../types';
import { useT } from '../../i18n';

function resolveEditorSrc(src: string, projectDir: string | null): string {
  if (!src) return '';
  if (/^https?:\/\//i.test(src) || src.startsWith('data:') || src.startsWith('localfile://')) return src;
  if (projectDir) return toLocalFileUrl(joinPath(projectDir, src));
  return '';
}

function defaultAvatarConfig(): AvatarConfig {
  return { mode: 'static', src: '', variableId: '', mapping: [], defaultSrc: '' };
}

/** Find a group by ID anywhere in the variable tree */
function findGroup(nodes: VariableTreeNode[], id: string): VariableGroup | null {
  for (const n of nodes) {
    if (n.kind === 'group' && n.id === id) return n;
    if (n.kind === 'group') {
      const found = findGroup(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Returns user-added children of the character's root group,
 * excluding the auto-managed name var and styles group.
 */
function getCharUserNodes(nodes: VariableTreeNode[], groupId: string, nameVarId: string, stylesGroupId: string): VariableTreeNode[] {
  const group = findGroup(nodes, groupId);
  if (!group) return [];
  return group.children.filter(n => n.id !== nameVarId && n.id !== stylesGroupId);
}

// ─── Local tree operations for create mode ──────────────────────────────────

function localAddNode(nodes: VariableTreeNode[], parentId: string | null, node: VariableTreeNode): VariableTreeNode[] {
  if (parentId === null) return [...nodes, node];
  return nodes.map(n => {
    if (n.kind === 'group' && n.id === parentId) {
      return { ...n, children: [...n.children, node] };
    }
    if (n.kind === 'group') {
      return { ...n, children: localAddNode(n.children, parentId, node) };
    }
    return n;
  });
}

function localRemoveNode(nodes: VariableTreeNode[], id: string): VariableTreeNode[] {
  return nodes
    .filter(n => n.id !== id)
    .map(n => n.kind === 'group' ? { ...n, children: localRemoveNode(n.children, id) } : n);
}

function localUpdateVar(nodes: VariableTreeNode[], id: string, patch: Partial<Variable>): VariableTreeNode[] {
  return nodes.map(n => {
    if (n.kind === 'variable' && n.id === id) return { ...n, ...patch };
    if (n.kind === 'group') return { ...n, children: localUpdateVar(n.children, id, patch) };
    return n;
  });
}

interface Props {
  mode: 'create' | 'edit';
  charId?: string;
  initial: Omit<Character, 'id'>;
  takenNames: string[];
  onSave: (data: Omit<Character, 'id'>, pendingNodes: VariableTreeNode[]) => void;
  onClose: () => void;
}

export function CharacterModal({ mode, charId, initial, takenNames, onSave, onClose }: Props) {
  const t = useT();
  const { project, addVariable, addVariableGroup, updateVariable, deleteVariableNode } = useProjectStore();
  const imgAssets = flattenAssets(project.assetNodes).filter(a => a.assetType === 'image');

  const [name, setName] = useState(initial.name);
  const [nameColor, setNameColor] = useState(initial.nameColor);
  const [textColor, setTextColor] = useState(initial.textColor ?? '#e2e8f0');
  const [bgColor, setBgColor] = useState(initial.bgColor);
  const [borderColor, setBorderColor] = useState(initial.borderColor);
  const [avatarCfg, setAvatarCfg] = useState<AvatarConfig>(initial.avatarConfig ?? defaultAvatarConfig());
  const [llmDescr, setLlmDescr] = useState(initial.llm_descr ?? '');

  // In edit mode: read live user nodes from the char's variable group (excluding auto-managed ones)
  const liveChar = mode === 'edit' && charId
    ? project.characters.find(c => c.id === charId)
    : null;
  const charUserNodes = liveChar?.varIds
    ? getCharUserNodes(project.variableNodes, liveChar.varIds.groupId, liveChar.varIds.nameVarId, liveChar.varIds.stylesGroupId)
    : [];

  // In create mode: track pending nodes locally until save
  const [pendingNodes, setPendingNodes] = useState<VariableTreeNode[]>([]);

  const draft: Omit<Character, 'id'> = { name, nameColor, textColor, bgColor, borderColor, avatarConfig: avatarCfg, llm_descr: llmDescr };

  const trimmedName = name.trim();
  const nameError = trimmedName === ''
    ? t.characters.nameEmpty
    : takenNames.includes(trimmedName)
      ? t.characters.nameTaken
      : null;

  const handleSave = () => {
    if (nameError) return;
    onSave({ ...draft, name: trimmedName }, pendingNodes);
    onClose();
  };

  // Tree actions for edit mode (backed by store)
  const editActions: TreeActions = {
    onAddVariable: (parentId, data) => addVariable(parentId, data),
    onAddGroup: (parentId, name) => addVariableGroup(parentId, name),
    onUpdateVariable: (id, patch) => updateVariable(id, patch),
    onDeleteNode: (id) => deleteVariableNode(id),
  };

  // Tree actions for create mode (backed by local state)
  const createActions: TreeActions = {
    onAddVariable: (parentId, data) => {
      const newVar: Variable = { kind: 'variable', id: crypto.randomUUID(), name: data.name, varType: data.varType, defaultValue: data.defaultValue, description: data.description };
      setPendingNodes(prev => localAddNode(prev, parentId, newVar));
    },
    onAddGroup: (parentId, name) => {
      const newGroup: VariableGroup = { kind: 'group', id: crypto.randomUUID(), name, children: [] };
      setPendingNodes(prev => localAddNode(prev, parentId, newGroup));
    },
    onUpdateVariable: (id, patch) => {
      setPendingNodes(prev => localUpdateVar(prev, id, patch));
    },
    onDeleteNode: (id) => {
      setPendingNodes(prev => localRemoveNode(prev, id));
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-[480px] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
          <h2 className="text-sm font-semibold text-white">
            {mode === 'create' ? t.characters.createTitle : t.characters.editTitle}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors cursor-pointer text-base leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3">
          {/* Live preview */}
          <CharacterPreview char={draft} avatarCfg={avatarCfg} />

          {/* Name */}
          <Field label={t.characters.fieldName}>
            <div className="flex flex-col gap-1">
              <input
                autoFocus
                className={`w-full bg-slate-700 text-xs text-white rounded px-2 py-1 outline-none border ${nameError ? 'border-red-500 focus:border-red-400' : 'border-slate-600 focus:border-indigo-500'}`}
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              />
              {nameError && (
                <span className="text-xs text-red-400">{nameError}</span>
              )}
            </div>
          </Field>

          {/* LLM Description */}
          <Field label="LLM Description">
            <textarea
              className="w-full bg-slate-700 text-xs text-slate-200 rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500 resize-none placeholder-slate-500"
              rows={3}
              placeholder="Personality, speech patterns, appearance..."
              value={llmDescr}
              onChange={e => setLlmDescr(e.target.value)}
            />
          </Field>

          {/* Name color */}
          <Field label={t.characters.fieldNameColor}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-8 h-7 rounded cursor-pointer bg-transparent border-0"
                value={nameColor}
                onChange={e => setNameColor(e.target.value)}
              />
              <span className="text-xs font-mono" style={{ color: nameColor }}>{nameColor}</span>
            </div>
          </Field>

          {/* Text color */}
          <Field label={t.characters.fieldTextColor}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-8 h-7 rounded cursor-pointer bg-transparent border-0"
                value={textColor}
                onChange={e => setTextColor(e.target.value)}
              />
              <span className="text-xs font-mono" style={{ color: textColor }}>{textColor}</span>
            </div>
          </Field>

          {/* Dialog background */}
          <Field label={t.characters.fieldDialogBg}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-8 h-7 rounded cursor-pointer bg-transparent border-0"
                value={bgColor}
                onChange={e => setBgColor(e.target.value)}
              />
              <span className="text-xs font-mono text-slate-300">{bgColor}</span>
            </div>
          </Field>

          {/* Accent color */}
          <Field label={t.characters.fieldAccent}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-8 h-7 rounded cursor-pointer bg-transparent border-0"
                value={borderColor}
                onChange={e => setBorderColor(e.target.value)}
              />
              <span className="text-xs font-mono text-slate-300">{borderColor}</span>
            </div>
          </Field>

          {/* Avatar */}
          <AvatarEditor
            cfg={avatarCfg}
            imgAssets={imgAssets}
            onChange={setAvatarCfg}
          />

          {/* Custom variables */}
          <CharacterVarsEditor
            nodes={mode === 'edit' ? charUserNodes : pendingNodes}
            allNodes={mode === 'edit' ? charUserNodes : pendingNodes}
            actions={mode === 'edit' ? editActions : createActions}
            parentId={mode === 'edit' && liveChar?.varIds ? liveChar.varIds.groupId : null}
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-700 shrink-0">
          <button
            onClick={handleSave}
            disabled={!!nameError}
            className="w-full py-1.5 text-xs rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-500 disabled:hover:bg-indigo-600 text-white"
          >
            {t.characters.save}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Character preview ──────────────────────────────────────────────────────────

function CharacterPreview({ char, avatarCfg }: { char: Omit<Character, 'id'>; avatarCfg: AvatarConfig }) {
  const t = useT();
  const { projectDir } = useProjectStore();

  const boundSrcs = avatarCfg.mode === 'bound'
    ? [...avatarCfg.mapping.map(m => m.src), avatarCfg.defaultSrc].filter(Boolean)
    : [];

  const [cycleIdx, setCycleIdx] = useState(0);

  useEffect(() => { setCycleIdx(0); }, [avatarCfg.mode, avatarCfg.variableId]);

  useEffect(() => {
    if (avatarCfg.mode !== 'bound' || boundSrcs.length <= 1) return;
    const id = setInterval(() => setCycleIdx(i => (i + 1) % boundSrcs.length), 2000);
    return () => clearInterval(id);
  });

  let rawSrc = '';
  if (avatarCfg.mode === 'static' && avatarCfg.src) {
    rawSrc = avatarCfg.src;
  } else if (avatarCfg.mode === 'bound' && boundSrcs.length > 0) {
    rawSrc = boundSrcs[cycleIdx % boundSrcs.length];
  }
  const avatarSrc = resolveEditorSrc(rawSrc, projectDir);

  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => { setImgFailed(false); }, [avatarSrc]);

  const showAvatar = Boolean(avatarSrc) && !imgFailed;

  return (
    <div
      className="rounded p-2 flex gap-2 items-start"
      style={{ background: char.bgColor, borderLeft: `4px solid ${char.borderColor}` }}
    >
      {showAvatar && (
        <img
          src={avatarSrc}
          className="w-10 h-10 object-cover rounded flex-shrink-0"
          alt=""
          onError={() => setImgFailed(true)}
        />
      )}
      <div className="flex-1">
        <span className="text-xs font-bold block" style={{ color: char.nameColor }}>
          {char.name || t.characters.fieldName}
        </span>
        <p className="text-xs italic m-0" style={{ color: char.textColor ?? '#e2e8f0' }}>{t.characters.exampleLine}</p>
      </div>
    </div>
  );
}

// ─── Avatar editor ─────────────────────────────────────────────────────────────

function AvatarEditor({
  cfg,
  imgAssets,
  onChange,
}: {
  cfg: AvatarConfig;
  imgAssets: Asset[];
  onChange: (c: AvatarConfig) => void;
}) {
  const t = useT();
  const { project } = useProjectStore();
  return (
    <div className="flex flex-col gap-2">
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{t.characters.avatarLabel}</label>
        <div className="flex gap-1">
          <button
            className={`text-xs px-2 py-1 rounded border transition-colors cursor-pointer ${
              cfg.mode === 'static'
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
            onClick={() => onChange({ ...cfg, mode: 'static' })}
          >
            {t.characters.avatarStatic}
          </button>
          <button
            className={`text-xs px-2 py-1 rounded border transition-colors cursor-pointer ${
              cfg.mode === 'bound'
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
            onClick={() => onChange({ ...cfg, mode: 'bound' })}
          >
            {t.characters.avatarDynamic}
          </button>
        </div>
      </div>

      {/* Static mode */}
      {cfg.mode === 'static' && (
        <Field label={t.characters.fieldImage}>
          <AvatarImagePicker
            imgAssets={imgAssets}
            value={cfg.src}
            onChange={src => onChange({ ...cfg, src })}
          />
        </Field>
      )}

      {/* Bound mode */}
      {cfg.mode === 'bound' && (
        <div className="flex flex-col gap-1.5">
          <Field label={t.characters.fieldVariable}>
            <VariablePicker
              value={cfg.variableId}
              onChange={id => onChange({ ...cfg, variableId: id })}
              nodes={project.variableNodes}
              placeholder={t.characters.selectVariable}
            />
          </Field>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{t.characters.mappingsLabel}</span>
              <button
                className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                onClick={() => onChange({
                  ...cfg,
                  mapping: [
                    ...cfg.mapping,
                    {
                      id: crypto.randomUUID(),
                      matchType: 'exact',
                      value: '',
                      rangeMin: '',
                      rangeMax: '',
                      src: '',
                    } satisfies ImageBoundMapping,
                  ],
                })}
              >
                {t.characters.addMapping}
              </button>
            </div>

            {cfg.mapping.map((m, i) => (
              <MappingEntry
                key={m.id ?? i}
                m={m}
                imgAssets={imgAssets}
                onChange={patch => onChange({
                  ...cfg,
                  mapping: cfg.mapping.map((x, j) => j === i ? { ...x, ...patch } : x),
                })}
                onDelete={() => onChange({
                  ...cfg,
                  mapping: cfg.mapping.filter((_, j) => j !== i),
                })}
              />
            ))}

            {cfg.mapping.length === 0 && (
              <p className="text-xs text-slate-600 italic">{t.characters.noMappings}</p>
            )}

            <div className="flex flex-col gap-1 mt-0.5">
              <span className="text-xs text-slate-400">{t.characters.defaultMapping}</span>
              <AvatarImagePicker
                imgAssets={imgAssets}
                value={cfg.defaultSrc}
                onChange={defaultSrc => onChange({ ...cfg, defaultSrc })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mapping entry row ─────────────────────────────────────────────────────────

function MappingEntry({
  m,
  imgAssets,
  onChange,
  onDelete,
}: {
  m: ImageBoundMapping;
  imgAssets: Asset[];
  onChange: (patch: Partial<ImageBoundMapping>) => void;
  onDelete: () => void;
}) {
  const t = useT();
  const mt = m.matchType ?? 'exact';
  return (
    <div className="flex flex-col gap-1 border border-slate-700/60 rounded p-1.5">
      <div className="flex items-center gap-1">
        <select
          className="flex-1 bg-slate-700 text-xs text-white rounded px-1.5 py-0.5 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
          value={mt}
          onChange={e => onChange({ matchType: e.target.value as 'exact' | 'range' })}
        >
          <option value="exact">{t.cellModal.matchExact}</option>
          <option value="range">{t.cellModal.matchRange}</option>
        </select>
        <button
          className="text-slate-600 hover:text-red-400 text-xs cursor-pointer shrink-0 ml-1"
          onClick={onDelete}
        >
          ✕
        </button>
      </div>

      {mt === 'exact' && (
        <div className="flex gap-1 items-center">
          <span className="text-xs text-slate-500 shrink-0 w-10">{t.cellModal.valueLabel}</span>
          <input
            className="flex-1 bg-slate-700 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 font-mono"
            placeholder="happy"
            value={m.value}
            onChange={e => onChange({ value: e.target.value })}
          />
        </div>
      )}

      {mt === 'range' && (
        <div className="grid grid-cols-2 gap-1">
          <div className="flex gap-1 items-center">
            <span className="text-xs text-slate-500 shrink-0 w-6">{t.cellModal.fromLabel}</span>
            <input
              className="flex-1 min-w-0 bg-slate-700 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 font-mono"
              placeholder="0"
              value={m.rangeMin ?? ''}
              onChange={e => onChange({ rangeMin: e.target.value })}
            />
          </div>
          <div className="flex gap-1 items-center">
            <span className="text-xs text-slate-500 shrink-0">{t.cellModal.toLabel}</span>
            <input
              className="flex-1 min-w-0 bg-slate-700 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 font-mono"
              placeholder="20"
              value={m.rangeMax ?? ''}
              onChange={e => onChange({ rangeMax: e.target.value })}
            />
          </div>
        </div>
      )}

      <div className="flex gap-1 items-start">
        <span className="text-xs text-slate-500 shrink-0 pt-1.5 w-10">{t.cellModal.fileLabel}</span>
        <AvatarImagePicker
          imgAssets={imgAssets}
          value={m.src}
          onChange={src => onChange({ src })}
        />
      </div>
    </div>
  );
}

// ─── Asset image picker ────────────────────────────────────────────────────────

function AvatarImagePicker({
  imgAssets,
  value,
  onChange,
}: {
  imgAssets: Asset[];
  value: string;
  onChange: (src: string) => void;
}) {
  const t = useT();
  const matched = imgAssets.find(a => a.relativePath === value);

  return (
    <div className="flex-1 flex flex-col gap-1 min-w-0">
      {imgAssets.length > 0 && (
        <select
          className="w-full bg-slate-700 text-xs text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
          value={matched?.id ?? ''}
          onChange={e => {
            const asset = imgAssets.find(a => a.id === e.target.value);
            if (asset) onChange(asset.relativePath);
            else if (e.target.value === '') onChange('');
          }}
        >
          <option value="">{t.cellModal.selectAsset}</option>
          {imgAssets.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      )}
      <input
        className="w-full bg-slate-700 text-xs text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 font-mono"
        placeholder="assets/img.png or https://..."
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

// ─── Character vars editor (tree-based) ─────────────────────────────────────

function CharacterVarsEditor({
  nodes,
  allNodes,
  actions,
  parentId,
}: {
  nodes: VariableTreeNode[];
  allNodes: VariableTreeNode[];
  actions: TreeActions;
  parentId: string | null;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingVarId, setEditingVarId] = useState<string | null>(null);

  const toggleExpand = (id: string) =>
    setExpandedIds(prev => { const s = new Set(prev); if (s.has(id)) { s.delete(id); } else { s.add(id); } return s; });

  const totalCount = nodes.length;

  return (
    <div className="flex flex-col gap-1">
      <button
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer select-none w-full"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-slate-600 text-[10px]">{open ? '▼' : '▶'}</span>
        <span className="font-medium">{t.characters.customVarsSection}</span>
        {totalCount > 0 && <span className="text-slate-600 font-mono">({totalCount})</span>}
      </button>

      {open && (
        <div className="flex flex-col gap-0.5 pl-1 border-l border-slate-700/60 mt-0.5">
          {nodes.length === 0 && (
            <p className="text-xs text-slate-600 italic py-1 pl-2">{t.characters.customVarsEmpty}</p>
          )}

          <TreeLevel
            nodes={nodes}
            depth={0}
            expandedIds={expandedIds}
            editingVarId={editingVarId}
            onToggleExpand={toggleExpand}
            onEditVar={setEditingVarId}
            parentId={parentId}
            allNodes={allNodes}
            pathPrefix=""
            actions={actions}
            showAddAtRoot
          />
        </div>
      )}
    </div>
  );
}

// ─── Field helper ──────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <label className="text-xs text-slate-400 w-20 shrink-0 pt-1">{label}:</label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
