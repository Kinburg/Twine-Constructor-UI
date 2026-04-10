import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Project, ProjectSettings, Scene, SceneGroup, Block, Character, CharacterVarIds,
  Variable, VariableGroup, VariableTreeNode,
  Asset, AssetGroup, AssetTreeNode,
  ChoiceOption, ConditionBranch,
  SidebarPanel, SidebarTab, SidebarRow, SidebarCell, CellContent, PanelStyle,
  AvatarConfig, AvatarMode,
  Watcher,
} from '../types';
import { START_TAG } from '../types';
import { flattenVariables, flattenAssets, hasSiblingNameConflict } from '../utils/treeUtils';

export { flattenVariables, flattenAssets };

// ─── Defaults ─────────────────────────────────────────────────────────────────

function uuid(): string { return crypto.randomUUID(); }
function generateIfid(): string { return uuid().toUpperCase(); }

const HISTORY_LIMIT = 100;

export const DEFAULT_PANEL_STYLE: PanelStyle = {
  rowGap:          2,
  borderWidth:     1,
  borderColor:     '#555555',
  showOuterBorder: false,
  showRowBorders:  false,
  showCellBorders: false,
};

const DEFAULT_PANEL: SidebarPanel = { tabs: [], liveUpdate: false, style: DEFAULT_PANEL_STYLE };

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  historyControls: true,
  saveLoadMenu:    true,
};

function makeDefaultProject(): Project {
  return {
    id: uuid(),
    title: 'New Project',
    ifid: generateIfid(),
    settings: { ...DEFAULT_PROJECT_SETTINGS },
    scenes: [{ id: uuid(), name: 'Start', tags: ['start'], blocks: [] }],
    sceneGroups: [],
    characters: [],
    variableNodes: [],
    assetNodes: [],
    sidebarPanel: DEFAULT_PANEL,
    watchers: [],
  };
}

// ─── Generic tree helpers (shared by variable & asset trees) ──────────────────

type AnyNode = { id: string; kind: string; children?: AnyNode[] };

function removeNode<T extends AnyNode>(nodes: T[], id: string): T[] {
  return nodes
    .filter(n => n.id !== id)
    .map(n => n.children ? { ...n, children: removeNode(n.children as T[], id) } : n) as T[];
}

/** Get the children of a parent group (or root nodes if parentId is null) */
function getSiblings(nodes: VariableTreeNode[], parentId: string | null): VariableTreeNode[] {
  if (parentId === null) return nodes;
  for (const n of nodes) {
    if (n.kind === 'group') {
      if (n.id === parentId) return n.children;
      const found = getSiblings(n.children, parentId);
      if (found) return found;
    }
  }
  return [];
}

/** Ensure a unique name among siblings by appending a numeric suffix */
function ensureUniqueName(name: string, siblings: VariableTreeNode[]): string {
  if (!hasSiblingNameConflict(name, siblings)) return name;
  let i = 2;
  while (hasSiblingNameConflict(`${name}${i}`, siblings)) i++;
  return `${name}${i}`;
}

function addNode<T extends AnyNode>(nodes: T[], parentId: string | null, node: T): T[] {
  if (parentId === null) return [...nodes, node];
  return nodes.map(n => {
    if (n.kind !== 'group' || n.id !== parentId) {
      if (n.children) return { ...n, children: addNode(n.children as T[], parentId, node) };
      return n;
    }
    return { ...n, children: [...(n.children ?? []), node] };
  }) as T[];
}

// ─── Variable tree helpers ─────────────────────────────────────────────────────

function updateVarInTree(
  nodes: VariableTreeNode[],
  id: string,
  patch: Partial<Variable>,
): VariableTreeNode[] {
  return nodes.map(n => {
    if (n.kind === 'variable' && n.id === id) return { ...n, ...patch };
    if (n.kind === 'group') return { ...n, children: updateVarInTree(n.children, id, patch) };
    return n;
  });
}

// ─── Character variable helpers ────────────────────────────────────────────────

/**
 * Cyrillic → Latin transliteration table (Russian + common letters).
 * SugarCube variables must be ASCII-only identifiers.
 */
const CYRILLIC_MAP: Record<string, string> = {
  'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh',
  'з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o',
  'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts',
  'ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
};

function transliterate(s: string): string {
  return s.split('').map(c => CYRILLIC_MAP[c] ?? c).join('');
}

/**
 * Sanitize a character name into a valid SugarCube variable prefix.
 * Cyrillic is transliterated to Latin first; spaces → underscore;
 * strips non-ASCII and leading digits/underscores.
 * Examples: "John Doe" → "john_doe", "Дима" → "dima", "Поля" → "polya"
 */
export function charToVarPrefix(name: string): string {
  const s = transliterate(name.trim().toLowerCase())
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')   // keep only ASCII letters, digits, underscores
    .replace(/_+/g, '_')
    .replace(/^[\d_]+/, '')        // strip leading digits / underscores
    .replace(/_+$/g, '');
  return s || 'char';
}

/**
 * Pre-generate all variable IDs for a new character before it is saved.
 * Pass the result to addCharacter() so that avatar bindings set during
 * creation resolve to the correct variables after saving.
 */
export function pregenCharVarIds(): CharacterVarIds {
  return {
    groupId: crypto.randomUUID(),
    stylesGroupId: crypto.randomUUID(),
    nameVarId: crypto.randomUUID(),
    bgColorVarId: crypto.randomUUID(),
    borderColorVarId: crypto.randomUUID(),
    nameColorVarId: crypto.randomUUID(),
    textColorVarId: crypto.randomUUID(),
    avatarVarId: crypto.randomUUID(),
    llmDescrVarId: crypto.randomUUID(),
    llmTemperatureVarId: crypto.randomUUID(),
  };
}

/**
 * Rename a group node anywhere in the variable tree.
 */
function updateGroupNameInTree(
  nodes: VariableTreeNode[],
  groupId: string,
  name: string,
): VariableTreeNode[] {
  return nodes.map(n => {
    if (n.kind === 'group' && n.id === groupId) return { ...n, name };
    if (n.kind === 'group') return { ...n, children: updateGroupNameInTree(n.children, groupId, name) };
    return n;
  });
}

interface CharVarBuildResult {
  group: VariableGroup;
  varIds: CharacterVarIds;
}

/**
 * Build the VariableGroup subtree for a newly created character.
 * Returns the root group (ready to push onto variableNodes) and the varIds map.
 */
function buildCharVarNodes(
  charName: string,
  varName: string,
  colors: { bgColor: string; borderColor: string; nameColor: string; textColor: string; avatarConfig?: AvatarConfig; llm_descr?: string; llm_temperature?: number },
  pregenIds?: CharacterVarIds,
  pendingNodes?: VariableTreeNode[],
): CharVarBuildResult {
  const nameVarId            = pregenIds?.nameVarId ?? uuid();
  const bgColorVarId         = pregenIds?.bgColorVarId ?? uuid();
  const borderColorVarId     = pregenIds?.borderColorVarId ?? uuid();
  const nameColorVarId       = pregenIds?.nameColorVarId ?? uuid();
  const textColorVarId       = pregenIds?.textColorVarId ?? uuid();
  const avatarVarId          = pregenIds?.avatarVarId ?? uuid();
  const llmDescrVarId        = pregenIds?.llmDescrVarId ?? uuid();
  const llmTemperatureVarId  = pregenIds?.llmTemperatureVarId ?? uuid();
  const stylesGroupId        = pregenIds?.stylesGroupId ?? uuid();
  const groupId              = pregenIds?.groupId ?? uuid();

  const nameVar: Variable = {
    kind: 'variable', id: nameVarId,
    name: 'name',
    varType: 'string',
    defaultValue: charName,
    description: `Character name "${charName}"`,
  };

  const bgColorVar: Variable = {
    kind: 'variable', id: bgColorVarId,
    name: 'bgColor',
    varType: 'string',
    defaultValue: colors.bgColor,
    description: 'Dialogue background color',
  };

  const borderColorVar: Variable = {
    kind: 'variable', id: borderColorVarId,
    name: 'borderColor',
    varType: 'string',
    defaultValue: colors.borderColor,
    description: 'Dialogue border color',
  };

  const nameColorVar: Variable = {
    kind: 'variable', id: nameColorVarId,
    name: 'nameColor',
    varType: 'string',
    defaultValue: colors.nameColor,
    description: 'Character name color',
  };

  const textColorVar: Variable = {
    kind: 'variable', id: textColorVarId,
    name: 'textColor',
    varType: 'string',
    defaultValue: colors.textColor,
    description: 'Dialogue text color',
  };

  const avatarVar: Variable = {
    kind: 'variable', id: avatarVarId,
    name: 'avatar',
    varType: 'string',
    defaultValue: colors.avatarConfig?.mode === 'static' ? (colors.avatarConfig.src ?? '') : '',
    description: `Avatar URL for character "${charName}" (empty = hidden)`,
  };

  const llmDescrVar: Variable = {
    kind: 'variable', id: llmDescrVarId,
    name: 'llm_descr',
    varType: 'string',
    defaultValue: colors.llm_descr ?? '',
    description: `LLM personality description for "${charName}"`,
  };

  const llmTemperatureVar: Variable = {
    kind: 'variable', id: llmTemperatureVarId,
    name: 'llm_temperature',
    varType: 'number',
    defaultValue: colors.llm_temperature !== undefined ? String(colors.llm_temperature) : '',
    description: `LLM temperature for "${charName}" (empty = use global)`,
  };

  const stylesGroup: VariableGroup = {
    kind: 'group', id: stylesGroupId,
    name: 'styles',
    children: [bgColorVar, borderColorVar, nameColorVar, textColorVar, avatarVar, llmDescrVar, llmTemperatureVar],
  };

  const group: VariableGroup = {
    kind: 'group', id: groupId,
    name: varName,
    children: [nameVar, stylesGroup, ...(pendingNodes ?? [])],
  };

  return {
    group,
    varIds: { groupId, stylesGroupId, nameVarId, bgColorVarId, borderColorVarId, nameColorVarId, textColorVarId, avatarVarId, llmDescrVarId, llmTemperatureVarId },
  };
}

