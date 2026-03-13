// ─── Block appearance effects ────────────────────────────────────────────────

/** Delayed appearance: wraps block in <<timed Xs>>...<</timed>> on export */
export interface BlockDelay {
  delay: number;          // seconds, supports decimals (0.5)
  animation?: boolean;    // enable entrance animation
  animDuration?: number;  // animation duration in seconds, default 0.4
  animFade?: boolean;     // fade in (opacity 0→1); default true when animation is enabled
  animOffsetX?: number;   // horizontal start offset px (negative = from left, positive = from right)
  animOffsetY?: number;   // vertical start offset px (negative = from above, positive = from below)
}

/** Typewriter effect: wraps content in <<type Nms per char>>...<</type>> on export */
export interface BlockTypewriter {
  speed: number;  // ms per character (e.g. 40)
}

// ─── Block types ────────────────────────────────────────────────────────────

export interface TextBlock {
  id: string;
  type: 'text';
  content: string;
  live?: boolean;          // wrap in <<live 200>> on export for auto-refresh
  delay?: BlockDelay;
  typewriter?: BlockTypewriter;
}

export interface DialogueBlock {
  id: string;
  type: 'dialogue';
  characterId: string;
  text: string;
  align?: 'left' | 'right';  // avatar + name position, default 'left'
  live?: boolean;             // wrap in <<live 200>> on export for auto-refresh
  nameSuffix?: string;        // optional postfix shown as "Name (suffix)", e.g. "кричит"
  innerBlocks?: Block[];      // blocks rendered inside the dialogue bubble after the text
  delay?: BlockDelay;
  typewriter?: BlockTypewriter;
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
  delay?: BlockDelay;
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

/**
 * How the value is determined in a VariableSetBlock.
 * - 'manual'     — hardcoded literal
 * - 'random'     — generated randomly (see RandomConfig)
 * - 'expression' — arbitrary SugarCube numeric expression (number vars only)
 * - 'dynamic'    — string value chosen by mapping another variable's value (string vars only)
 */
export type VarValueMode = 'manual' | 'random' | 'expression' | 'dynamic';

/**
 * Configuration for generating a random value.
 * Used when valueMode is 'random'.
 */
export type RandomConfig =
  | { kind: 'number';  min: number; max: number }
  | { kind: 'boolean' }
  | { kind: 'string';  length: number };

/**
 * A single entry in the dynamic string mapping.
 * Maps a controlling variable's value (exact or range) to a string result.
 */
export interface StringBoundEntry {
  id?: string;
  matchType?: 'exact' | 'range';
  value: string;       // used when matchType === 'exact' (or undefined)
  rangeMin?: string;   // used when matchType === 'range'
  rangeMax?: string;   // used when matchType === 'range'
  result: string;      // the string value to assign to the target variable
}

export interface VariableSetBlock {
  id: string;
  type: 'variable-set';
  delay?: BlockDelay;
  variableId: string;
  operator: VarOperator;
  value: string;
  /** How the value is set. Defaults to 'manual'. */
  valueMode?: VarValueMode;
  /** Kept for backward compatibility with saves that used the old randomize checkbox. */
  randomize?: boolean;
  randomConfig?: RandomConfig;
  /** SugarCube expression used when valueMode is 'expression' (numbers only). */
  expression?: string;
  // ── Dynamic mode (string vars only, valueMode === 'dynamic') ─────────────
  /** Variable whose value controls which string is assigned. */
  dynamicVariableId?: string;
  dynamicMapping?: StringBoundEntry[];
  dynamicDefault?: string;  // fallback string when no mapping entry matches
}

export type ImageMode = 'static' | 'bound';

export interface ImageBlock {
  id: string;
  type: 'image';
  delay?: BlockDelay;
  /** Display mode. Defaults to 'static' for backward compat. */
  mode?: ImageMode;
  // ── Static mode ───────────────────────────────────────────────────────
  src: string;      // URL or asset relative path
  alt: string;
  width: number;    // 0 = auto
  // ── Bound mode (image changes based on a variable's value) ───────────
  variableId?: string;
  mapping?: ImageBoundMapping[];
  defaultSrc?: string;   // fallback when no mapping matches
}

export interface VideoBlock {
  id: string;
  type: 'video';
  src: string;
  autoplay: boolean;
  loop: boolean;
  controls: boolean;
  width: number;
  delay?: BlockDelay;
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
  delay?: BlockDelay;
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
  delay?: BlockDelay;
  label: string;        // prompt text shown above the input
  variableId: string;   // which variable to update
  placeholder: string;  // default value pre-filled in the field
}

/**
 * Raw SugarCube / HTML code block.
 * Content is inserted verbatim into the exported passage — no transformation.
 */
export interface RawBlock {
  id: string;
  type: 'raw';
  code: string;
  delay?: BlockDelay;
}

/**
 * Developer note block — visible only in the editor, never exported.
 * Useful for inline logic comments and as a search target.
 */
export interface NoteBlock {
  id: string;
  type: 'note';
  text: string;
}

/** Inline HTML table with rows, cells and per-block border/gap style. */
export interface TableBlock {
  id: string;
  type: 'table';
  rows: SidebarRow[];
  style: PanelStyle;
  delay?: BlockDelay;
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
  | InputFieldBlock
  | RawBlock
  | NoteBlock
  | TableBlock;

export type BlockType = Block['type'];

// ─── Scene ──────────────────────────────────────────────────────────────────

export interface Scene {
  id: string;
  name: string;
  tags: string[];
  blocks: Block[];
  /** Optional developer note — shown in the editor only, never exported. */
  notes?: string;
  /** Position of this scene's node in the scene graph window. */
  graphPosition?: { x: number; y: number };
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

/** Progress bar driven by a numeric variable */
export interface CellProgress {
  type: 'progress';
  variableId: string;   // current value
  maxValue: number;     // static maximum
  color: string;        // CSS fill color (used when colorRange is null/unset)
  emptyColor?: string;  // background of empty portion (default: '#333')
  textColor?: string;   // text color; '' or undefined = inherit from page
  colorRange?: { from: string; to: string } | null;  // if set, fill interpolates 0%→from, 100%→to
  showText: boolean;    // show "cur/max" as text
  vertical?: boolean;   // fill grows upward instead of rightward
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

/** Raw SugarCube / HTML code inserted verbatim into the StoryCaption cell */
export interface CellRaw {
  type: 'raw';
  code: string;
}

export type CellContent =
  | CellText
  | CellVariable
  | CellProgress
  | CellImageStatic
  | CellImageBound
  | CellRaw;

export interface SidebarCell {
  id: string;
  /** Cell width as a percentage (0–100). All cells in a row should sum to 100. */
  width: number;
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

/** Visual style settings for the sidebar panel table. */
export interface PanelStyle {
  rowGap:          number;   // px gap between rows
  borderWidth:     number;   // px, line thickness
  borderColor:     string;   // CSS color
  showOuterBorder: boolean;  // outer frame of the whole table
  showRowBorders:  boolean;  // horizontal dividers between rows
  showCellBorders: boolean;  // vertical dividers between cells
}

export interface SidebarPanel {
  tabs: SidebarTab[];
  liveUpdate: boolean;  // wrap StoryCaption in <<live 200>>
  /** Visual style; undefined = use defaults (backward compat). */
  style?: PanelStyle;
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
