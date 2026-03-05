// ─── Block types ────────────────────────────────────────────────────────────

export interface TextBlock {
  id: string;
  type: 'text';
  content: string;
  live?: boolean;  // wrap in <<live 200>> on export for auto-refresh
}

export interface DialogueBlock {
  id: string;
  type: 'dialogue';
  characterId: string;
  text: string;
  align?: 'left' | 'right';  // avatar + name position, default 'left'
  live?: boolean;             // wrap in <<live 200>> on export for auto-refresh
}

export interface ChoiceOption {
  id: string;
  label: string;
  targetSceneId: string;
  condition: string; // SugarCube expression, empty = always shown
}

export interface ChoiceBlock {
  id: string;
  type: 'choice';
  options: ChoiceOption[];
}

export type ConditionOperator = '==' | '!=' | '>' | '<' | '>=' | '<=';
export type ConditionBranchType = 'if' | 'elseif' | 'else';

export interface ConditionBranch {
  id: string;
  branchType: ConditionBranchType;
  variableId: string;    // empty for 'else'
  operator: ConditionOperator;
  value: string;
  blocks: Block[];
}

export interface ConditionBlock {
  id: string;
  type: 'condition';
  branches: ConditionBranch[];
}

export type VarOperator = '=' | '+=' | '-=' | '*=' | '/=';

export interface VariableSetBlock {
  id: string;
  type: 'variable-set';
  variableId: string;
  operator: VarOperator;
  value: string;
}

export interface ImageBlock {
  id: string;
  type: 'image';
  src: string;      // URL or asset relative path
  alt: string;
  width: number;    // 0 = auto
}

export interface VideoBlock {
  id: string;
  type: 'video';
  src: string;
  autoplay: boolean;
  loop: boolean;
  controls: boolean;
  width: number;
}

// ── Button block ──────────────────────────────────────────────────────────────

/** Visual style of a button block */
export interface ButtonStyle {
  bgColor: string;       // background-color
  textColor: string;     // color
  borderColor: string;   // border color
  borderRadius: number;  // px
  paddingV: number;      // vertical padding px
  paddingH: number;      // horizontal padding px
  fontSize: number;      // em × 10 — e.g. 10 = 1.0em, 12 = 1.2em
  bold: boolean;
  fullWidth: boolean;
}

/** A single variable mutation triggered by the button */
export interface ButtonAction {
  id: string;
  variableId: string;
  operator: VarOperator;
  value: string;
}

export interface ButtonBlock {
  id: string;
  type: 'button';
  label: string;
  style: ButtonStyle;
  actions: ButtonAction[];
  refreshScene?: boolean;  // add <<run Engine.show()>> on export to re-render passage
}

/**
 * Player-facing input field that updates a story variable.
 * Exports as <<textbox>> for string/boolean variables,
 * <<numberbox>> for number variables.
 */
export interface InputFieldBlock {
  id: string;
  type: 'input-field';
  label: string;        // prompt text shown above the input
  variableId: string;   // which variable to update
  placeholder: string;  // default value pre-filled in the field
}

export type Block =
  | TextBlock
  | DialogueBlock
  | ChoiceBlock
  | ConditionBlock
  | VariableSetBlock
  | ImageBlock
  | VideoBlock
  | ButtonBlock
  | InputFieldBlock;

export type BlockType = Block['type'];

// ─── Scene ──────────────────────────────────────────────────────────────────

export interface Scene {
  id: string;
  name: string;
  tags: string[];
  blocks: Block[];
}

// ─── Character ──────────────────────────────────────────────────────────────

/**
 * IDs of automatically created variable nodes for a character.
 * Stored on the Character so the store can keep variables in sync
 * when name/colors change, and can clean them up on deletion.
 */
export interface CharacterVarIds {
  groupId: string;          // top-level VariableGroup id
  stylesGroupId: string;    // "styles" sub-group id
  nameVarId: string;        // $prefix_name variable id
  bgColorVarId: string;     // $prefix_bgColor variable id
  borderColorVarId: string; // $prefix_borderColor variable id
  nameColorVarId: string;   // $prefix_nameColor variable id
  avatarVarId: string;      // $prefix_avatar variable id (URL string, empty = hidden)
}

export type AvatarMode = 'static' | 'bound';

/**
 * Avatar display configuration for a character.
 * mode 'static' — fixed URL stored in $prefix_avatar variable.
 * mode 'bound'  — image chosen via if/elseif chain based on another variable's value.
 * Uses the same ImageBoundMapping structure as panel image-bound cells.
 */