// ─── Asset tree helpers ────────────────────────────────────────────────────────

function updateChildPaths(
  nodes: AssetTreeNode[],
  oldPrefix: string,
  newPrefix: string,
): AssetTreeNode[] {
  return nodes.map(n => {
    const rel = newPrefix + n.relativePath.slice(oldPrefix.length);
    if (n.kind === 'asset') return { ...n, relativePath: rel };
    return { ...n, relativePath: rel, children: updateChildPaths(n.children, oldPrefix, newPrefix) };
  });
}

function renameGroupInAssetTree(
  nodes: AssetTreeNode[], id: string, name: string, oldRel: string, newRel: string,
): AssetTreeNode[] {
  return nodes.map(n => {
    if (n.id === id && n.kind === 'group') {
      return { ...n, name, relativePath: newRel, children: updateChildPaths(n.children, oldRel, newRel) };
    }
    if (n.kind === 'group') {
      return { ...n, children: renameGroupInAssetTree(n.children, id, name, oldRel, newRel) };
    }
    return n;
  });
}

// ─── Block deep-clone ─────────────────────────────────────────────────────────

/** Recursively clone a block, assigning fresh UUIDs to every block and branch. */
export function deepCloneBlock(block: Block): Block {
  const newId = uuid();
  if (block.type === 'condition') {
    return {
      ...block,
      id: newId,
      branches: block.branches.map(br => ({
        ...br,
        id: uuid(),
        blocks: br.blocks.map(nb => deepCloneBlock(nb)),
      })),
    };
  }
  return { ...block, id: newId };
}

// ─── Project migration ────────────────────────────────────────────────────────

/**
 * Fix character variable names that were created with Cyrillic prefixes
 * (before transliteration was introduced). Runs idempotently.
 */
function migrateCharacterVarNames(p: Project): Project {
  let variableNodes = p.variableNodes;
  let changed = false;
  for (const char of p.characters) {
    if (!char.varIds) continue;
    const { varIds } = char;
    const correctPrefix = charToVarPrefix(char.name);
    const allVars = flattenVariables(variableNodes);
    const nameVar = allVars.find(v => v.id === varIds.nameVarId);
    if (!nameVar) continue;
    if (nameVar.name === `${correctPrefix}_name`) continue; // already correct
    // Rename all 4 variable identifiers to use the ASCII prefix
    variableNodes = updateVarInTree(variableNodes, varIds.nameVarId,        { name: `${correctPrefix}_name` });
    variableNodes = updateVarInTree(variableNodes, varIds.bgColorVarId,     { name: `${correctPrefix}_bgColor` });
    variableNodes = updateVarInTree(variableNodes, varIds.borderColorVarId, { name: `${correctPrefix}_borderColor` });
    variableNodes = updateVarInTree(variableNodes, varIds.nameColorVarId,   { name: `${correctPrefix}_nameColor` });
    changed = true;
  }
  return changed ? { ...p, variableNodes } : p;
}

/**
 * Add $prefix_avatar variable to characters that were created before it existed.
 * Runs idempotently (skips if avatarVarId already present).
 */
function migrateCharacterAvatarVar(p: Project): Project {
  let variableNodes = p.variableNodes;
  let characters = p.characters;
  let changed = false;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    // Skip if no varIds at all, or if avatarVarId already exists
    if (!char.varIds || char.varIds.avatarVarId) continue;

    const prefix = charToVarPrefix(char.name);
    const avatarVarId = uuid();

    const avatarVar: Variable = {
      kind: 'variable', id: avatarVarId,
      name: `${prefix}_avatar`,
      varType: 'string',
      defaultValue: char.avatarUrl || '',
      description: `Avatar URL for character "${char.name}" (empty = hidden)`,
    };

    // Append to the styles sub-group
    variableNodes = addNode(
      variableNodes as AnyNode[],
      char.varIds.stylesGroupId,
      avatarVar as AnyNode,
    ) as VariableTreeNode[];

    const updatedVarIds: CharacterVarIds = { ...char.varIds, avatarVarId };
    characters = characters.map((c, idx) => idx === i ? { ...c, varIds: updatedVarIds } : c);
    changed = true;
  }

  return changed ? { ...p, variableNodes, characters } : p;
}

/**
 * Add $prefix_textColor variable to characters that were created before it existed.
 * Runs idempotently (skips if textColorVarId already present).
 */
function migrateCharacterTextColorVar(p: Project): Project {
  let variableNodes = p.variableNodes;
  let characters = p.characters;
  let changed = false;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    if (!char.varIds || char.varIds.textColorVarId) continue;

    const prefix = charToVarPrefix(char.name);
    const textColorVarId = uuid();

    const textColorVar: Variable = {
      kind: 'variable', id: textColorVarId,
      name: `${prefix}_textColor`,
      varType: 'string',
      defaultValue: char.textColor ?? '#e2e8f0',
      description: 'Dialogue text color',
    };

    variableNodes = addNode(
      variableNodes as AnyNode[],
      char.varIds.stylesGroupId,
      textColorVar as AnyNode,
    ) as VariableTreeNode[];

    const updatedVarIds: CharacterVarIds = { ...char.varIds, textColorVarId };
    characters = characters.map((c, idx) => idx === i ? { ...c, varIds: updatedVarIds } : c);
    changed = true;
  }

  return changed ? { ...p, variableNodes, characters } : p;
}

/**
 * Add $prefix_llm_descr variable to characters that were created before it existed.
 * Runs idempotently (skips if llmDescrVarId already present).
 */
function migrateCharacterLlmDescrVar(p: Project): Project {
  let variableNodes = p.variableNodes;
  let characters = p.characters;
  let changed = false;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    if (!char.varIds || char.varIds.llmDescrVarId) continue;

    const prefix = charToVarPrefix(char.name);
    const llmDescrVarId = uuid();

    const llmDescrVar: Variable = {
      kind: 'variable', id: llmDescrVarId,
      name: `${prefix}_llm_descr`,
      varType: 'string',
      defaultValue: char.llm_descr ?? '',
      description: `LLM personality description for "${char.name}"`,
    };

    variableNodes = addNode(
      variableNodes as AnyNode[],
      char.varIds.stylesGroupId,
      llmDescrVar as AnyNode,
    ) as VariableTreeNode[];

    const updatedVarIds: CharacterVarIds = { ...char.varIds, llmDescrVarId };
    characters = characters.map((c, idx) => idx === i ? { ...c, varIds: updatedVarIds } : c);
    changed = true;
  }

  return changed ? { ...p, variableNodes, characters } : p;
}

/**
 * Add $prefix_llm_temperature variable to characters that were created before it existed.
 * Runs idempotently (skips if llmTemperatureVarId already present).
 */
