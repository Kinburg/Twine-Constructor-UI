import { useState, useEffect } from 'react';
import { useProjectStore, charToVarPrefix, pregenCharVarIds } from '../../store/projectStore';
import { toLocalFileUrl, resolveAssetPath } from '../../lib/fsApi';
import { VariablePicker } from '../shared/VariablePicker';
import { TreeLevel } from '../variables/VariableManager';
import type { TreeActions } from '../variables/variableTreeShared';
import type { Character, AvatarConfig, Variable, AssetTreeNode, VariableTreeNode, VariableGroup, CharacterVarIds, CharacterInventorySlot, ItemDefinition, PaperdollConfig, PaperdollSlot, SlotPlaceholderConfig } from '../../types';
import { useT } from '../../i18n';
import { AvatarGenModal } from './AvatarGenModal';
import { ImageMappingEditor, ImageAssetPicker } from '../shared/ImageMappingEditor';

function resolveEditorSrc(src: string, projectDir: string | null): string {
  if (!src) return '';
  if (/^https?:\/\//i.test(src) || src.startsWith('data:') || src.startsWith('localfile://')) return src;
  if (projectDir) return toLocalFileUrl(resolveAssetPath(projectDir, src));
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

// ─── Synthetic variable tree for create mode ────────────────────────────────

/**
 * Build a fake VariableGroup that mirrors what buildCharVarNodes() will produce,
 * using the pre-generated IDs. Lets VariablePicker show the character's own
 * variables before the character is saved.
 */
function buildSyntheticCharGroup(
  varName: string,
  ids: CharacterVarIds,
  pendingNodes: VariableTreeNode[],
): VariableGroup {
  return {
    kind: 'group', id: ids.groupId,
    name: varName || 'char',
    children: [
      { kind: 'variable', id: ids.nameVarId, name: 'name', varType: 'string', defaultValue: '', description: '' },
      {
        kind: 'group', id: ids.stylesGroupId, name: 'styles',
        children: [
          { kind: 'variable', id: ids.bgColorVarId, name: 'bgColor', varType: 'string', defaultValue: '', description: '' },
          { kind: 'variable', id: ids.borderColorVarId, name: 'borderColor', varType: 'string', defaultValue: '', description: '' },
          { kind: 'variable', id: ids.nameColorVarId, name: 'nameColor', varType: 'string', defaultValue: '', description: '' },
          { kind: 'variable', id: ids.textColorVarId!, name: 'textColor', varType: 'string', defaultValue: '', description: '' },
          { kind: 'variable', id: ids.avatarVarId, name: 'avatar', varType: 'string', defaultValue: '', description: '' },
          { kind: 'variable', id: ids.llmDescrVarId!, name: 'llm_descr', varType: 'string', defaultValue: '', description: '' },
          { kind: 'variable', id: ids.llmTemperatureVarId!, name: 'llm_temperature', varType: 'number', defaultValue: '', description: '' },
        ],
      },
      ...pendingNodes,
    ],
  };
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
  takenVarNames: string[];
  onSave: (data: Omit<Character, 'id'>, pendingNodes: VariableTreeNode[], pregenVarIds: CharacterVarIds | null) => void;
  onClose: () => void;
}

export function CharacterModal({ mode, charId, initial, takenNames, takenVarNames, onSave, onClose }: Props) {
  const t = useT();
  const { project, addVariable, addVariableGroup, updateVariable, deleteVariableNode, addPaperdollSlot, updatePaperdollSlot, deletePaperdollSlot, setPaperdollConfig } = useProjectStore();
  const assetNodes = project.assetNodes;

  const [name, setName] = useState(initial.name);
  // In edit mode, prefer the actual group name from the variable tree as the source of truth
  const initialVarName = (() => {
    if (initial.varName) return initial.varName;
    if (mode === 'edit' && (initial as Character).varIds?.groupId) {
      const grp = findGroup(project.variableNodes, (initial as Character).varIds!.groupId);
      if (grp) return grp.name;
    }
    return charToVarPrefix(initial.name);
  })();
  const [varName, setVarName] = useState(initialVarName);
  const [varNameTouched, setVarNameTouched] = useState(mode === 'edit');
  const [nameColor, setNameColor] = useState(initial.nameColor);
  const [textColor, setTextColor] = useState(initial.textColor ?? '#e2e8f0');
  const [bgColor, setBgColor] = useState(initial.bgColor);
  const [borderColor, setBorderColor] = useState(initial.borderColor);
  const [avatarCfg, setAvatarCfg] = useState<AvatarConfig>(initial.avatarConfig ?? defaultAvatarConfig());
  const [llmDescr, setLlmDescr] = useState(initial.llm_descr ?? '');
  const [llmTemperature, setLlmTemperature] = useState<string>(
    initial.llm_temperature !== undefined ? String(initial.llm_temperature) : ''
  );
  const [initialInventory, setInitialInventory] = useState<CharacterInventorySlot[]>(initial.initialInventory ?? []);
  const [localPaperdoll, setLocalPaperdoll] = useState<PaperdollConfig | undefined>(initial.paperdoll);
  const [isHero, setIsHero] = useState(initial.isHero ?? false);

  const handleNameChange = (v: string) => {
    setName(v);
    if (!varNameTouched) setVarName(charToVarPrefix(v));
  };

  const handleVarNameChange = (v: string) => {
    setVarNameTouched(true);
    setVarName(v.toLowerCase().replace(/[^a-z0-9_]/g, ''));
  };

  // In edit mode: read live user nodes from the char's variable group (excluding auto-managed ones)
  const liveChar = mode === 'edit' && charId
    ? project.characters.find(c => c.id === charId)
    : null;
  const charUserNodes = liveChar?.varIds
    ? getCharUserNodes(project.variableNodes, liveChar.varIds.groupId, liveChar.varIds.nameVarId, liveChar.varIds.stylesGroupId)
    : [];

  // In create mode: track pending nodes locally until save
  const [pendingNodes, setPendingNodes] = useState<VariableTreeNode[]>([]);

  // Pre-generate character variable IDs in create mode so avatar bindings work before save
  const [pregenVarIds] = useState<CharacterVarIds | null>(() => mode === 'create' ? pregenCharVarIds() : null);

  const parsedTemp = llmTemperature !== '' ? parseFloat(llmTemperature) : undefined;
  // paperdoll only included in create mode — in edit mode it's managed live via store actions
  const draft: Omit<Character, 'id'> = {
    name, varName, nameColor, textColor, bgColor, borderColor,
    avatarConfig: avatarCfg, llm_descr: llmDescr, llm_temperature: parsedTemp,
    initialInventory, isHero,
    ...(mode === 'create' ? { paperdoll: localPaperdoll } : {}),
  };

  const trimmedName = name.trim();
  const nameError = trimmedName === ''
    ? t.characters.nameEmpty
    : takenNames.includes(trimmedName)
      ? t.characters.nameTaken
      : null;

  const trimmedVarName = varName.trim().replace(/^[\d_]+/, '').replace(/_+$/g, '');

  // Synthetic variable tree that mirrors what the character group will look like after saving
  const selfVarNodes: VariableTreeNode[] = (mode === 'create' && pregenVarIds)
    ? [buildSyntheticCharGroup(trimmedVarName || varName, pregenVarIds, pendingNodes)]
    : [];

  // Nodes shown in the avatar variable picker — only this character's own variables
  const avatarPickerNodes: VariableTreeNode[] = mode === 'create'
    ? selfVarNodes
    : (() => { const g = findGroup(project.variableNodes, liveChar?.varIds?.groupId ?? ''); return g ? [g] : project.variableNodes; })();

  const varNameError = trimmedVarName === ''
    ? t.characters.varNameEmpty
    : !/^[a-z][a-z0-9_]*$/.test(trimmedVarName)
      ? t.characters.varNameInvalid
      : takenVarNames.includes(trimmedVarName)
        ? t.characters.varNameTaken
        : null;

  const handleSave = () => {
    if (nameError || varNameError) return;
    onSave({ ...draft, name: trimmedName, varName: trimmedVarName }, pendingNodes, pregenVarIds);
    onClose();
  };

  // Tree actions for edit mode (backed by store)
  const editActions: TreeActions = {
    onAddVariable: (parentId, data) => addVariable(parentId, data),
    onAddGroup: (parentId, name) => addVariableGroup(parentId, name),
    onUpdateVariable: (id, patch) => updateVariable(id, patch),
    onDeleteNode: (id) => deleteVariableNode(id),
  };

  // Tree actions for create mode (backed by local state).
  // parentId === pregenVarIds.groupId means "root of this character" — map to null for pendingNodes.
  const createActions: TreeActions = {
    onAddVariable: (parentId, data) => {
      const newVar: Variable = { kind: 'variable', id: crypto.randomUUID(), name: data.name, varType: data.varType, defaultValue: data.defaultValue, description: data.description };
      const effectiveParentId = parentId === pregenVarIds?.groupId ? null : parentId;
      setPendingNodes(prev => localAddNode(prev, effectiveParentId, newVar));
    },
    onAddGroup: (parentId, name) => {
      const newGroup: VariableGroup = { kind: 'group', id: crypto.randomUUID(), name, children: [] };
      const effectiveParentId = parentId === pregenVarIds?.groupId ? null : parentId;
      setPendingNodes(prev => localAddNode(prev, effectiveParentId, newGroup));
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

          {/* Display name */}
          <Field label={t.characters.fieldName}>
            <div className="flex flex-col gap-1">
              <input
                autoFocus
                className={`w-full bg-slate-700 text-xs text-white rounded px-2 py-1 outline-none border ${nameError ? 'border-red-500 focus:border-red-400' : 'border-slate-600 focus:border-indigo-500'}`}
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              />
              {nameError && (
                <span className="text-xs text-red-400">{nameError}</span>
              )}
            </div>
          </Field>

          {/* Variable name */}
          <Field label={t.characters.fieldVarName}>
            <div className="flex flex-col gap-1">
              <input
                className={`w-full text-xs rounded px-2 py-1 outline-none border font-mono ${
                  mode === 'edit'
                    ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                    : varNameError
                      ? 'bg-slate-700 text-white border-red-500 focus:border-red-400'
                      : 'bg-slate-700 text-white border-slate-600 focus:border-indigo-500'
                }`}
                value={varName}
                onChange={e => handleVarNameChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                placeholder="gg, wife, npc_01..."
                readOnly={mode === 'edit'}
              />
              {mode !== 'edit' && (varNameError
                ? <span className="text-xs text-red-400">{varNameError}</span>
                : <span className="text-[10px] text-slate-500">{t.characters.varNameHint}</span>
              )}
            </div>
          </Field>

          {/* Main Hero */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-20 shrink-0">&nbsp;</label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-amber-400"
                checked={isHero}
                onChange={e => setIsHero(e.target.checked)}
              />
              <span className="text-xs text-slate-300">{t.characters.isHero}</span>
              <span className="text-xs text-slate-500 cursor-help" title={t.characters.heroTooltip}>ℹ️</span>
            </label>
          </div>

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

          {/* LLM Temperature */}
          <Field label="LLM Temperature">
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              className="w-full bg-slate-700 text-xs text-slate-200 rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500 placeholder-slate-500"
              placeholder="Use global setting"
              value={llmTemperature}
              onChange={e => setLlmTemperature(e.target.value)}
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
            assetNodes={assetNodes}
            onChange={setAvatarCfg}
            charVarName={varName}
            charName={name}
            charLlmDescr={llmDescr}
            charNodes={avatarPickerNodes}
          />

          {/* Initial Inventory */}
          <InitialInventoryEditor
            slots={initialInventory}
            items={project.items ?? []}
            onChange={setInitialInventory}
          />

          {/* Paperdoll */}
          <PaperdollEditor
            mode={mode}
            charId={charId}
            localConfig={localPaperdoll}
            onChange={setLocalPaperdoll}
            items={project.items ?? []}
            charNodes={avatarPickerNodes}
            charName={name}
            charLlmDescr={llmDescr}
            charVarName={varName}
            addPaperdollSlot={addPaperdollSlot}
            updatePaperdollSlot={updatePaperdollSlot}
            deletePaperdollSlot={deletePaperdollSlot}
            setPaperdollConfig={setPaperdollConfig}
            liveChar={mode === 'edit' && charId ? project.characters.find(c => c.id === charId) : undefined}
          />

          {/* Custom variables */}
          <CharacterVarsEditor
            nodes={mode === 'edit' ? charUserNodes : pendingNodes}
            allNodes={mode === 'edit' ? charUserNodes : pendingNodes}
            actions={mode === 'edit' ? editActions : createActions}
            parentId={mode === 'edit' ? (liveChar?.varIds?.groupId ?? null) : (pregenVarIds?.groupId ?? null)}
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-700 shrink-0">
          <button
            onClick={handleSave}
            disabled={!!nameError || !!varNameError}
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
  assetNodes,
  onChange,
  charVarName,
  charName,
  charLlmDescr,
  charNodes,
}: {
  cfg: AvatarConfig;
  assetNodes: AssetTreeNode[];
  onChange: (c: AvatarConfig) => void;
  charVarName: string;
  charName: string;
  charLlmDescr?: string;
  charNodes?: VariableTreeNode[];
}) {
  const t = useT();
  const { project } = useProjectStore();
  const [genModalOpen, setGenModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">{t.characters.avatarLabel}</label>
        <div className="flex gap-1 flex-wrap">
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
          <button
            className="text-xs px-2 py-1 rounded border transition-colors cursor-pointer bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500"
            onClick={() => setGenModalOpen(true)}
          >
            {t.avatarGen.generateBtn}
          </button>
        </div>
      </div>

      {genModalOpen && (
        <AvatarGenModal
          cfg={cfg}
          charVarName={charVarName || 'char'}
          charName={charName}
          charLlmDescr={charLlmDescr}
          onSave={onChange}
          onClose={() => setGenModalOpen(false)}
        />
      )}

      {/* Static mode */}
      {cfg.mode === 'static' && (
        <Field label={t.characters.fieldImage}>
          <ImageAssetPicker
            assetNodes={assetNodes}
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
              nodes={charNodes?.length ? charNodes : project.variableNodes}
              placeholder={t.characters.selectVariable}
            />
          </Field>
          <ImageMappingEditor
            mapping={cfg.mapping}
            onChange={mapping => onChange({ ...cfg, mapping })}
            defaultSrc={cfg.defaultSrc}
            onDefaultSrcChange={defaultSrc => onChange({ ...cfg, defaultSrc })}
            assetNodes={assetNodes}
          />
        </div>
      )}
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

// ─── Initial Inventory Editor ─────────────────────────────────────────────────

const ITEM_CATEGORY_ICONS: Record<string, string> = {
  wearable:   '👕',
  consumable: '🧪',
  misc:       '📦',
};

function InitialInventoryEditor({
  slots,
  items,
  onChange,
}: {
  slots: CharacterInventorySlot[];
  items: ItemDefinition[];
  onChange: (slots: CharacterInventorySlot[]) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  const addSlot = () => {
    if (items.length === 0) return;
    const firstItem = items[0];
    const newSlot: CharacterInventorySlot = {
      id: crypto.randomUUID(),
      itemVarName: firstItem.varName,
      quantity: 1,
      equipped: false,
    };
    onChange([...slots, newSlot]);
    if (!open) setOpen(true);
  };

  const updateSlot = (id: string, patch: Partial<CharacterInventorySlot>) => {
    onChange(slots.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const removeSlot = (id: string) => {
    onChange(slots.filter(s => s.id !== id));
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer py-0.5 text-left"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-slate-600 text-[10px]">{open ? '▼' : '▶'}</span>
        <span className="font-medium">{t.characters.initialInventorySection}</span>
        {slots.length > 0 && <span className="text-slate-600 font-mono">({slots.length})</span>}
      </button>

      {open && (
        <div className="flex flex-col gap-1 pl-1 border-l border-slate-700/60 mt-0.5">
          {items.length === 0 ? (
            <p className="text-xs text-slate-600 italic py-1 pl-2">{t.characters.initialInventoryNoItems}</p>
          ) : slots.length === 0 ? (
            <p className="text-xs text-slate-600 italic py-1 pl-2">{t.characters.initialInventoryEmpty}</p>
          ) : (
            <div className="flex flex-col gap-1">
              {slots.map(slot => {
                return (
                  <div key={slot.id} className="flex items-center gap-1.5">
                    {/* Item picker */}
                    <select
                      className="flex-1 min-w-0 bg-slate-700 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
                      value={slot.itemVarName}
                      onChange={e => updateSlot(slot.id, { itemVarName: e.target.value, equipped: false })}
                    >
                      {items.map(it => (
                        <option key={it.id} value={it.varName}>
                          {ITEM_CATEGORY_ICONS[it.category] ?? '📦'} {it.name}
                        </option>
                      ))}
                    </select>

                    {/* Qty */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <span className="text-[10px] text-slate-500">{t.characters.initialInventoryQty}</span>
                      <input
                        type="number"
                        min={1}
                        className="w-12 bg-slate-700 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 focus:border-indigo-500"
                        value={slot.quantity}
                        onChange={e => updateSlot(slot.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      />
                    </div>

                    {/* Delete */}
                    <button
                      type="button"
                      className="text-slate-600 hover:text-red-400 transition-colors cursor-pointer text-xs shrink-0"
                      onClick={() => removeSlot(slot.id)}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {items.length > 0 && (
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-indigo-400 hover:bg-slate-800 rounded px-2 py-1 transition-colors cursor-pointer border border-dashed border-slate-700 hover:border-indigo-600 mt-0.5"
              onClick={addSlot}
            >
              {t.characters.initialInventoryAdd}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Paperdoll Editor ─────────────────────────────────────────────────────────

function placeholderToAvatarConfig(ph: SlotPlaceholderConfig): AvatarConfig {
  return {
    mode: ph.mode,
    src: ph.src,
    variableId: ph.variableId,
    mapping: ph.mapping,
    defaultSrc: ph.defaultSrc,
    genSettings: ph.genSettings,
  };
}

function avatarConfigToPlaceholder(cfg: AvatarConfig, ph: SlotPlaceholderConfig): SlotPlaceholderConfig {
  return {
    ...ph,
    mode: cfg.mode as 'static' | 'bound',
    src: cfg.src,
    variableId: cfg.variableId,
    mapping: cfg.mapping,
    defaultSrc: cfg.defaultSrc,
    genSettings: cfg.genSettings,
  };
}

function PaperdollEditor({
  mode,
  charId,
  localConfig,
  onChange,
  items,
  charNodes,
  charName,
  charLlmDescr,
  charVarName,
  addPaperdollSlot,
  updatePaperdollSlot,
  deletePaperdollSlot,
  setPaperdollConfig,
  liveChar,
}: {
  mode: 'create' | 'edit';
  charId?: string;
  localConfig?: PaperdollConfig;
  onChange: (c: PaperdollConfig | undefined) => void;
  items: ItemDefinition[];
  /** Variable nodes belonging to this character — used for bound placeholder variable picker */
  charNodes: VariableTreeNode[];
  charName?: string;
  charLlmDescr?: string;
  charVarName?: string;
  addPaperdollSlot: (charId: string, slot: Omit<PaperdollSlot, 'id'>) => void;
  updatePaperdollSlot: (charId: string, slotId: string, patch: Partial<Omit<PaperdollSlot, 'id'>>) => void;
  deletePaperdollSlot: (charId: string, slotId: string) => void;
  setPaperdollConfig: (charId: string, config: PaperdollConfig | undefined) => void;
  liveChar?: Character;
}) {
  const t = useT();
  const { project } = useProjectStore();
  const [open, setOpen] = useState(false);
  const [genModalSlotId, setGenModalSlotId] = useState<string | null>(null);

  // In edit mode, source of truth is the live store char; in create mode, local state
  const config = mode === 'edit' ? liveChar?.paperdoll : localConfig;
  const slots = config?.slots ?? [];

  const defaultConfig = (): PaperdollConfig => ({ gridCols: 3, gridRows: 4, cellSize: 64, slots: [] });

  const handleAddSlot = () => {
    const slotData: Omit<PaperdollSlot, 'id'> = { label: 'New Slot', row: 1, col: 1 };
    if (mode === 'edit' && charId) {
      addPaperdollSlot(charId, slotData);
    } else {
      const cur = localConfig ?? defaultConfig();
      // Derive a clean ID (store logic mirrors addPaperdollSlot)
      const base = 'new_slot';
      let id = base;
      let n = 2;
      while (cur.slots.some(s => s.id === id)) { id = `${base}${n++}`; }
      onChange({ ...cur, slots: [...cur.slots, { ...slotData, id }] });
    }
    if (!open) setOpen(true);
  };

  const handleDeleteSlot = (slotId: string) => {
    if (mode === 'edit' && charId) {
      deletePaperdollSlot(charId, slotId);
    } else {
      const cur = localConfig ?? defaultConfig();
      onChange({ ...cur, slots: cur.slots.filter(s => s.id !== slotId) });
    }
  };

  const handleUpdateSlot = (slotId: string, patch: Partial<Omit<PaperdollSlot, 'id'>>) => {
    if (mode === 'edit' && charId) {
      updatePaperdollSlot(charId, slotId, patch);
    } else {
      const cur = localConfig ?? defaultConfig();
      onChange({ ...cur, slots: cur.slots.map(s => s.id === slotId ? { ...s, ...patch } : s) });
    }
  };

  const handleGridChange = (patch: Partial<Pick<PaperdollConfig, 'gridCols' | 'gridRows' | 'cellSize'>>) => {
    const cur = config ?? defaultConfig();
    const next: PaperdollConfig = { ...cur, ...patch };
    if (mode === 'edit' && charId) {
      setPaperdollConfig(charId, next);
    } else {
      onChange(next);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer py-0.5 text-left"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-slate-600 text-[10px]">{open ? '▼' : '▶'}</span>
        <span className="font-medium">{t.characters.paperdollSection}</span>
        {slots.length > 0 && <span className="text-slate-600 font-mono">({slots.length})</span>}
      </button>

      {open && (
        <div className="flex flex-col gap-2 pl-1 border-l border-slate-700/60 mt-0.5">
          {/* Grid settings */}
          <div className="flex items-center gap-3 flex-wrap">
            {([
              { key: 'gridCols' as const, label: t.characters.paperdollGridCols, def: 3 },
              { key: 'gridRows' as const, label: t.characters.paperdollGridRows, def: 4 },
              { key: 'cellSize' as const, label: t.characters.paperdollCellSize, def: 64 },
            ] as const).map(({ key, label, def }) => (
              <div key={key} className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] text-slate-500">{label}</span>
                <input
                  type="number"
                  min={1}
                  className="w-14 bg-slate-700 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 focus:border-indigo-500"
                  value={config?.[key] ?? def}
                  onChange={e => handleGridChange({ [key]: Math.max(1, parseInt(e.target.value) || 1) })}
                />
              </div>
            ))}
          </div>

          {/* Slot list */}
          {slots.length === 0 ? (
            <p className="text-xs text-slate-600 italic py-1 pl-2">{t.characters.paperdollNoSlots}</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {slots.map(slot => (
                <div key={slot.id} className="flex flex-col gap-1 border border-slate-700/50 rounded p-1.5 bg-slate-800/40">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder={t.characters.paperdollSlotLabel}
                      className="flex-1 min-w-0 bg-slate-700 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 focus:border-indigo-500"
                      value={slot.label}
                      onChange={e => handleUpdateSlot(slot.id, { label: e.target.value })}
                    />
                    <div className="flex items-center gap-0.5 shrink-0">
                      <span className="text-[10px] text-slate-500">{t.characters.paperdollRowLabel}</span>
                      <input
                        type="number"
                        min={1}
                        className="w-10 bg-slate-700 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 focus:border-indigo-500"
                        value={slot.row}
                        onChange={e => handleUpdateSlot(slot.id, { row: Math.max(1, parseInt(e.target.value) || 1) })}
                      />
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <span className="text-[10px] text-slate-500">{t.characters.paperdollColLabel}</span>
                      <input
                        type="number"
                        min={1}
                        className="w-10 bg-slate-700 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 focus:border-indigo-500"
                        value={slot.col}
                        onChange={e => handleUpdateSlot(slot.id, { col: Math.max(1, parseInt(e.target.value) || 1) })}
                      />
                    </div>
                    <button
                      type="button"
                      className="text-slate-600 hover:text-red-400 transition-colors cursor-pointer text-xs shrink-0"
                      onClick={() => handleDeleteSlot(slot.id)}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-600">{t.characters.paperdollSlotId}:</span>
                    <span className="text-[10px] text-slate-500 font-mono">{slot.id}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-500 shrink-0">{t.characters.paperdollDefaultItem}:</span>
                    <select
                      className="flex-1 min-w-0 bg-slate-700 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
                      value={slot.defaultItemVarName ?? ''}
                      onChange={e => handleUpdateSlot(slot.id, { defaultItemVarName: e.target.value || undefined })}
                    >
                      <option value="">{t.characters.paperdollDefaultItemNone}</option>
                      {items.filter(i => {
                        if (i.category !== 'wearable') return false;
                        const norm = (s: string) => (s || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                        return norm(i.targetSlot ?? '') === slot.id ||
                               (i.targetSlot ?? '').toLowerCase() === (slot.label ?? '').toLowerCase();
                      }).map(it => (
                        <option key={it.id} value={it.varName}>{it.name}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-0.5 shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-indigo-500"
                        checked={slot.clickable ?? false}
                        onChange={e => handleUpdateSlot(slot.id, { clickable: e.target.checked })}
                      />
                      <span className="text-[10px] text-slate-400">{t.characters.paperdollSlotClickable}</span>
                    </label>
                  </div>

                  {/* Placeholder config */}
                  {(() => {
                    const ph: SlotPlaceholderConfig = slot.placeholder ?? {
                      mode: 'static',
                      src: slot.placeholderIcon ?? '',
                      variableId: '',
                      mapping: [],
                      defaultSrc: '',
                    };
                    const setPh = (patch: Partial<SlotPlaceholderConfig>) =>
                      handleUpdateSlot(slot.id, { placeholder: { ...ph, ...patch } });
                    return (
                      <div className="flex flex-col gap-1.5 pl-1 border-l border-slate-700/60 mt-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-500 shrink-0">{t.characters.paperdollPlaceholderIcon}:</span>
                          <button
                            type="button"
                            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                              ph.mode === 'static'
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200'
                            }`}
                            onClick={() => setPh({ mode: 'static' })}
                          >
                            {t.characters.paperdollPlaceholderStatic}
                          </button>
                          <button
                            type="button"
                            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                              ph.mode === 'bound'
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200'
                            }`}
                            onClick={() => setPh({ mode: 'bound' })}
                          >
                            {t.characters.paperdollPlaceholderBound}
                          </button>
                          <button
                            type="button"
                            className="text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200"
                            onClick={() => setGenModalSlotId(slot.id)}
                          >
                            {t.avatarGen.generateBtn}
                          </button>
                        </div>

                        {ph.mode === 'static' && (
                          <ImageAssetPicker
                            assetNodes={project.assetNodes}
                            value={ph.src}
                            onChange={src => setPh({ src })}
                          />
                        )}

                        {ph.mode === 'bound' && (
                          <div className="flex flex-col gap-1">
                            <VariablePicker
                              value={ph.variableId}
                              onChange={variableId => setPh({ variableId })}
                              nodes={charNodes}
                              placeholder={t.characters.paperdollPlaceholderSelectVar}
                            />
                            <ImageMappingEditor
                              mapping={ph.mapping}
                              onChange={mapping => setPh({ mapping })}
                              defaultSrc={ph.defaultSrc}
                              onDefaultSrcChange={defaultSrc => setPh({ defaultSrc })}
                              assetNodes={project.assetNodes}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="text-xs text-slate-500 hover:text-indigo-400 hover:bg-slate-800 rounded px-2 py-1 transition-colors cursor-pointer border border-dashed border-slate-700 hover:border-indigo-600 mt-0.5"
            onClick={handleAddSlot}
          >
            {t.characters.paperdollAddSlot}
          </button>
        </div>
      )}

      {/* Generate modal for placeholder slot */}
      {genModalSlotId !== null && (() => {
        const genSlot = slots.find(s => s.id === genModalSlotId);
        if (!genSlot) return null;
        const ph: SlotPlaceholderConfig = genSlot.placeholder ?? {
          mode: 'static',
          src: genSlot.placeholderIcon ?? '',
          variableId: '',
          mapping: [],
          defaultSrc: '',
        };
        const avatarCfg = placeholderToAvatarConfig(ph);
        return (
          <AvatarGenModal
            cfg={avatarCfg}
            charVarName={`${charVarName || 'char'}_${genSlot.id}`}
            charName={charName ?? ''}
            charLlmDescr={charLlmDescr}
            assetSubfolder={`paperdoll/${charVarName || 'char'}`}
            modalTitle={`✨ ${genSlot.label}`}
            slotLabelStatic={genSlot.label}
            slotLabelDefault={genSlot.label}
            entityKind="paperdoll-slot"
            onSave={updatedCfg => {
              const updatedPh = avatarConfigToPlaceholder(updatedCfg, ph);
              handleUpdateSlot(genSlot.id, { placeholder: updatedPh });
            }}
            onClose={() => setGenModalSlotId(null)}
          />
        );
      })()}
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
