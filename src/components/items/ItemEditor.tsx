import { useState } from 'react';
import { useProjectStore, charToVarPrefix } from '../../store/projectStore';
import { toLocalFileUrl, resolveAssetPath } from '../../lib/fsApi';
import { ImageAssetPicker } from '../shared/ImageMappingEditor';
import { AvatarGenModal } from '../characters/AvatarGenModal';
import { TreeLevel } from '../variables/VariableManager';
import type { TreeActions } from '../variables/variableTreeShared';
import type {
  ItemDefinition, ItemCategory, ItemIconConfig, ItemIconMode,
  Variable, VariableGroup, VariableTreeNode,
  AvatarConfig,
} from '../../types';
import { useT } from '../../i18n';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeVarName(v: string): string {
  return charToVarPrefix(v);
}

function resolveEditorSrc(src: string, projectDir: string | null): string {
  if (!src) return '';
  if (/^https?:\/\//i.test(src) || src.startsWith('data:') || src.startsWith('localfile://')) return src;
  // resolveAssetPath already adds /release/ for assets/... paths
  if (projectDir) return toLocalFileUrl(resolveAssetPath(projectDir, src));
  return '';
}

/** Build a minimal AvatarConfig from an ItemIconConfig so we can reuse AvatarGenModal */
function iconToAvatarConfig(iconCfg: ItemIconConfig): AvatarConfig {
  return {
    mode: 'static',
    src: iconCfg.src,
    variableId: '',
    mapping: [],
    defaultSrc: '',
    genSettings: iconCfg.genSettings,
  };
}

function avatarConfigToIconCfg(avatar: AvatarConfig, mode: ItemIconMode): ItemIconConfig {
  return { mode, src: avatar.src, genSettings: avatar.genSettings };
}

// ─── Local tree helpers (same pattern as CharacterModal) ──────────────────────

function localAddNode(nodes: VariableTreeNode[], parentId: string | null, node: VariableTreeNode): VariableTreeNode[] {
  if (parentId === null) return [...nodes, node];
  return nodes.map(n => {
    if (n.kind === 'group' && n.id === parentId) return { ...n, children: [...n.children, node] };
    if (n.kind === 'group') return { ...n, children: localAddNode(n.children, parentId, node) };
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

/** Find item's own var group in the full variableNodes tree */
function findItemGroup(nodes: VariableTreeNode[], groupId: string): VariableGroup | null {
  for (const n of nodes) {
    if (n.kind === 'group' && n.id === groupId) return n;
    if (n.kind === 'group') {
      const found = findItemGroup(n.children, groupId);
      if (found) return found;
    }
  }
  return null;
}

/** Return user-added children (non-system vars) of the item group */
const SYSTEM_VAR_NAMES = new Set(['name', 'icon', 'price', 'description', 'stackable', 'slot']);

function getItemUserNodes(
  nodes: VariableTreeNode[],
  groupId: string,
): VariableTreeNode[] {
  const group = findItemGroup(nodes, groupId);
  if (!group) return [];
  return group.children.filter(n => n.kind !== 'variable' || !SYSTEM_VAR_NAMES.has(n.name));
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  mode: 'create' | 'edit';
  initial: Omit<ItemDefinition, 'id' | 'varIds'>;
  takenNames: string[];
  takenVarNames: string[];
  onSave: (data: Omit<ItemDefinition, 'id' | 'varIds'>) => void;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ItemEditor({ mode, initial, takenNames, takenVarNames, onSave, onClose }: Props) {
  const t = useT();
  const {
    project,
    addVariable, addVariableGroup, updateVariable, deleteVariableNode,
  } = useProjectStore();

  const [name, setName] = useState(initial.name);
  const [varName, setVarName] = useState(initial.varName);
  const [varNameTouched, setVarNameTouched] = useState(mode === 'edit');
  const [category, setCategory] = useState<ItemCategory>(initial.category);
  const [stackable, setStackable] = useState(initial.stackable);
  const [targetSlot, setTargetSlot] = useState(initial.targetSlot ?? '');
  const [iconCfg, setIconCfg] = useState<ItemIconConfig>(
    initial.iconConfig ?? { mode: 'static', src: '' },
  );
  const [genModalOpen, setGenModalOpen] = useState(false);

  // In create mode: pending custom variable nodes added before saving
  const [pendingNodes, setPendingNodes] = useState<VariableTreeNode[]>([]);

  // In edit mode: read live user nodes from the item's var group
  const liveItem = mode === 'edit'
    ? (project.items ?? []).find(i => i.name === initial.name && i.varName === initial.varName)
    : null;

  const itemUserNodes = liveItem?.varIds
    ? getItemUserNodes(project.variableNodes, liveItem.varIds.groupId)
    : [];

  // The useFuncSceneId (edit mode only)
  const useFuncSceneId = mode === 'edit'
    ? (initial as ItemDefinition).useFuncSceneId
    : undefined;
  const funcScene = useFuncSceneId
    ? project.scenes.find(s => s.id === useFuncSceneId)
    : undefined;

  // ── Name / varName sync ────────────────────────────────────────────────────
  const handleNameChange = (v: string) => {
    setName(v);
    if (!varNameTouched) setVarName(sanitizeVarName(v));
  };

  const handleVarNameChange = (v: string) => {
    setVarNameTouched(true);
    setVarName(v.toLowerCase().replace(/[^a-z0-9_]/g, ''));
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const trimmedName    = name.trim();
  const trimmedVarName = varName.trim().replace(/^[\d_]+/, '').replace(/_+$/g, '');

  const nameError = trimmedName === ''
    ? t.items.nameEmpty
    : takenNames.includes(trimmedName)
      ? t.items.nameTaken
      : null;

  const varNameError = trimmedVarName === ''
    ? t.items.varNameEmpty
    : !/^[a-z][a-z0-9_]*$/.test(trimmedVarName)
      ? t.items.varNameInvalid
      : takenVarNames.includes(trimmedVarName)
        ? t.items.varNameTaken
        : null;

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (nameError || varNameError) return;
    onSave({
      name: trimmedName,
      varName: trimmedVarName,
      category,
      stackable,
      targetSlot: category === 'wearable' ? targetSlot.trim() : undefined,
      iconConfig: iconCfg,
      customProps: pendingNodes
        .filter(n => n.kind === 'variable')
        .map(n => ({
          id: n.id,
          name: (n as Variable).name,
          varType: (n as Variable).varType as 'number' | 'string' | 'boolean',
          defaultValue: (n as Variable).defaultValue,
        })),
      // carry over existing func scene id in edit mode
      ...(useFuncSceneId ? { useFuncSceneId } : {}),
    });
    onClose();
  };

  // ── Tree actions (edit mode — backed by store) ─────────────────────────────
  const editActions: TreeActions = {
    onAddVariable:  (parentId, data)        => addVariable(parentId, data),
    onAddGroup:     (parentId, name)        => addVariableGroup(parentId, name),
    onUpdateVariable: (id, patch)           => updateVariable(id, patch),
    onDeleteNode:   (id)                    => deleteVariableNode(id),
  };

  // ── Tree actions (create mode — backed by local state) ────────────────────
  const createActions: TreeActions = {
    onAddVariable: (parentId, data) => {
      const newVar: Variable = {
        kind: 'variable', id: crypto.randomUUID(),
        name: data.name, varType: data.varType,
        defaultValue: data.defaultValue, description: data.description,
      };
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

  const { projectDir } = useProjectStore();
  const assetNodes = project.assetNodes;
  const iconPreviewSrc = resolveEditorSrc(iconCfg.src, projectDir);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-[440px] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
          <h2 className="text-sm font-semibold text-white">
            {mode === 'create' ? t.items.createTitle : t.items.editTitle}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors cursor-pointer text-base leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3">

          {/* Icon preview + picker */}
          <div className="flex items-start gap-3">
            {/* Preview */}
            <div className="w-16 h-16 rounded bg-slate-700 border border-slate-600 flex items-center justify-center shrink-0 overflow-hidden">
              {iconPreviewSrc ? (
                <img src={iconPreviewSrc} className="w-full h-full object-cover" alt="" />
              ) : (
                <span className="text-2xl">{category === 'wearable' ? '👕' : category === 'consumable' ? '🧪' : '📦'}</span>
              )}
            </div>

            {/* Icon mode + picker */}
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">{t.items.fieldIcon}:</label>
              <div className="flex gap-1">
                <button
                  className={`text-xs px-2 py-1 rounded border transition-colors cursor-pointer ${
                    iconCfg.mode === 'static'
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200'
                  }`}
                  onClick={() => setIconCfg({ ...iconCfg, mode: 'static' })}
                >
                  {t.items.iconStatic}
                </button>
                <button
                  className={`text-xs px-2 py-1 rounded border transition-colors cursor-pointer ${
                    iconCfg.mode === 'generated'
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200'
                  }`}
                  onClick={() => { setIconCfg({ ...iconCfg, mode: 'generated' }); setGenModalOpen(true); }}
                >
                  {t.items.iconGenerated}
                </button>
              </div>

              {iconCfg.mode === 'static' && (
                <ImageAssetPicker
                  assetNodes={assetNodes}
                  value={iconCfg.src}
                  onChange={src => setIconCfg({ ...iconCfg, src })}
                />
              )}

              {iconCfg.mode === 'generated' && iconCfg.src && (
                <div className="flex gap-1 items-center">
                  <span className="text-[10px] text-slate-500 truncate flex-1">{iconCfg.src}</span>
                  <button
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer"
                    onClick={() => setGenModalOpen(true)}
                  >
                    {t.items.iconGenerated}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Name */}
          <Field label={t.items.fieldName}>
            <div className="flex flex-col gap-1">
              <input
                autoFocus
                className={`w-full bg-slate-700 text-xs text-white rounded px-2 py-1 outline-none border ${
                  nameError ? 'border-red-500' : 'border-slate-600 focus:border-indigo-500'
                }`}
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              />
              {nameError && <span className="text-xs text-red-400">{nameError}</span>}
            </div>
          </Field>

          {/* Variable name */}
          <Field label={t.items.fieldVarName}>
            <div className="flex flex-col gap-1">
              <input
                className={`w-full text-xs rounded px-2 py-1 outline-none border font-mono ${
                  mode === 'edit'
                    ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                    : varNameError
                      ? 'bg-slate-700 text-white border-red-500'
                      : 'bg-slate-700 text-white border-slate-600 focus:border-indigo-500'
                }`}
                value={varName}
                readOnly={mode === 'edit'}
                onChange={e => handleVarNameChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              />
              {mode !== 'edit' && (varNameError
                ? <span className="text-xs text-red-400">{varNameError}</span>
                : <span className="text-[10px] text-slate-500">{t.items.varNameHint}</span>
              )}
              {mode !== 'edit' && !varNameError && (
                <span className="text-[10px] text-slate-600 font-mono">$items.{trimmedVarName || '…'}.name</span>
              )}
            </div>
          </Field>

          {/* Category */}
          <Field label={t.items.fieldCategory}>
            <div className="flex gap-1 flex-wrap">
              {(['wearable', 'consumable', 'misc'] as ItemCategory[]).map(cat => (
                <button
                  key={cat}
                  className={`text-xs px-2 py-1 rounded border transition-colors cursor-pointer ${
                    category === cat
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200'
                  }`}
                  onClick={() => setCategory(cat)}
                >
                  {t.items[`category${cat.charAt(0).toUpperCase() + cat.slice(1)}` as 'categoryWearable' | 'categoryConsumable' | 'categoryMisc']}
                </button>
              ))}
            </div>
          </Field>

          {/* Target slot — wearable only */}
          {category === 'wearable' && (
            <Field label={t.items.fieldTargetSlot}>
              <div className="flex flex-col gap-1">
                <input
                  className="w-full bg-slate-700 text-xs text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 font-mono"
                  value={targetSlot}
                  onChange={e => setTargetSlot(e.target.value)}
                  placeholder="head, chest, rightHand..."
                />
                <span className="text-[10px] text-slate-500">{t.items.targetSlotHint}</span>
              </div>
            </Field>
          )}

          {/* Stackable */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-20 shrink-0">{t.items.fieldStackable}:</label>
            <button
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                stackable ? 'bg-indigo-600' : 'bg-slate-600'
              }`}
              onClick={() => setStackable(v => !v)}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                stackable ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Consumable func scene hint */}
          {category === 'consumable' && funcScene && (
            <div className="text-[10px] text-slate-500 bg-slate-700/50 rounded px-2 py-1">
              {t.items.consumableFuncHint}{' '}
              <span className="font-mono text-indigo-400">{funcScene.name}</span>
            </div>
          )}
          {category === 'consumable' && !funcScene && mode === 'create' && (
            <div className="text-[10px] text-slate-500 bg-slate-700/50 rounded px-2 py-1">
              {t.items.consumableFuncHint}{' '}
              <span className="font-mono text-indigo-400">tg_use_{trimmedVarName || '…'}</span>
            </div>
          )}

          {/* Custom variables */}
          <ItemVarsEditor
            nodes={mode === 'edit' ? itemUserNodes : pendingNodes}
            allNodes={mode === 'edit' ? itemUserNodes : pendingNodes}
            actions={mode === 'edit' ? editActions : createActions}
            parentId={mode === 'edit' ? (liveItem?.varIds?.groupId ?? null) : null}
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-700 shrink-0">
          <button
            onClick={handleSave}
            disabled={!!nameError || !!varNameError}
            className="w-full py-1.5 text-xs rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            {t.items.save}
          </button>
        </div>
      </div>

      {/* Generation modal (reuse AvatarGenModal for single-image generation) */}
      {genModalOpen && (
        <AvatarGenModal
          cfg={iconToAvatarConfig(iconCfg)}
          charVarName={trimmedVarName || 'item'}
          charName={name}
          charLlmDescr=""
          assetSubfolder="items"
          modalTitle={t.items.iconGenerated}
          onSave={avatar => setIconCfg(avatarConfigToIconCfg(avatar, 'generated'))}
          onClose={() => setGenModalOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Custom vars editor ───────────────────────────────────────────────────────

function ItemVarsEditor({
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
    setExpandedIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) { s.delete(id); } else { s.add(id); }
      return s;
    });

  return (
    <div className="flex flex-col gap-1">
      <button
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer select-none w-full"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-slate-600 text-[10px]">{open ? '▼' : '▶'}</span>
        <span className="font-medium">{t.items.customVarsSection}</span>
        {nodes.length > 0 && <span className="text-slate-600 font-mono">({nodes.length})</span>}
      </button>

      {open && (
        <div className="flex flex-col gap-0.5 pl-1 border-l border-slate-700/60 mt-0.5">
          {nodes.length === 0 && (
            <p className="text-xs text-slate-600 italic py-1 pl-2">{t.items.customVarsEmpty}</p>
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

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <label className="text-xs text-slate-400 w-20 shrink-0 pt-1">{label}:</label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