function migrateCharacterLlmTemperatureVar(p: Project): Project {
  let variableNodes = p.variableNodes;
  let characters = p.characters;
  let changed = false;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    if (!char.varIds || char.varIds.llmTemperatureVarId) continue;

    const prefix = charToVarPrefix(char.name);
    const llmTemperatureVarId = uuid();

    const llmTemperatureVar: Variable = {
      kind: 'variable', id: llmTemperatureVarId,
      name: `${prefix}_llm_temperature`,
      varType: 'number',
      defaultValue: char.llm_temperature !== undefined ? String(char.llm_temperature) : '',
      description: `LLM temperature for "${char.name}" (empty = use global)`,
    };

    variableNodes = addNode(
      variableNodes as AnyNode[],
      char.varIds.stylesGroupId,
      llmTemperatureVar as AnyNode,
    ) as VariableTreeNode[];

    const updatedVarIds: CharacterVarIds = { ...char.varIds, llmTemperatureVarId };
    characters = characters.map((c, idx) => idx === i ? { ...c, varIds: updatedVarIds } : c);
    changed = true;
  }

  return changed ? { ...p, variableNodes, characters } : p;
}

/**
 * Add avatarConfig to characters created before AvatarConfig was introduced.
 * Converts legacy avatarUrl → avatarConfig { mode: 'static', src: avatarUrl }.
 * Runs idempotently (skips characters that already have avatarConfig).
 */
function migrateCharacterAvatarConfig(p: Project): Project {
  const needsMigration = p.characters.some(c => !c.avatarConfig);
  if (!needsMigration) return p;
  const characters = p.characters.map(c => {
    if (c.avatarConfig) return c;
    return {
      ...c,
      avatarConfig: {
        mode: 'static' as AvatarMode,
        src: c.avatarUrl ?? '',
        variableId: '',
        mapping: [],
        defaultSrc: '',
      } satisfies AvatarConfig,
    };
  });
  return { ...p, characters };
}

/**
 * Convert all targetSceneId / navigate.sceneId values from scene names to scene UUIDs.
 * Runs once per project load; already-migrated projects (values are UUIDs) are unaffected
 * because a UUID will never match a scene name in the nameToId map.
 */
function migrateSceneLinks(p: Project): Project {
  const nameToId = new Map(p.scenes.map(s => [s.name, s.id]));
  const idSet = new Set(p.scenes.map(s => s.id));
  const resolve = (v: string | undefined): string => {
    if (!v) return v ?? '';
    if (idSet.has(v)) return v; // already an ID
    return nameToId.get(v) ?? v; // resolve name → ID, or keep as-is
  };

  const migrateActions = (actions: any[]) => {
    for (const a of actions) {
      if (a.type === 'open-popup' && a.targetSceneId) {
        a.targetSceneId = resolve(a.targetSceneId);
      }
    }
  };

  const migrateNav = (nav: any) => {
    if (nav?.type === 'scene' && nav.sceneId) {
      nav.sceneId = resolve(nav.sceneId);
    }
  };

  const migrateBlocks = (blocks: any[]) => {
    for (const b of blocks) {
      if (b.type === 'choice') {
        for (const opt of b.options ?? []) {
          if (opt.targetSceneId) opt.targetSceneId = resolve(opt.targetSceneId);
        }
      } else if (b.type === 'link') {
        if (b.targetSceneId) b.targetSceneId = resolve(b.targetSceneId);
        if (b.actions) migrateActions(b.actions);
      } else if (b.type === 'function') {
        if (b.targetSceneId) b.targetSceneId = resolve(b.targetSceneId);
        if (b.actions) migrateActions(b.actions);
      } else if (b.type === 'popup') {
        if (b.targetSceneId) b.targetSceneId = resolve(b.targetSceneId);
      } else if (b.type === 'button') {
        if (b.actions) migrateActions(b.actions);
      } else if (b.type === 'condition') {
        for (const branch of b.branches ?? []) {
          migrateBlocks(branch.blocks ?? []);
        }
      } else if (b.type === 'include') {
        if (b.passageName) b.passageName = resolve(b.passageName);
      } else if (b.type === 'dialogue' && b.innerBlocks?.length) {
        migrateBlocks(b.innerBlocks);
      } else if (b.type === 'table') {
        for (const row of b.rows ?? []) {
          for (const cell of row.cells ?? []) {
            if (cell.content?.type === 'button') {
              if (cell.content.actions) migrateActions(cell.content.actions);
              migrateNav(cell.content.navigate);
            }
          }
        }
      }
    }
  };

  for (const scene of p.scenes) {
    migrateBlocks(scene.blocks);
  }

  // Sidebar panel cells
  for (const tab of p.sidebarPanel?.tabs ?? []) {
    for (const row of tab.rows ?? []) {
      for (const cell of row.cells ?? []) {
        if (cell.content?.type === 'button') {
          if ((cell.content as any).actions) migrateActions((cell.content as any).actions);
          migrateNav((cell.content as any).navigate);
        }
      }
    }
  }

  // Watchers
  for (const w of p.watchers ?? []) {
    if (w.actions) migrateActions(w.actions);
    migrateNav(w.navigate);
  }

  return p;
}

function migrateProject(raw: any): Project {
  let p = { ...raw };

  // variables: Variable[] → variableNodes: VariableTreeNode[]
  if ('variables' in p && !('variableNodes' in p)) {
    p.variableNodes = (p.variables as any[]).map(v => ({ kind: 'variable', ...v }));
    delete p.variables;
  }
  if (!p.variableNodes) p.variableNodes = [];

  // assets: Asset[] → assetNodes: AssetTreeNode[]
  if ('assets' in p && !('assetNodes' in p)) {
    delete p.assets;
  }
  if (!p.assetNodes) p.assetNodes = [];

  // sidebarPanel
  if (!p.sidebarPanel) p.sidebarPanel = DEFAULT_PANEL;
  // Ensure panel has style (added later — backward compat)
  if (!p.sidebarPanel.style) p.sidebarPanel.style = { ...DEFAULT_PANEL_STYLE };
  // Migrate cell widths: old flex weights (1–12) → percentages (1–100)
  // Heuristic: if max cell width in a row is ≤ 12, treat as flex weights
  for (const tab of p.sidebarPanel.tabs ?? []) {
    for (const row of tab.rows ?? []) {
      if (!row.cells?.length) continue;
      const maxW = Math.max(...row.cells.map((c: any) => c.width ?? 1));
      if (maxW <= 12) {
        const total = row.cells.reduce((s: number, c: any) => s + (c.width ?? 1), 0);
        const converted = row.cells.map((c: any) => ({ ...c, width: Math.round((c.width ?? 1) / total * 100) }));
        // Fix rounding drift so sum == 100
        const diff = 100 - converted.reduce((s: number, c: any) => s + c.width, 0);
        if (diff !== 0) converted[0] = { ...converted[0], width: converted[0].width + diff };
        row.cells = converted;
      }
    }
  }

  // Fix Cyrillic variable names created before transliteration was added
  p = migrateCharacterVarNames(p as Project);
  // Add $prefix_avatar variable to characters that predate this feature
  p = migrateCharacterAvatarVar(p as Project);
  // Add avatarConfig to characters that predate this feature
  p = migrateCharacterAvatarConfig(p as Project);
  // Add $prefix_textColor variable to characters that predate this feature
  p = migrateCharacterTextColorVar(p as Project);
  // Add $prefix_llm_descr variable to characters that predate this feature
  p = migrateCharacterLlmDescrVar(p as Project);
  p = migrateCharacterLlmTemperatureVar(p as Project);

  if (!p.watchers) p.watchers = [];
  if (!p.sceneGroups) p.sceneGroups = [];
  if (!p.settings) p.settings = { ...DEFAULT_PROJECT_SETTINGS };
  if (p.settings.historyControls === undefined) p.settings.historyControls = DEFAULT_PROJECT_SETTINGS.historyControls;
  if (p.settings.saveLoadMenu === undefined) p.settings.saveLoadMenu = DEFAULT_PROJECT_SETTINGS.saveLoadMenu;

  // Migrate targetSceneId / navigate.sceneId from scene NAMES → scene IDs
  p = migrateSceneLinks(p as Project);

  return p as Project;
}

function findAssetNodeById(nodes: AssetTreeNode[], id: string): AssetTreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.kind === 'group') { const f = findAssetNodeById(n.children, id); if (f) return f; }
  }
  return null;
}

// ─── Store shape ──────────────────────────────────────────────────────────────