export interface AvatarConfig {
  mode: AvatarMode;
  src: string;              // static URL (static mode); mirrors $prefix_avatar defaultValue
  variableId: string;       // which variable drives the image (bound mode)
  mapping: ImageBoundMapping[];
  defaultSrc: string;       // fallback image when no mapping matches (bound mode)
}

export interface Character {
  id: string;
  name: string;
  nameColor: string;   // color for character name label
  bgColor: string;     // dialogue box background
  borderColor: string; // left border accent
  /** @deprecated Use avatarConfig instead. Kept for migration from pre-v1.4 saves. */
  avatarUrl?: string;
  /** Avatar settings (static URL or variable-bound). Added in v1.4. */
  avatarConfig?: AvatarConfig;
  /** Auto-created variable group. Absent on characters from old saves. */
  varIds?: CharacterVarIds;
}

// ─── Variable ───────────────────────────────────────────────────────────────

export type VariableType = 'number' | 'string' | 'boolean';

export interface Variable {
  kind: 'variable';
  id: string;
  name: string;          // without $
  varType: VariableType;
  defaultValue: string;
  description: string;
}

export interface VariableGroup {
  kind: 'group';
  id: string;
  name: string;
  children: VariableTreeNode[];
}

export type VariableTreeNode = VariableGroup | Variable;

// ─── Asset ───────────────────────────────────────────────────────────────────

export type AssetType = 'image' | 'video';

/** A leaf node in the asset tree — represents a single media file on disk */
export interface Asset {
  kind: 'asset';
  id: string;
  name: string;
  assetType: AssetType;
  /**
   * Path relative to the project root, using forward slashes.
   * E.g. "assets/chars/hero.png" or "assets/logo.png"
   */
  relativePath: string;
}

/** A group node in the asset tree — maps to a folder on disk */
export interface AssetGroup {
  kind: 'group';
  id: string;
  name: string;
  /**
   * Path relative to the project root, using forward slashes.
   * E.g. "assets/chars" or "assets/chars/heroes"
   */
  relativePath: string;
  children: AssetTreeNode[];
}

export type AssetTreeNode = AssetGroup | Asset;

// ─── Sidebar panel (story UI bar content) ────────────────────────────────────

/** Static text in a cell */
export interface CellText {
  type: 'text';
  value: string;
}

/** Displays a variable value, with optional prefix/suffix labels */
export interface CellVariable {
  type: 'variable';
  variableId: string;
  prefix: string;   // shown before the value, e.g. "HP: "
  suffix: string;   // shown after the value, e.g. " pts"
}

/** Horizontal progress bar driven by a numeric variable */
export interface CellProgress {
  type: 'progress';
  variableId: string;   // current value
  maxValue: number;     // static maximum
  color: string;        // CSS color for the bar
  showText: boolean;    // show "cur/max" as text
}

/** Static image from assets */
export interface CellImageStatic {
  type: 'image-static';
  src: string;           // relativePath from assets
  objectFit: 'cover' | 'contain';
}

/**
 * A single entry in image-bound mapping.
 * matchType 'exact'  — show src when $var equals value
 * matchType 'range'  — show src when rangeMin ≤ $var ≤ rangeMax (numeric)
 * Fields id/matchType/rangeMin/rangeMax are optional for backward compat with
 * old saved data that only had { value, src }.
 */
export interface ImageBoundMapping {
  id?: string;
  matchType?: 'exact' | 'range';
  value: string;      // used when matchType === 'exact' (or undefined)
  rangeMin?: string;  // used when matchType === 'range'
  rangeMax?: string;  // used when matchType === 'range'
  src: string;
}

/** Image that changes based on a variable value */
export interface CellImageBound {
  type: 'image-bound';
  variableId: string;
  mapping: ImageBoundMapping[];
  defaultSrc: string;   // shown when no mapping matches
  objectFit: 'cover' | 'contain';
}

export type CellContent =
  | CellText
  | CellVariable
  | CellProgress
  | CellImageStatic
  | CellImageBound;

export interface SidebarCell {
  id: string;
  width: number;   // flex weight (1–12)
  content: CellContent;
}

export interface SidebarRow {
  id: string;
  height: number;  // px
  cells: SidebarCell[];
}

export interface SidebarTab {
  id: string;
  label: string;
  rows: SidebarRow[];
}

export interface SidebarPanel {
  tabs: SidebarTab[];
  liveUpdate: boolean;  // wrap StoryCaption in <<live 200>>
}

// ─── Project ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  title: string;
  ifid: string;
  scenes: Scene[];
  characters: Character[];
  variableNodes: VariableTreeNode[];
  assetNodes: AssetTreeNode[];
  sidebarPanel: SidebarPanel;
}