type SidebarTabId = 'scenes' | 'characters' | 'variables' | 'assets' | 'panel' | 'watchers';

interface ProjectState {
  project: Project;
  activeSceneId: string | null;
  activeSidebarTab: SidebarTabId;
  sidebarWidth: number;
  projectDir: string | null;

  setProjectDir: (dir: string | null) => void;
  setProjectTitle: (title: string) => void;
  updateProjectMeta: (patch: Partial<Pick<Project, 'title' | 'author' | 'description' | 'lore' | 'settings' | 'sidebarPanel'>>) => void;
  loadProject: (project: Project, dir?: string) => void;
  resetProject: () => void;
  setSidebarTab: (tab: SidebarTabId) => void;
  setSidebarWidth: (width: number) => void;
  fixVariableNames: () => void;

  // History / undo / redo
  _history: Project[];
  _future: Project[];
  canUndo: boolean;
  canRedo: boolean;
  saveSnapshot: () => void;
  undo: () => void;
  redo: () => void;

  // Scenes
  setActiveScene: (id: string) => void;
  addScene: () => void;
  addSceneWithData: (data: { name: string; tags: string[]; notes?: string }) => void;
  deleteScene: (id: string) => void;
  renameScene: (id: string, name: string) => void;
  updateSceneNote: (id: string, notes: string | undefined) => void;
  updateSceneGraphPosition: (id: string, x: number, y: number) => void;
  updateSceneTags: (id: string, tags: string[]) => void;
  updateSceneSettings: (id: string, data: { name: string; tags: string[]; notes?: string }) => void;
  reorderScenes: (scenes: Scene[]) => void;
  duplicateScene: (sceneId: string) => void;
  makeStartScene: (sceneId: string) => void;

  // Scene groups
  addSceneGroup: (data: { name: string; notes?: string }) => void;
  updateSceneGroup: (id: string, patch: Partial<SceneGroup>) => void;
  deleteSceneGroup: (id: string) => void;
  deleteSceneGroupWithScenes: (id: string) => void;
  moveSceneToGroup: (sceneId: string, groupId: string | null, overId: string | null) => void;
  reorderGroupScenes: (reorderedScenes: Scene[]) => void;

  // Blocks
  addBlock: (sceneId: string, block: Block, insertIndex?: number) => void;
  updateBlock: (sceneId: string, blockId: string, patch: Partial<Block>) => void;
  deleteBlock: (sceneId: string, blockId: string) => void;
  reorderBlocks: (sceneId: string, blocks: Block[]) => void;
  duplicateBlock: (sceneId: string, blockId: string) => void;
  pasteToScene: (sceneId: string, block: Block, insertIndex?: number) => void;

  // Nested blocks (condition branches)
  addNestedBlock: (sceneId: string, blockId: string, branchId: string, block: Block) => void;
  updateNestedBlock: (sceneId: string, blockId: string, branchId: string, nestedBlockId: string, patch: Partial<Block>) => void;
  deleteNestedBlock: (sceneId: string, blockId: string, branchId: string, nestedBlockId: string) => void;
  reorderNestedBlocks: (sceneId: string, conditionBlockId: string, branchId: string, blocks: Block[]) => void;
  duplicateNestedBlock: (sceneId: string, conditionBlockId: string, branchId: string, nestedBlockId: string) => void;
  pasteToNested: (sceneId: string, conditionBlockId: string, branchId: string, block: Block) => void;

  // Dialogue inner blocks
  addDialogueInnerBlock: (sceneId: string, dialogueBlockId: string, block: Block) => void;
  updateDialogueInnerBlock: (sceneId: string, dialogueBlockId: string, innerBlockId: string, patch: Partial<Block>) => void;
  deleteDialogueInnerBlock: (sceneId: string, dialogueBlockId: string, innerBlockId: string) => void;
  reorderDialogueInnerBlocks: (sceneId: string, dialogueBlockId: string, blocks: Block[]) => void;

  // Choice options
  addChoiceOption: (sceneId: string, blockId: string) => void;
  updateChoiceOption: (sceneId: string, blockId: string, optionId: string, patch: Partial<ChoiceOption>) => void;
  deleteChoiceOption: (sceneId: string, blockId: string, optionId: string) => void;

  // Condition branches
  addConditionBranch: (sceneId: string, blockId: string) => void;
  updateConditionBranch: (sceneId: string, blockId: string, branchId: string, patch: Partial<ConditionBranch>) => void;
  deleteConditionBranch: (sceneId: string, blockId: string, branchId: string) => void;

  // Characters
  addCharacter: (char: Omit<Character, 'id'>, pregenIds?: CharacterVarIds, pendingNodes?: VariableTreeNode[]) => string;
  updateCharacter: (id: string, patch: Partial<Character>) => void;
  deleteCharacter: (id: string) => void;

  // Watchers
  addWatcher: () => void;
  updateWatcher: (id: string, patch: Partial<Watcher>) => void;
  deleteWatcher: (id: string) => void;

  // Variable tree
  addVariableGroup: (parentId: string | null, name: string) => void;
  addVariable: (parentId: string | null, v: Omit<Variable, 'id' | 'kind'>) => void;
  updateVariable: (id: string, patch: Partial<Variable>) => void;
  deleteVariableNode: (id: string) => void;

  // Asset tree
  addAssetGroup: (parentGroupId: string | null, name: string, relativePath: string) => void;
  renameAssetGroup: (id: string, name: string, newRelativePath: string) => void;
  addAsset: (parentGroupId: string | null, a: Omit<Asset, 'id' | 'kind'>) => void;
  deleteAssetNode: (id: string) => void;
  /** Replace assetNodes wholesale (used by filesystem sync, no undo snapshot) */
  syncAssets: (nodes: AssetTreeNode[]) => void;

  // Sidebar panel
  setPanelLiveUpdate: (v: boolean) => void;
  updatePanelStyle: (patch: Partial<PanelStyle>) => void;
  addPanelTab: (label: string) => void;
  updatePanelTab: (tabId: string, patch: Partial<Omit<SidebarTab, 'id' | 'rows'>>) => void;
  deletePanelTab: (tabId: string) => void;
  reorderPanelTabs: (tabs: SidebarTab[]) => void;
  addPanelRow: (tabId: string) => void;
  updatePanelRow: (tabId: string, rowId: string, patch: Partial<Omit<SidebarRow, 'id' | 'cells'>>) => void;
  deletePanelRow: (tabId: string, rowId: string) => void;
  addPanelCell: (tabId: string, rowId: string) => void;
  updatePanelCell: (tabId: string, rowId: string, cellId: string, patch: Partial<Omit<SidebarCell, 'id'>>) => void;
  deletePanelCell: (tabId: string, rowId: string, cellId: string) => void;
  updateCellContent: (tabId: string, rowId: string, cellId: string, content: CellContent) => void;
}

// ─── Panel helpers ────────────────────────────────────────────────────────────

/**
 * Distributes 100% width equally among cells, fixing rounding on the first cell.
 * Preserves the relative proportions of cells that already have non-zero widths.
 * For new cells (width=0) — just divide equally.
 */
export function redistributeWidths(cells: SidebarCell[]): SidebarCell[] {
  if (cells.length === 0) return cells;
  const equal = Math.floor(100 / cells.length);
  const remainder = 100 - equal * cells.length;
  return cells.map((c, i) => ({ ...c, width: equal + (i === 0 ? remainder : 0) }));
}

// ─── Inner updaters ───────────────────────────────────────────────────────────

function updateScene(project: Project, sceneId: string, updater: (s: Scene) => Scene): Project {
  return { ...project, scenes: project.scenes.map(s => s.id === sceneId ? updater(s) : s) };
}

function updateBlockInScene(scene: Scene, blockId: string, updater: (b: Block) => Block): Scene {
  return { ...scene, blocks: scene.blocks.map(b => b.id === blockId ? updater(b) : b) };
}

function updatePanel(project: Project, updater: (p: SidebarPanel) => SidebarPanel): Project {
  return { ...project, sidebarPanel: updater(project.sidebarPanel) };
}

function updateTab(panel: SidebarPanel, tabId: string, updater: (t: SidebarTab) => SidebarTab): SidebarPanel {
  return { ...panel, tabs: panel.tabs.map(t => t.id === tabId ? updater(t) : t) };
}

function updateRow(tab: SidebarTab, rowId: string, updater: (r: SidebarRow) => SidebarRow): SidebarTab {
  return { ...tab, rows: tab.rows.map(r => r.id === rowId ? updater(r) : r) };
}

function updateCell(row: SidebarRow, cellId: string, updater: (c: SidebarCell) => SidebarCell): SidebarRow {
  return { ...row, cells: row.cells.map(c => c.id === cellId ? updater(c) : c) };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => {
      const defaultProject = makeDefaultProject();
      return {
        project: defaultProject,
        activeSceneId: defaultProject.scenes[0].id,
        activeSidebarTab: 'scenes',
        sidebarWidth: 340,
        projectDir: null,
        _history: [],
        _future: [],
        canUndo: false,
        canRedo: false,

        setProjectDir: (dir) => set({ projectDir: dir }),

        setProjectTitle: (title) => {
          get().saveSnapshot();
          set(s => ({ project: { ...s.project, title } }));
        },

        updateProjectMeta: (patch) => {
          get().saveSnapshot();
          set(s => ({ project: { ...s.project, ...patch } }));
        },

        loadProject: (rawProject, dir) => {
          const project = migrateProject(rawProject);
          set({
            project,
            activeSceneId: project.scenes[0]?.id ?? null,
            ...(dir !== undefined ? { projectDir: dir } : {}),
            _history: [], _future: [], canUndo: false, canRedo: false,
          });
        },

        resetProject: () => {
          const p = makeDefaultProject();
          set({ project: p, activeSceneId: p.scenes[0].id, projectDir: null, _history: [], _future: [], canUndo: false, canRedo: false });
        },

        setSidebarTab: (tab) => set({ activeSidebarTab: tab }),
        setSidebarWidth: (width) => set({ sidebarWidth: Math.max(220, Math.min(600, width)) }),

        // Run migration via set() so it's reactive + persisted.
        // Called once on app mount to handle HMR / warm-reload scenarios
        // where onRehydrateStorage doesn't re-run.
        fixVariableNames: () =>
          set(s => {
            const step1 = migrateCharacterVarNames(s.project);
            const step2 = migrateCharacterAvatarVar(step1);
            const step3 = migrateCharacterAvatarConfig(step2);
            const step4 = migrateCharacterTextColorVar(step3);
            const step5 = migrateCharacterLlmDescrVar(step4);
            const step6 = migrateCharacterLlmTemperatureVar(step5);
            return step6 === s.project ? s : { project: step6 };
          }),

        // ── History / Undo / Redo ────────────────────────────────────────────

        saveSnapshot: () => {
          const s = get();
          // Skip if project hasn't changed since the last snapshot
          const last = s._history[s._history.length - 1];
          if (last === s.project) return;
          const history = [...s._history, s.project];
          if (history.length > HISTORY_LIMIT) history.shift();
          set({ _history: history, _future: [], canUndo: true, canRedo: false });
        },

        undo: () => {
          const s = get();
          if (s._history.length === 0) return;
          const previous = s._history[s._history.length - 1];
          const newHistory = s._history.slice(0, -1);
          set({
            project: previous,
            _history: newHistory,
            _future: [s.project, ...s._future],
            canUndo: newHistory.length > 0,
            canRedo: true,
          });
        },

        redo: () => {
          const s = get();
          if (s._future.length === 0) return;
          const next = s._future[0];
          const newFuture = s._future.slice(1);
          set({
            project: next,
            _history: [...s._history, s.project],
            _future: newFuture,
            canUndo: true,
            canRedo: newFuture.length > 0,
          });
        },

        // ── Scenes ──────────────────────────────────────────────────────────

        setActiveScene: (id) => set({ activeSceneId: id }),

        addScene: () => {
          get().saveSnapshot();
          const id = uuid();
          const name = `Scene ${get().project.scenes.length + 1}`;
          const scene: Scene = { id, name, tags: [], blocks: [] };
          set(s => ({
            project: { ...s.project, scenes: [...s.project.scenes, scene] },
            activeSceneId: id,
          }));
        },

        addSceneWithData: ({ name, tags, notes }) => {
          get().saveSnapshot();
          const id = uuid();
          const scene: Scene = { id, name, tags, blocks: [], notes: notes || undefined };
          set(s => ({
            project: { ...s.project, scenes: [...s.project.scenes, scene] },
            activeSceneId: id,
          }));
        },

        deleteScene: (id) => {
          get().saveSnapshot();
          set(s => {
            const scenes = s.project.scenes.filter(sc => sc.id !== id);
            const activeSceneId = s.activeSceneId === id ? (scenes[0]?.id ?? null) : s.activeSceneId;
            return { project: { ...s.project, scenes }, activeSceneId };
          });
        },

        renameScene: (id, name) => {
          get().saveSnapshot();
          set(s => ({ project: updateScene(s.project, id, sc => ({ ...sc, name })) }));
        },

        updateSceneNote: (id, notes) => {
          get().saveSnapshot();
          set(s => ({ project: updateScene(s.project, id, sc => ({ ...sc, notes })) }));
        },

        // No undo snapshot — graph position is a cosmetic UI preference
        updateSceneGraphPosition: (id, x, y) => {
          set(s => ({ project: updateScene(s.project, id, sc => ({ ...sc, graphPosition: { x, y } })) }));
        },

        updateSceneTags: (id, tags) => {
          get().saveSnapshot();
          // Protect start tag: preserve it if scene had it, strip it if scene didn't
          set(s => {
            const scene = s.project.scenes.find(sc => sc.id === id);
            if (!scene) return s;
            const hadStart = scene.tags.includes(START_TAG);
            const safeTags = hadStart
              ? (tags.includes(START_TAG) ? tags : [START_TAG, ...tags])
              : tags.filter(t => t !== START_TAG);
            return { project: updateScene(s.project, id, sc => ({ ...sc, tags: safeTags })) };
          });
        },

        updateSceneSettings: (id, { name, tags, notes }) => {
          get().saveSnapshot();
          // Protect start tag: preserve it if scene had it, strip it if scene didn't
          set(s => {
            const scene = s.project.scenes.find(sc => sc.id === id);
            if (!scene) return s;
            const hadStart = scene.tags.includes(START_TAG);
            const safeTags = hadStart
              ? (tags.includes(START_TAG) ? tags : [START_TAG, ...tags])
              : tags.filter(t => t !== START_TAG);
            return { project: updateScene(s.project, id, sc => ({ ...sc, name, tags: safeTags, notes: notes || undefined })) };
          });
        },

        reorderScenes: (scenes) => {
          get().saveSnapshot();
          set(s => ({ project: { ...s.project, scenes } }));
        },

        duplicateScene: (sceneId) => {
          get().saveSnapshot();
          set(s => {
            const original = s.project.scenes.find(sc => sc.id === sceneId);
            if (!original) return s;
            const clone: Scene = {
              ...original,
              id: uuid(),
              name: `${original.name} (copy)`,
              tags: original.tags.filter(t => t !== START_TAG),
              blocks: original.blocks.map(deepCloneBlock),
            };
            const idx = s.project.scenes.findIndex(sc => sc.id === sceneId);
            const scenes = [...s.project.scenes];
            scenes.splice(idx + 1, 0, clone);
            return {
              project: { ...s.project, scenes },
              activeSceneId: clone.id,
            };
          });
        },

        makeStartScene: (sceneId) => {
          get().saveSnapshot();
          set(s => ({
            project: {
              ...s.project,
              scenes: s.project.scenes.map(sc => {
                const hasStart = sc.tags.includes(START_TAG);
                if (sc.id === sceneId && !hasStart) return { ...sc, tags: [START_TAG, ...sc.tags] };
                if (sc.id !== sceneId && hasStart) return { ...sc, tags: sc.tags.filter(t => t !== START_TAG) };
                return sc;
              }),
            },
          }));
        },

        // ── Scene groups ─────────────────────────────────────────────────────

        addSceneGroup: ({ name, notes }) => {
          get().saveSnapshot();
          const id = uuid();
          set(s => ({
            project: { ...s.project, sceneGroups: [...s.project.sceneGroups, { id, name, notes }] },
          }));
        },

        updateSceneGroup: (id, patch) => {
          set(s => ({
            project: {
              ...s.project,
              sceneGroups: s.project.sceneGroups.map(g => g.id === id ? { ...g, ...patch } : g),
            },
          }));
        },

        deleteSceneGroup: (id) => {
          get().saveSnapshot();
          set(s => ({
            project: {
              ...s.project,
              sceneGroups: s.project.sceneGroups.filter(g => g.id !== id),
              scenes: s.project.scenes.map(sc =>
                sc.groupId === id ? { ...sc, groupId: undefined } : sc,
              ),
            },
          }));
        },

        deleteSceneGroupWithScenes: (id) => {
          // Prevent deletion if the group contains the start scene
          const hasStart = get().project.scenes.some(sc => sc.groupId === id && sc.tags.includes(START_TAG));
          if (hasStart) return;
          get().saveSnapshot();
          set(s => {
            const remaining = s.project.scenes.filter(sc => sc.groupId !== id);
            const activeSceneId = remaining.some(sc => sc.id === s.activeSceneId)
              ? s.activeSceneId
              : (remaining[0]?.id ?? null);
            return {
              project: {
                ...s.project,
                sceneGroups: s.project.sceneGroups.filter(g => g.id !== id),
                scenes: remaining,
              },
              activeSceneId,
            };
          });
        },

        moveSceneToGroup: (sceneId, groupId, overId) => {
          get().saveSnapshot();
          set(s => {
            const scenes = [...s.project.scenes];
            const idx = scenes.findIndex(sc => sc.id === sceneId);
            if (idx === -1) return s;

            const movedScene: Scene = { ...scenes[idx] };
            if (groupId) movedScene.groupId = groupId;
            else delete movedScene.groupId;

            scenes.splice(idx, 1);

            if (overId) {
              const overIdx = scenes.findIndex(sc => sc.id === overId);
              if (overIdx !== -1) {
                scenes.splice(overIdx + 1, 0, movedScene);
                return { project: { ...s.project, scenes } };
              }
            }

            // Append after the last scene in the target group (or ungrouped block)
            let insertAt = -1;
            for (let i = scenes.length - 1; i >= 0; i--) {
              const scGroupId = scenes[i].groupId ?? null;
              if (scGroupId === groupId) { insertAt = i + 1; break; }
            }
            if (insertAt === -1) scenes.push(movedScene);
            else scenes.splice(insertAt, 0, movedScene);

            return { project: { ...s.project, scenes } };
          });
        },

        reorderGroupScenes: (reorderedScenes) => {
          get().saveSnapshot();
          set(s => {
            if (reorderedScenes.length === 0) return s;
            const groupId = reorderedScenes[0].groupId ?? null;
            const allScenes = s.project.scenes;

            // Collect the positions of scenes belonging to this group
            const positions: number[] = [];
            allScenes.forEach((sc, i) => {
              if ((sc.groupId ?? null) === groupId) positions.push(i);
            });

            const newScenes = [...allScenes];
            reorderedScenes.forEach((sc, i) => { newScenes[positions[i]] = sc; });
            return { project: { ...s.project, scenes: newScenes } };
          });
        },

        // ── Blocks ──────────────────────────────────────────────────────────

        addBlock: (sceneId, block, insertIndex) => {
          get().saveSnapshot();
          set(s => ({
            project: updateScene(s.project, sceneId, sc => {
              const blocks = [...sc.blocks];
              if (insertIndex !== undefined) blocks.splice(insertIndex, 0, block);
              else blocks.push(block);
              return { ...sc, blocks };
            }),
          }));
        },

        updateBlock: (sceneId, blockId, patch) =>
          set(s => ({
            project: updateScene(s.project, sceneId, sc =>
              updateBlockInScene(sc, blockId, b => ({ ...b, ...patch } as Block))
            ),
          })),

        deleteBlock: (sceneId, blockId) => {
          get().saveSnapshot();
          set(s => ({
            project: updateScene(s.project, sceneId, sc => ({
              ...sc, blocks: sc.blocks.filter(b => b.id !== blockId),
            })),
          }));
        },

        reorderBlocks: (sceneId, blocks) => {
          get().saveSnapshot();
          set(s => ({ project: updateScene(s.project, sceneId, sc => ({ ...sc, blocks })) }));
        },

        duplicateBlock: (sceneId, blockId) => {
          get().saveSnapshot();
          set(s => ({
            project: updateScene(s.project, sceneId, sc => {
              const idx = sc.blocks.findIndex(b => b.id === blockId);
              if (idx === -1) return sc;
              const blocks = [...sc.blocks];
              blocks.splice(idx + 1, 0, deepCloneBlock(sc.blocks[idx]));
              return { ...sc, blocks };
            }),
          }));
        },

        pasteToScene: (sceneId, block, insertIndex) => {
          get().saveSnapshot();
          set(s => ({
            project: updateScene(s.project, sceneId, sc => {
              const cloned = deepCloneBlock(block);
              const blocks = [...sc.blocks];
              if (insertIndex !== undefined) blocks.splice(insertIndex, 0, cloned);
              else blocks.push(cloned);
              return { ...sc, blocks };
            }),
          }));
        },

        // ── Nested blocks ─────────────────────────────────────────────────────

        addNestedBlock: (sceneId, blockId, branchId, block) => {
          get().saveSnapshot();
          set(s => ({
            project: updateScene(s.project, sceneId, sc =>
              updateBlockInScene(sc, blockId, b => {
                if (b.type !== 'condition') return b;
                return {
                  ...b,
                  branches: b.branches.map(br =>
                    br.id === branchId ? { ...br, blocks: [...br.blocks, block] } : br
                  ),
                };
              })
            ),
          }));
        },

        updateNestedBlock: (sceneId, blockId, branchId, nestedBlockId, patch) =>
          set(s => ({
            project: updateScene(s.project, sceneId, sc =>
              updateBlockInScene(sc, blockId, b => {
                if (b.type !== 'condition') return b;
                return {
                  ...b,
                  branches: b.branches.map(br =>
                    br.id === branchId
                      ? { ...br, blocks: br.blocks.map(nb => nb.id === nestedBlockId ? { ...nb, ...patch } as Block : nb) }
                      : br
                  ),
                };
              })
            ),
          })),

        deleteNestedBlock: (sceneId, blockId, branchId, nestedBlockId) => {
          get().saveSnapshot();
          set(s => ({
            project: updateScene(s.project, sceneId, sc =>
              updateBlockInScene(sc, blockId, b => {
                if (b.type !== 'condition') return b;
                return {
                  ...b,
                  branches: b.branches.map(br =>
                    br.id === branchId
                      ? { ...br, blocks: br.blocks.filter(nb => nb.id !== nestedBlockId) }
                      : br
                  ),
                };
              })
            ),
          }));
        },

        reorderNestedBlocks: (sceneId, conditionBlockId, branchId, blocks) => {
          get().saveSnapshot();
          set(s => ({
            project: updateScene(s.project, sceneId, sc =>
              updateBlockInScene(sc, conditionBlockId, b => {
                if (b.type !== 'condition') return b;
                return {
                  ...b,
                  branches: b.branches.map(br =>
                    br.id === branchId ? { ...br, blocks } : br
                  ),
                };
              })
            ),
          }));
        },

        duplicateNestedBlock: (sceneId, conditionBlockId, branchId, nestedBlockId) => {
          get().saveSnapshot();
          set(s => ({
            project: updateScene(s.project, sceneId, sc =>
              updateBlockInScene(sc, conditionBlockId, b => {
                if (b.type !== 'condition') return b;
                return {
                  ...b,
                  branches: b.branches.map(br => {
                    if (br.id !== branchId) return br;
                    const idx = br.blocks.findIndex(nb => nb.id === nestedBlockId);
                    if (idx === -1) return br;
                    const blocks = [...br.blocks];
                    blocks.splice(idx + 1, 0, deepCloneBlock(br.blocks[idx]));
                    return { ...br, blocks };
                  }),
                };
              })
            ),
          }));
        },

        pasteToNested: (sceneId, conditionBlockId, branchId, block) => {
          get().saveSnapshot();
          set(s => ({
            project: updateScene(s.project, sceneId, sc =>
              updateBlockInScene(sc, conditionBlockId, b => {
                if (b.type !== 'condition') return b;
                return {
                  ...b,
                  branches: b.branches.map(br =>
                    br.id === branchId
                      ? { ...br, blocks: [...br.blocks, deepCloneBlock(block)] }
                      : br
                  ),
                };
              })
            ),
          }));
        },

        // ── Dialogue inner blocks ─────────────────────────────────────────────

        addDialogueInnerBlock: (sceneId, dialogueBlockId, block) => {
          get().saveSnapshot();
          set(s => ({
            project: updateScene(s.project, sceneId, sc =>
              updateBlockInScene(sc, dialogueBlockId, b => {
                if (b.type !== 'dialogue') return b;
                return { ...b, innerBlocks: [...(b.innerBlocks ?? []), block] };
              })
            ),
          }));
        },

        updateDialogueInnerBlock: (sceneId, dialogueBlockId, innerBlockId, patch) =>
          set(s => ({
            project: updateScene(s.project, sceneId, sc =>
              updateBlockInScene(sc, dialogueBlockId, b => {
                if (b.type !== 'dialogue') return b;
                return {
                  ...b,
                  innerBlocks: (b.innerBlocks ?? []).map(ib =>
                    ib.id === innerBlockId ? { ...ib, ...patch } as Block : ib
                  ),
                };
              })
            ),
          })),

        deleteDialogueInnerBlock: (sceneId, dialogueBlockId, innerBlockId) => {
          get().saveSnapshot();
          set(s => ({
            project: updateScene(s.project, sceneId, sc =>
              updateBlockInScene(sc, dialogueBlockId, b => {
                if (b.type !== 'dialogue') return b;
                return { ...b, innerBlocks: (b.innerBlocks ?? []).filter(ib => ib.id !== innerBlockId) };
              })
            ),
          }));
        },

        reorderDialogueInnerBlocks: (sceneId, dialogueBlockId, blocks) => {
          get().saveSnapshot();
          set(s => ({
            project: updateScene(s.project, sceneId, sc =>
              updateBlockInScene(sc, dialogueBlockId, b => {
                if (b.type !== 'dialogue') return b;
                return { ...b, innerBlocks: blocks };
              })
            ),
          }));
        },

        // ── Choice options ────────────────────────────────────────────────────

        addChoiceOption: (sceneId, blockId) => {
          get().saveSnapshot();
          set(s => ({
            project: updateScene(s.project, sceneId, sc =>
              updateBlockInScene(sc, blockId, b => {
                if (b.type !== 'choice') return b;
                const opt: ChoiceOption = { id: uuid(), label: 'Option', targetSceneId: '', condition: '' };
                return { ...b, options: [...b.options, opt] };
              })
            ),
          }));
        },

        updateChoiceOption: (sceneId, blockId, optionId, patch) =>
          set(s => ({
            project: updateScene(s.project, sceneId, sc =>
              updateBlockInScene(sc, blockId, b => {
                if (b.type !== 'choice') return b;
                return { ...b, options: b.options.map(o => o.id === optionId ? { ...o, ...patch } : o) };
              })
            ),
          })),

        deleteChoiceOption: (sceneId, blockId, optionId) => {
          get().saveSnapshot();
          set(s => ({
            project: updateScene(s.project, sceneId, sc =>
              updateBlockInScene(sc, blockId, b => {
                if (b.type !== 'choice') return b;
                return { ...b, options: b.options.filter(o => o.id !== optionId) };
              })
            ),
          }));
        },

        // ── Condition branches ─────────────────────────────────────────────────

        addConditionBranch: (sceneId, blockId) => {
          get().saveSnapshot();
          set(s => ({
            project: updateScene(s.project, sceneId, sc =>
              updateBlockInScene(sc, blockId, b => {
                if (b.type !== 'condition') return b;
                const hasElse = b.branches.some(br => br.branchType === 'else');
                if (hasElse) return b;
                const isFirst = b.branches.length === 0;
                const branch: ConditionBranch = {
                  id: uuid(), branchType: isFirst ? 'if' : 'elseif',
                  variableId: '', operator: '==', value: '', blocks: [],
                };
                return { ...b, branches: [...b.branches, branch] };
              })
            ),
          }));
        },

        updateConditionBranch: (sceneId, blockId, branchId, patch) =>
          set(s => ({
            project: updateScene(s.project, sceneId, sc =>
              updateBlockInScene(sc, blockId, b => {
                if (b.type !== 'condition') return b;
                return { ...b, branches: b.branches.map(br => br.id === branchId ? { ...br, ...patch } : br) };
              })
            ),
          })),

        deleteConditionBranch: (sceneId, blockId, branchId) => {
          get().saveSnapshot();
          set(s => ({
            project: updateScene(s.project, sceneId, sc =>
              updateBlockInScene(sc, blockId, b => {
                if (b.type !== 'condition') return b;
                return { ...b, branches: b.branches.filter(br => br.id !== branchId) };
              })
            ),
          }));
        },

        // ── Characters ────────────────────────────────────────────────────────

        addCharacter: (char, pregenIds, pendingNodes) => {
          get().saveSnapshot();
          const charId = uuid();
          set(s => {
            const { group, varIds } = buildCharVarNodes(char.name, char.varName || charToVarPrefix(char.name), {
              bgColor: char.bgColor,
              borderColor: char.borderColor,
              nameColor: char.nameColor,
              textColor: char.textColor ?? '#e2e8f0',
              avatarConfig: char.avatarConfig,
              llm_descr: char.llm_descr,
              llm_temperature: char.llm_temperature,
            }, pregenIds, pendingNodes);
            const character: Character = { ...char, id: charId, varIds };
            return {
              project: {
                ...s.project,
                characters: [...s.project.characters, character],
                variableNodes: [...s.project.variableNodes, group],
              },
            };
          });
          return charId;
        },

        updateCharacter: (id, patch) =>
          set(s => {
            const oldChar = s.project.characters.find(c => c.id === id);
            if (!oldChar) return s;

            const updatedChar: Character = { ...oldChar, ...patch };
            let variableNodes = s.project.variableNodes;

            if (oldChar.varIds) {
              const { varIds } = oldChar;

              // Display name changed → update name var's defaultValue + descriptions
              if (patch.name !== undefined && patch.name !== oldChar.name) {
                variableNodes = updateVarInTree(variableNodes, varIds.nameVarId, {
                  defaultValue: patch.name,
                  description: `Character name "${patch.name}"`,
                });
                if (varIds.avatarVarId) {
                  variableNodes = updateVarInTree(variableNodes, varIds.avatarVarId, {
                    description: `Avatar URL for character "${patch.name}" (empty = hidden)`,
                  });
                }
                if (varIds.llmDescrVarId) {
                  variableNodes = updateVarInTree(variableNodes, varIds.llmDescrVarId, {
                    description: `LLM personality description for "${patch.name}"`,
                  });
                }
              }

              // Variable name changed → rename group
              if (patch.varName !== undefined) {
                const oldVarName = oldChar.varName || charToVarPrefix(oldChar.name);
                if (patch.varName !== oldVarName) {
                  variableNodes = updateGroupNameInTree(variableNodes, varIds.groupId, patch.varName);
                }
              }

              // Color changes → sync defaultValues
              if (patch.bgColor !== undefined) {
                variableNodes = updateVarInTree(variableNodes, varIds.bgColorVarId, { defaultValue: patch.bgColor });
              }
              if (patch.borderColor !== undefined) {
                variableNodes = updateVarInTree(variableNodes, varIds.borderColorVarId, { defaultValue: patch.borderColor });
              }
              if (patch.nameColor !== undefined) {
                variableNodes = updateVarInTree(variableNodes, varIds.nameColorVarId, { defaultValue: patch.nameColor });
              }
              if (patch.textColor !== undefined && varIds.textColorVarId) {
                variableNodes = updateVarInTree(variableNodes, varIds.textColorVarId, { defaultValue: patch.textColor });
              }
              // Avatar config change → sync $prefix_avatar defaultValue (static src only)
              if (patch.avatarConfig !== undefined && varIds.avatarVarId) {
                const defaultValue = patch.avatarConfig.mode === 'static' ? patch.avatarConfig.src : '';
                variableNodes = updateVarInTree(variableNodes, varIds.avatarVarId, { defaultValue });
              }
              // LLM description change → sync $prefix_llm_descr defaultValue
              if (patch.llm_descr !== undefined && varIds.llmDescrVarId) {
                variableNodes = updateVarInTree(variableNodes, varIds.llmDescrVarId, { defaultValue: patch.llm_descr });
              }
              // LLM temperature change → sync $prefix_llm_temperature defaultValue
              if (patch.llm_temperature !== undefined && varIds.llmTemperatureVarId) {
                variableNodes = updateVarInTree(variableNodes, varIds.llmTemperatureVarId, { defaultValue: String(patch.llm_temperature) });
              }
            }

            return {
              project: {
                ...s.project,
                characters: s.project.characters.map(c => c.id === id ? updatedChar : c),
                variableNodes,
              },
            };
          }),

        deleteCharacter: (id) => {
          get().saveSnapshot();
          set(s => {
            const char = s.project.characters.find(c => c.id === id);
            const variableNodes = char?.varIds
              ? removeNode(s.project.variableNodes as AnyNode[], char.varIds.groupId) as VariableTreeNode[]
              : s.project.variableNodes;
            return {
              project: {
                ...s.project,
                characters: s.project.characters.filter(c => c.id !== id),
                variableNodes,
              },
            };
          });
        },

        // ── Watchers ───────────────────────────────────────────────────────────

        addWatcher: () => {
          get().saveSnapshot();
          const w: Watcher = {
            id: uuid(),
            label: '',
            enabled: true,
            condition: { variableId: '', operator: '==', value: '' },
            actions: [],
          };
          set(s => ({ project: { ...s.project, watchers: [...(s.project.watchers ?? []), w] } }));
        },

        updateWatcher: (id, patch) => {
          get().saveSnapshot();
          set(s => ({
            project: {
              ...s.project,
              watchers: (s.project.watchers ?? []).map(w => w.id === id ? { ...w, ...patch } : w),
            },
          }));
        },

        deleteWatcher: (id) => {
          get().saveSnapshot();
          set(s => ({
            project: {
              ...s.project,
              watchers: (s.project.watchers ?? []).filter(w => w.id !== id),
            },
          }));
        },

        // ── Variable tree ──────────────────────────────────────────────────────

        addVariableGroup: (parentId, name) => {
          get().saveSnapshot();
          const siblings = getSiblings(get().project.variableNodes, parentId);
          const safeName = ensureUniqueName(name, siblings);
          const group: VariableGroup = { kind: 'group', id: uuid(), name: safeName, children: [] };
          set(s => ({
            project: {
              ...s.project,
              variableNodes: addNode(s.project.variableNodes as AnyNode[], parentId, group as AnyNode) as VariableTreeNode[],
            },
          }));
        },

        addVariable: (parentId, v) => {
          get().saveSnapshot();
          const siblings = getSiblings(get().project.variableNodes, parentId);
          const safeName = ensureUniqueName(v.name, siblings);
          const variable: Variable = { kind: 'variable', id: uuid(), ...v, name: safeName };
          set(s => ({
            project: {
              ...s.project,
              variableNodes: addNode(s.project.variableNodes as AnyNode[], parentId, variable as AnyNode) as VariableTreeNode[],
            },
          }));
        },

        updateVariable: (id, patch) =>
          set(s => ({
            project: {
              ...s.project,
              variableNodes: updateVarInTree(s.project.variableNodes, id, patch),
            },
          })),

        deleteVariableNode: (id) => {
          get().saveSnapshot();
          set(s => ({
            project: {
              ...s.project,
              variableNodes: removeNode(s.project.variableNodes as AnyNode[], id) as VariableTreeNode[],
            },
          }));
        },

        // ── Asset tree ────────────────────────────────────────────────────────

        addAssetGroup: (parentGroupId, name, relativePath) => {
          get().saveSnapshot();
          const group: AssetGroup = { kind: 'group', id: uuid(), name, relativePath, children: [] };
          set(s => ({
            project: {
              ...s.project,
              assetNodes: addNode(s.project.assetNodes as AnyNode[], parentGroupId, group as AnyNode) as AssetTreeNode[],
            },
          }));
        },

        renameAssetGroup: (id, name, newRelativePath) =>
          set(s => {
            const node = findAssetNodeById(s.project.assetNodes, id);
            if (!node || node.kind !== 'group') return s;
            return {
              project: {
                ...s.project,
                assetNodes: renameGroupInAssetTree(s.project.assetNodes, id, name, node.relativePath, newRelativePath),
              },
            };
          }),

        addAsset: (parentGroupId, a) => {
          get().saveSnapshot();
          const asset: Asset = { kind: 'asset', id: uuid(), ...a };
          set(s => ({
            project: {
              ...s.project,
              assetNodes: addNode(s.project.assetNodes as AnyNode[], parentGroupId, asset as AnyNode) as AssetTreeNode[],
            },
          }));
        },

        deleteAssetNode: (id) => {
          get().saveSnapshot();
          set(s => ({
            project: {
              ...s.project,
              assetNodes: removeNode(s.project.assetNodes as AnyNode[], id) as AssetTreeNode[],
            },
          }));
        },

        syncAssets: (nodes) =>
          set(s => ({ project: { ...s.project, assetNodes: nodes } })),

        // ── Sidebar panel ──────────────────────────────────────────────────────

        setPanelLiveUpdate: (v) =>
          set(s => ({
            project: { ...s.project, sidebarPanel: { ...s.project.sidebarPanel, liveUpdate: v } },
          })),

        updatePanelStyle: (patch) =>
          set(s => ({
            project: updatePanel(s.project, p => ({
              ...p,
              style: { ...(p.style ?? DEFAULT_PANEL_STYLE), ...patch },
            })),
          })),

        addPanelTab: (label) => {
          get().saveSnapshot();
          const tab: SidebarTab = { id: uuid(), label, rows: [] };
          set(s => ({
            project: updatePanel(s.project, p => ({ ...p, tabs: [...p.tabs, tab] })),
          }));
        },

        updatePanelTab: (tabId, patch) =>
          set(s => ({
            project: updatePanel(s.project, p => updateTab(p, tabId, t => ({ ...t, ...patch }))),
          })),

        deletePanelTab: (tabId) => {
          get().saveSnapshot();
          set(s => ({
            project: updatePanel(s.project, p => ({ ...p, tabs: p.tabs.filter(t => t.id !== tabId) })),
          }));
        },

        reorderPanelTabs: (tabs) => {
          get().saveSnapshot();
          set(s => ({
            project: updatePanel(s.project, p => ({ ...p, tabs })),
          }));
        },

        addPanelRow: (tabId) => {
          get().saveSnapshot();
          const row: SidebarRow = { id: uuid(), height: 15, cells: [] };
          set(s => ({
            project: updatePanel(s.project, p => updateTab(p, tabId, t => ({ ...t, rows: [...t.rows, row] }))),
          }));
        },

        updatePanelRow: (tabId, rowId, patch) =>
          set(s => ({
            project: updatePanel(s.project, p => updateTab(p, tabId, t => updateRow(t, rowId, r => ({ ...r, ...patch })))),
          })),

        deletePanelRow: (tabId, rowId) => {
          get().saveSnapshot();
          set(s => ({
            project: updatePanel(s.project, p =>
              updateTab(p, tabId, t => ({ ...t, rows: t.rows.filter(r => r.id !== rowId) }))
            ),
          }));
        },

        addPanelCell: (tabId, rowId) => {
          get().saveSnapshot();
          set(s => ({
            project: updatePanel(s.project, p =>
              updateTab(p, tabId, t => updateRow(t, rowId, r => {
                const newCell: SidebarCell = { id: uuid(), width: 0, content: { type: 'text', value: '' } };
                const cells = [...r.cells, newCell];
                return { ...r, cells: redistributeWidths(cells) };
              }))
            ),
          }));
        },

        updatePanelCell: (tabId, rowId, cellId, patch) =>
          set(s => ({
            project: updatePanel(s.project, p =>
              updateTab(p, tabId, t => updateRow(t, rowId, r => updateCell(r, cellId, c => ({ ...c, ...patch }))))
            ),
          })),

        deletePanelCell: (tabId, rowId, cellId) => {
          get().saveSnapshot();
          set(s => ({
            project: updatePanel(s.project, p =>
              updateTab(p, tabId, t =>
                updateRow(t, rowId, r => {
                  const cells = r.cells.filter(c => c.id !== cellId);
                  return { ...r, cells: cells.length > 0 ? redistributeWidths(cells) : cells };
                })
              )
            ),
          }));
        },

        updateCellContent: (tabId, rowId, cellId, content) =>
          set(s => ({
            project: updatePanel(s.project, p =>
              updateTab(p, tabId, t => updateRow(t, rowId, r => updateCell(r, cellId, c => ({ ...c, content }))))
            ),
          })),
      };
    },
    {
      name: 'purl-project',
      partialize: (state) => ({
        project: state.project,
        activeSceneId: state.activeSceneId,
        activeSidebarTab: state.activeSidebarTab,
        sidebarWidth: state.sidebarWidth,
        projectDir: state.projectDir,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.project) {
          state.project = migrateProject(state.project);
        }
      },
    }
  )
);
