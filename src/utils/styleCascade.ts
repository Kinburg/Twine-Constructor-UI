/**
 * Cascade-based block styling system.
 *
 * Three layers per block, in increasing priority:
 *   1. Standard     — built-in fields on Character / Block (no override)
 *   2. Common custom — Character.customDialogueStyle (dialogues)
 *                      or ProjectSettings.defaultBlockStyles[type] (others)
 *                      Supports static or bound (numeric-variable-driven) mode.
 *   3. Spot custom  — block.customStyle (always static)
 *
 * Bound mode emits one CSS class per variant + a default; runtime script
 * (`_tgRefreshStyleBind`) swaps classes based on the current variable value.
 *
 * All raw CSS is auto-scoped to the layer's class via `autoScopeRawCss()`.
 */

import type {
  Block,
  ButtonBlock,
  Character,
  DialogueBlock,
  FunctionBlock,
  LinkBlock,
  Project,
  ProjectSettings,
  Scene,
} from '../types';
import { getVariablePath } from './treeUtils';

// ─── Field schemas (shared with StyleOverrideEditor) ─────────────────────────

/** Type of a single editable field in a style override. */
export type StyleFieldType = 'color' | 'number' | 'boolean';

/**
 * Schema describing one editable field of `BlockStyleOverride.fields`.
 * Used both for UI rendering (StyleOverrideEditor) and CSS emission helpers.
 */
export interface StyleFieldDescriptor {
  /** Key inside `BlockStyleOverride.fields`. */
  key: string;
  type: StyleFieldType;
  /** i18n key under `t.styleOverride.fields`. */
  labelKey: string;
  /** For type === 'number'. */
  min?: number;
  max?: number;
  suffix?: string;
}

/** Help block shown inside the raw-CSS editor's <details> panel. */
export interface StyleRawCssHelp {
  /** Class/element selector names valid for this block type. */
  selectors: Array<{ name: string; descKey: string }>;
  /** Example raw-CSS snippet shown in <pre>. */
  exampleCode: string;
  /**
   * i18n key under `t.styleOverride` resolving to a block-type-specific
   * placeholder for the textarea. Falls back to `t.styleOverride.rawCssPlaceholder`
   * when unset or when the resolved value is empty.
   */
  placeholderKey?: string;
}

export const DIALOGUE_FIELD_SCHEMA: ReadonlyArray<StyleFieldDescriptor> = [
  { key: 'bgColor',     type: 'color', labelKey: 'bgColor' },
  { key: 'borderColor', type: 'color', labelKey: 'borderColor' },
  { key: 'nameColor',   type: 'color', labelKey: 'nameColor' },
  { key: 'textColor',   type: 'color', labelKey: 'textColor' },
];

export const BUTTON_FIELD_SCHEMA: ReadonlyArray<StyleFieldDescriptor> = [
  { key: 'bgColor',      type: 'color',   labelKey: 'bgColor' },
  { key: 'textColor',    type: 'color',   labelKey: 'textColor' },
  { key: 'borderColor',  type: 'color',   labelKey: 'borderColor' },
  { key: 'borderRadius', type: 'number',  labelKey: 'borderRadius', min: 0, max: 50, suffix: 'px' },
  { key: 'paddingV',     type: 'number',  labelKey: 'paddingV',     min: 0, max: 40, suffix: 'px' },
  { key: 'paddingH',     type: 'number',  labelKey: 'paddingH',     min: 0, max: 80, suffix: 'px' },
  { key: 'fontSize',     type: 'number',  labelKey: 'fontSize',     min: 6, max: 30, suffix: '×0.1em' },
  { key: 'bold',         type: 'boolean', labelKey: 'bold' },
  { key: 'fullWidth',    type: 'boolean', labelKey: 'fullWidth' },
];

export const DIALOGUE_RAW_CSS_HELP: StyleRawCssHelp = {
  selectors: [
    { name: '.char-body',   descKey: 'selectorBody' },
    { name: '.char-name',   descKey: 'selectorName' },
    { name: '.char-text',   descKey: 'selectorText' },
    { name: '.char-avatar', descKey: 'selectorAvatar' },
  ],
  exampleCode:
`.char-body { border-radius: 12px; padding: 14px 18px; box-shadow: 0 2px 10px rgba(0,0,0,0.3); }
.char-name { font-family: 'Georgia', serif; letter-spacing: 0.04em; }
.char-text { line-height: 1.6; }
.char-avatar { border-radius: 50%; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }`,
  placeholderKey: 'placeholderDialogue',
};

export const BUTTON_RAW_CSS_HELP: StyleRawCssHelp = {
  selectors: [
    { name: 'a',        descKey: 'selectorButtonA' },
    { name: 'a:hover',  descKey: 'selectorButtonAHover' },
    { name: 'a:active', descKey: 'selectorButtonAActive' },
  ],
  exampleCode:
`a { box-shadow: 0 2px 8px rgba(0,0,0,0.3); text-transform: uppercase; letter-spacing: 0.06em; }
a:hover { transform: translateY(-1px); filter: brightness(1.15); }
a:active { transform: translateY(1px); }`,
  placeholderKey: 'placeholderButton',
};

// ─── Dialogue field → CSS mapping ─────────────────────────────────────────────

/**
 * Translate a `fields` record into per-sub-element CSS declarations.
 * Returns separate buckets per CSS selector group:
 *   body / bodyRight / name / text  → matches the `.char-body`, `.char-name`, `.char-text` structure.
 *
 * Border colour fans out to `border-left` (default) and `border-right` (dlg-right).
 */
function dialogueFieldsToDecls(fields: Record<string, string | number | boolean>): {
  body: string[];
  bodyRight: string[];
  name: string[];
  text: string[];
} {
  const body: string[] = [];
  const bodyRight: string[] = [];
  const name: string[] = [];
  const text: string[] = [];

  if (fields.bgColor !== undefined && fields.bgColor !== '') {
    body.push(`background: ${fields.bgColor}`);
  }
  if (fields.borderColor !== undefined && fields.borderColor !== '') {
    body.push(`border-left: 4px solid ${fields.borderColor}`);
    bodyRight.push(`border-left: none`);
    bodyRight.push(`border-right: 4px solid ${fields.borderColor}`);
  }
  if (fields.nameColor !== undefined && fields.nameColor !== '') {
    name.push(`color: ${fields.nameColor}`);
  }
  if (fields.textColor !== undefined && fields.textColor !== '') {
    text.push(`color: ${fields.textColor}`);
  }

  return { body, bodyRight, name, text };
}

// ─── Raw CSS auto-scoping ────────────────────────────────────────────────────

/**
 * Prefix every rule in `rawCss` with `scopeSelector` so user CSS can't escape
 * its layer. Best-effort parsing:
 *   - Bare declarations (`color: red; padding: 8px;`) → wrap as `scope { … }`.
 *   - Selector blocks  (`.char-name { color: red; }`) → become `scope .char-name { color: red; }`.
 *   - `@media (…)` blocks are left alone (no inner scoping); rare in practice.
 *
 * Naive but safe: if user wrote `body { … }` we'd produce
 *   `<scope> body { … }` — selector matches nothing, no global pollution.
 */
export function autoScopeRawCss(scopeSelector: string, rawCss: string): string {
  const trimmed = rawCss.trim();
  if (!trimmed) return '';

  // No braces → treat as bare declarations
  if (!trimmed.includes('{')) {
    return `${scopeSelector} { ${trimmed} }`;
  }

  // Split top-level rules by walking through and tracking brace depth.
  const rules: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        rules.push(trimmed.slice(start, i + 1).trim());
        start = i + 1;
      }
    }
  }
  // Trailing bare declarations after last rule
  const tail = trimmed.slice(start).trim();
  if (tail) rules.push(tail);

  return rules
    .map(rule => {
      if (!rule) return '';
      // @-rules pass through verbatim
      if (rule.startsWith('@')) return rule;
      const braceIdx = rule.indexOf('{');
      if (braceIdx === -1) {
        // Bare declaration tail
        return `${scopeSelector} { ${rule} }`;
      }
      const selectorPart = rule.slice(0, braceIdx).trim();
      const bodyPart = rule.slice(braceIdx);
      // Split comma-separated selectors and prefix each
      const prefixed = selectorPart
        .split(',')
        .map(s => `${scopeSelector} ${s.trim()}`)
        .join(', ');
      return `${prefixed} ${bodyPart}`;
    })
    .filter(Boolean)
    .join('\n');
}

// ─── Cascade resolution helpers ──────────────────────────────────────────────

/** Standard dialogue fields derived from a Character's base properties. */
function dialogueStdFields(char: Character): Record<string, string | number | boolean> {
  return {
    bgColor:     char.bgColor,
    borderColor: char.borderColor,
    nameColor:   char.nameColor,
    textColor:   char.textColor ?? '#e2e8f0',
  };
}

/** Merge std with override `fields`, taking override values when present. */
function mergeFields(
  std: Record<string, string | number | boolean>,
  override?: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  return { ...std, ...(override ?? {}) };
}

// ─── Dialogue: build CSS rule for one class scope ────────────────────────────

/**
 * Build dialogue CSS rules targeting a single scope class
 * (e.g. `.dlg-hero` or `.dlg-hero-v-0` or `.dlg-spot-abc`).
 */
function buildDialogueRulesForScope(
  scopeClass: string,
  fields: Record<string, string | number | boolean>,
  rawCss?: string,
): string {
  const { body, bodyRight, name, text } = dialogueFieldsToDecls(fields);
  const parts: string[] = [];

  if (body.length > 0) {
    parts.push(`.dialogue.${scopeClass} .char-body { ${body.join('; ')}; }`);
  }
  if (bodyRight.length > 0) {
    parts.push(`.dialogue.dlg-right.${scopeClass} .char-body { ${bodyRight.join('; ')}; }`);
  }
  if (name.length > 0) {
    parts.push(`.dialogue.${scopeClass} .char-name { ${name.join('; ')}; }`);
  }
  if (text.length > 0) {
    parts.push(`.dialogue.${scopeClass} .char-text { ${text.join('; ')}; }`);
  }
  if (rawCss && rawCss.trim()) {
    parts.push(autoScopeRawCss(`.dialogue.${scopeClass}`, rawCss));
  }

  return parts.join('\n');
}

// ─── Class-name helpers ──────────────────────────────────────────────────────

/** Stable identifier-friendly class fragment from a character ID. */
function charClassId(charId: string): string {
  return charId.replace(/[^a-zA-Z0-9]/g, '');
}

export function dialogueBaseClass(charId: string): string {
  return `dlg-${charClassId(charId)}`;
}

export function dialogueVariantClass(charId: string, variantKey: string): string {
  return `dlg-${charClassId(charId)}-v-${variantKey}`;
}

export function dialogueSpotClass(blockId: string): string {
  return `dlg-spot-${blockId.replace(/[^a-zA-Z0-9]/g, '')}`;
}

// ─── Public: per-character CSS for story.css ─────────────────────────────────

/**
 * Generate the full CSS rule set for one character (Layer 1 + Layer 2).
 * In static (or absent) common-custom: one set of rules under `.dlg-{charId}`.
 * In bound common-custom: one set per variant under `.dlg-{charId}-v-{N|default}`.
 */
export function buildDialogueCharCss(char: Character): string {
  const baseCls = dialogueBaseClass(char.id);
  const std = dialogueStdFields(char);
  const cs = char.customDialogueStyle;

  if (!cs?.enabled) {
    // Pure standard
    return buildDialogueRulesForScope(baseCls, std);
  }

  if ((cs.mode ?? 'static') === 'static') {
    // Standard + common-static
    const merged = mergeFields(std, cs.fields);
    return buildDialogueRulesForScope(baseCls, merged, cs.rawCss);
  }

  // Bound mode: emit one rule set per variant + default
  const parts: string[] = [];

  // Default variant (used when variable is undefined or no entry matches)
  const defaultMerged = mergeFields(std, cs.defaultFields);
  parts.push(
    buildDialogueRulesForScope(
      dialogueVariantClass(char.id, 'default'),
      defaultMerged,
      cs.defaultRawCss,
    ),
  );

  // Each mapping entry
  (cs.mapping ?? []).forEach((entry, idx) => {
    const merged = mergeFields(std, entry.fields);
    parts.push(
      buildDialogueRulesForScope(
        dialogueVariantClass(char.id, String(idx)),
        merged,
        entry.rawCss,
      ),
    );
  });

  return parts.filter(Boolean).join('\n');
}

/** Combined CSS for all characters. Used by story.css + editor injection. */
export function buildAllDialogueCss(characters: Character[]): string {
  const base = [
    '.dialogue { display: flex; align-items: flex-start; gap: 8px; margin: 4px 0; font-style: italic; }',
    '.dialogue.dlg-right { flex-direction: row-reverse; }',
    '.char-avatar { width: 96px; height: 96px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }',
    '.char-body { flex: 1; padding: 8px 12px; border-radius: 4px; }',
    '.char-name { font-weight: bold; display: block; margin-bottom: 4px; }',
    '.char-text { display: block; margin: 0 !important; padding: 0; }',
  ].join('\n');
  if (characters.length === 0) return base;
  const perChar = characters.map(buildDialogueCharCss).filter(Boolean).join('\n\n');
  return `${base}\n\n${perChar}`;
}

// ─── Public: spot CSS for a single block (inline <style>) ────────────────────

/**
 * Generate a `<style>` block scoped to a unique class for the block's spot override.
 * Returns '' when the block has no enabled spot override.
 *
 * Spot is always static — bound mode is ignored at this layer.
 */
export function buildDialogueSpotStyleBlock(block: DialogueBlock): string {
  const cs = block.customStyle;
  if (!cs?.enabled) return '';
  // Force static at spot layer
  const fields = cs.fields ?? {};
  const rawCss = cs.rawCss;
  if (Object.keys(fields).length === 0 && (!rawCss || !rawCss.trim())) return '';

  const scopeCls = dialogueSpotClass(block.id);
  const rules = buildDialogueRulesForScope(scopeCls, fields, rawCss);
  return rules ? `<style>${rules}</style>` : '';
}

// ─── Class lists for the rendered element ────────────────────────────────────

/**
 * Compute the classes to apply on a dialogue element.
 *
 * @param char     — the character (mandatory).
 * @param block    — the dialogue block (optional, for spot class).
 * @param variantOverride — when set, applies this variant key instead of 'default'.
 *                          Used by the editor preview cycling.
 */
export function dialogueElementClasses(
  char: Character,
  block?: DialogueBlock,
  variantOverride?: string,
): string[] {
  const out = ['dialogue', dialogueBaseClass(char.id)];

  const cs = char.customDialogueStyle;
  if (cs?.enabled && (cs.mode ?? 'static') === 'bound') {
    const variantKey = variantOverride ?? 'default';
    out.push(dialogueVariantClass(char.id, variantKey));
  }

  if (block?.customStyle?.enabled) {
    out.push(dialogueSpotClass(block.id));
  }

  return out;
}

/** Returns the `data-style-bind` attribute value, or '' when none needed. */
export function dialogueDataStyleBind(char: Character): string {
  const cs = char.customDialogueStyle;
  if (cs?.enabled && (cs.mode ?? 'static') === 'bound') {
    return charClassId(char.id);
  }
  return '';
}

// ─── Button family (Button / Link / Function) ────────────────────────────────

export type ButtonFamilyType = 'button' | 'link' | 'function';
type ButtonFamilyBlock = ButtonBlock | LinkBlock | FunctionBlock;

function buttonShortId(blockId: string): string {
  return blockId.replace(/-/g, '').substring(0, 12);
}

/** Per-instance Std class — same shape as today's `tg-btn-{id}`. */
export function buttonInstanceClass(blockId: string): string {
  return `tg-btn-${buttonShortId(blockId)}`;
}

/** Common (per-block-type project default) class. */
export function buttonDefaultClass(type: ButtonFamilyType): string {
  return `tg-btn-default-${type}`;
}

/** Bound variant class for a given type and variant key (idx or 'default'). */
export function buttonDefaultVariantClass(type: ButtonFamilyType, variantKey: string): string {
  return `tg-btn-default-${type}-v-${variantKey}`;
}

/** Spot (per-block) class. */
export function buttonSpotClass(blockId: string): string {
  return `tg-btn-spot-${buttonShortId(blockId)}`;
}

/** Copy `block.style` fields into the generic style-override fields record. */
function buttonStdFields(block: ButtonFamilyBlock): Record<string, string | number | boolean> {
  const s = block.style;
  return {
    bgColor:      s.bgColor,
    textColor:    s.textColor,
    borderColor:  s.borderColor,
    borderRadius: s.borderRadius,
    paddingV:     s.paddingV,
    paddingH:     s.paddingH,
    fontSize:     s.fontSize,
    bold:         s.bold,
    fullWidth:    s.fullWidth,
  };
}

/**
 * Build CSS rules for one button-family scope (`tg-btn-{id}`, `tg-btn-default-{type}`,
 * `tg-btn-default-{type}-v-{idx}`, or `tg-btn-spot-{id}`).
 *
 * Skips fields that are undefined / empty so partial overrides (e.g. common only
 * setting `bgColor`) let lower layers show through.
 */
function buildButtonRulesForScope(
  scopeClass: string,
  fields: Record<string, string | number | boolean>,
  rawCss?: string,
): string {
  const parts: string[] = [];

  // ─── Declarations on the inner <a> ─────────────────────────────────────────
  const aDecls: string[] = [];

  if (fields.bgColor      !== undefined && fields.bgColor      !== '') aDecls.push(`background: ${fields.bgColor}`);
  if (fields.textColor    !== undefined && fields.textColor    !== '') aDecls.push(`color: ${fields.textColor}`);
  if (fields.borderColor  !== undefined && fields.borderColor  !== '') aDecls.push(`border: 1px solid ${fields.borderColor}`);
  if (fields.borderRadius !== undefined && fields.borderRadius !== '') aDecls.push(`border-radius: ${fields.borderRadius}px`);

  const pvSet = fields.paddingV !== undefined && fields.paddingV !== '';
  const phSet = fields.paddingH !== undefined && fields.paddingH !== '';
  if (pvSet && phSet) {
    aDecls.push(`padding: ${fields.paddingV}px ${fields.paddingH}px`);
  } else if (pvSet) {
    aDecls.push(`padding-top: ${fields.paddingV}px`);
    aDecls.push(`padding-bottom: ${fields.paddingV}px`);
  } else if (phSet) {
    aDecls.push(`padding-left: ${fields.paddingH}px`);
    aDecls.push(`padding-right: ${fields.paddingH}px`);
  }

  if (fields.fontSize !== undefined && fields.fontSize !== '') {
    const n = Number(fields.fontSize);
    if (Number.isFinite(n)) aDecls.push(`font-size: ${(n / 10).toFixed(1)}em`);
  }

  if (fields.bold === true)  aDecls.push(`font-weight: bold`);
  if (fields.bold === false) aDecls.push(`font-weight: normal`);

  if (aDecls.length > 0) {
    parts.push(`.${scopeClass} a { ${aDecls.join('; ')}; }`);
  }

  // ─── Full-width handling (affects wrapper <span> + <a>) ────────────────────
  if (fields.fullWidth === true) {
    parts.push(`.${scopeClass} { display: block; }`);
    parts.push(`.${scopeClass} a { display: block; width: 100%; box-sizing: border-box; text-align: center; }`);
  } else if (fields.fullWidth === false) {
    parts.push(`.${scopeClass} { display: inline-block; }`);
    parts.push(`.${scopeClass} a { display: inline-block; width: auto; text-align: left; }`);
  }

  // ─── Raw CSS (auto-scoped) ─────────────────────────────────────────────────
  if (rawCss && rawCss.trim()) {
    parts.push(autoScopeRawCss(`.${scopeClass}`, rawCss));
  }

  return parts.join('\n');
}

/** Collect all button/link/function blocks from a scene tree (recurses into IF branches). */
export function collectButtonFamilyBlocks(blocks: Block[]): ButtonFamilyBlock[] {
  const result: ButtonFamilyBlock[] = [];
  for (const b of blocks) {
    if (b.type === 'button' || b.type === 'link' || b.type === 'function') result.push(b);
    if (b.type === 'condition') {
      for (const br of b.branches) result.push(...collectButtonFamilyBlocks(br.blocks));
    }
  }
  return result;
}

/**
 * Generate the full CSS for button-family blocks: structural base + per-instance Std
 * rules + per-type Common rules (static or bound variants).
 *
 * Spot rules are emitted separately by `buildButtonSpotStyleBlock` (passage-inline).
 */
export function buildButtonsCascadeCss(scenes: Scene[], settings: ProjectSettings): string {
  const buttons = scenes.flatMap(s => collectButtonFamilyBlocks(s.blocks));
  const defaults = settings.defaultBlockStyles ?? {};

  const enabledTypes: ButtonFamilyType[] = (['button', 'link', 'function'] as const)
    .filter(t => defaults[t]?.enabled);

  if (buttons.length === 0 && enabledTypes.length === 0) return '';

  const base = [
    '.tg-btn { display: inline-block; }',
    '.tg-btn a { display: inline-block; text-decoration: none; cursor: pointer; transition: filter 0.15s; }',
    '.tg-btn a:hover { filter: brightness(1.2); }',
  ].join('\n');

  const parts: string[] = [base];

  // Per-block Std rules (one per button-family instance)
  for (const b of buttons) {
    const rule = buildButtonRulesForScope(buttonInstanceClass(b.id), buttonStdFields(b));
    if (rule) parts.push(rule);
  }

  // Common rules per type (static = 1 rule, bound = N+1 variant rules)
  for (const type of enabledTypes) {
    const cs = defaults[type]!;
    if ((cs.mode ?? 'static') === 'static') {
      const rule = buildButtonRulesForScope(buttonDefaultClass(type), cs.fields ?? {}, cs.rawCss);
      if (rule) parts.push(rule);
    } else {
      // Bound: emit default variant + one per mapping entry
      const defaultRule = buildButtonRulesForScope(
        buttonDefaultVariantClass(type, 'default'),
        cs.defaultFields ?? {},
        cs.defaultRawCss,
      );
      if (defaultRule) parts.push(defaultRule);
      (cs.mapping ?? []).forEach((entry, idx) => {
        const rule = buildButtonRulesForScope(
          buttonDefaultVariantClass(type, String(idx)),
          entry.fields ?? {},
          entry.rawCss,
        );
        if (rule) parts.push(rule);
      });
    }
  }

  return parts.filter(Boolean).join('\n\n');
}

/**
 * Generate a `<style>` block scoped to the block's spot class. Returns '' when
 * the block has no enabled customStyle. Spot is always static.
 */
export function buildButtonSpotStyleBlock(block: ButtonFamilyBlock): string {
  const cs = block.customStyle;
  if (!cs?.enabled) return '';
  const fields = cs.fields ?? {};
  const rawCss = cs.rawCss;
  if (Object.keys(fields).length === 0 && (!rawCss || !rawCss.trim())) return '';
  const rules = buildButtonRulesForScope(buttonSpotClass(block.id), fields, rawCss);
  return rules ? `<style>${rules}</style>` : '';
}

/** Class list for a rendered button-family `<span>` wrapper. */
export function buttonElementClasses(block: ButtonFamilyBlock, settings: ProjectSettings): string[] {
  const out = ['tg-btn', buttonInstanceClass(block.id)];
  const cs = settings.defaultBlockStyles?.[block.type];
  if (cs?.enabled) {
    if ((cs.mode ?? 'static') === 'bound') {
      out.push(buttonDefaultVariantClass(block.type as ButtonFamilyType, 'default'));
    } else {
      out.push(buttonDefaultClass(block.type as ButtonFamilyType));
    }
  }
  if (block.customStyle?.enabled) {
    out.push(buttonSpotClass(block.id));
  }
  return out;
}

/** Returns `data-style-bind` value (e.g. `"default-button"`) when bound, else ''. */
export function buttonDataStyleBind(block: ButtonFamilyBlock, settings: ProjectSettings): string {
  const cs = settings.defaultBlockStyles?.[block.type];
  if (cs?.enabled && (cs.mode ?? 'static') === 'bound') {
    return `default-${block.type}`;
  }
  return '';
}

// ─── Runtime style-bind script ───────────────────────────────────────────────

interface RuntimeBinding {
  /** data-style-bind value (matches the element's attribute). */
  key: string;
  /** SugarCube variable path WITHOUT leading $. */
  varPath: string;
  /**
   * Class-name prefix used to strip stale variant classes from the element
   * before adding the new one. Examples:
   *   - dialogue: `dlg-{charKey}-v-`
   *   - button family: `tg-btn-default-{type}-v-`
   */
  classPrefix: string;
  /** Variant entries — first match wins. */
  variants: Array<
    | { kind: 'exact'; value: number; cls: string }
    | { kind: 'range'; min: number; max: number; cls: string }
  >;
  /** Default class (used when no variant matches or variable undefined/non-numeric). */
  defaultCls: string;
}

/**
 * Build runtime bindings for every layer that uses bound common-custom:
 *   - Dialogue: one entry per character with bound `customDialogueStyle`
 *   - Button family: one entry per type whose `defaultBlockStyles[type]` is bound
 */
function collectRuntimeBindings(project: Project): RuntimeBinding[] {
  const bindings: RuntimeBinding[] = [];

  // ─── Dialogue (per character) ──────────────────────────────────────────────
  for (const char of project.characters) {
    const cs = char.customDialogueStyle;
    if (!cs?.enabled || (cs.mode ?? 'static') !== 'bound') continue;
    if (!cs.variableId) continue;
    const varPath = getVariablePath(cs.variableId, project.variableNodes);
    if (!varPath) continue;

    const variants: RuntimeBinding['variants'] = [];
    (cs.mapping ?? []).forEach((entry, idx) => {
      const cls = dialogueVariantClass(char.id, String(idx));
      if (entry.matchType === 'exact') {
        const v = Number(entry.value);
        if (Number.isFinite(v)) variants.push({ kind: 'exact', value: v, cls });
      } else {
        const min = Number(entry.rangeMin);
        const max = Number(entry.rangeMax);
        if (Number.isFinite(min) && Number.isFinite(max)) {
          variants.push({ kind: 'range', min, max, cls });
        }
      }
    });

    const charKey = charClassId(char.id);
    bindings.push({
      key: charKey,
      varPath,
      classPrefix: `dlg-${charKey}-v-`,
      variants,
      defaultCls: dialogueVariantClass(char.id, 'default'),
    });
  }

  // ─── Button family (per type) ─────────────────────────────────────────────
  const defaults = project.settings.defaultBlockStyles ?? {};
  for (const type of ['button', 'link', 'function'] as const) {
    const cs = defaults[type];
    if (!cs?.enabled || (cs.mode ?? 'static') !== 'bound') continue;
    if (!cs.variableId) continue;
    const varPath = getVariablePath(cs.variableId, project.variableNodes);
    if (!varPath) continue;

    const variants: RuntimeBinding['variants'] = [];
    (cs.mapping ?? []).forEach((entry, idx) => {
      const cls = buttonDefaultVariantClass(type, String(idx));
      if (entry.matchType === 'exact') {
        const v = Number(entry.value);
        if (Number.isFinite(v)) variants.push({ kind: 'exact', value: v, cls });
      } else {
        const min = Number(entry.rangeMin);
        const max = Number(entry.rangeMax);
        if (Number.isFinite(min) && Number.isFinite(max)) {
          variants.push({ kind: 'range', min, max, cls });
        }
      }
    });

    bindings.push({
      key: `default-${type}`,
      varPath,
      classPrefix: `tg-btn-default-${type}-v-`,
      variants,
      defaultCls: buttonDefaultVariantClass(type, 'default'),
    });
  }

  return bindings;
}

/**
 * Emit the runtime script that swaps variant classes on `[data-style-bind]`
 * elements based on a numeric variable's current value.
 *
 * Returns '' when no bindings exist (no characters use bound mode).
 *
 * The script:
 *   - Defines `window._tgStyleBindings` registry keyed by binding.key
 *   - Defines `window._tgRefreshStyleBind()` that walks all `[data-style-bind]` nodes,
 *     reads the bound variable, picks the matching variant, swaps the class
 *   - Hooks `:passagedisplay`
 *
 * Click handlers in exported buttons should also call `_tgRefreshStyleBind()` for
 * mid-passage updates (added separately in exportToTwee).
 */
export function buildStyleBindScript(project: Project): string {
  const bindings = collectRuntimeBindings(project);
  if (bindings.length === 0) return '';

  const registryEntries = bindings.map(b => {
    const variants = b.variants.map(v => {
      if (v.kind === 'exact') {
        return `{kind:"exact",value:${v.value},cls:${JSON.stringify(v.cls)}}`;
      }
      return `{kind:"range",min:${v.min},max:${v.max},cls:${JSON.stringify(v.cls)}}`;
    }).join(',');
    return `${JSON.stringify(b.key)}:{varPath:${JSON.stringify(b.varPath)},classPrefix:${JSON.stringify(b.classPrefix)},variants:[${variants}],defaultCls:${JSON.stringify(b.defaultCls)}}`;
  }).join(',');

  return [
    'window._tgStyleBindings = {' + registryEntries + '};',
    'window._tgReadVarByPath = function(path) {',
    '  var parts = path.split("."), cur = State.variables;',
    '  for (var i = 0; i < parts.length; i++) {',
    '    if (cur == null) return undefined;',
    '    cur = cur[parts[i]];',
    '  }',
    '  return cur;',
    '};',
    'window._tgRefreshStyleBind = function() {',
    '  var bindings = window._tgStyleBindings; if (!bindings) return;',
    '  document.querySelectorAll("[data-style-bind]").forEach(function(el) {',
    '    var key = el.getAttribute("data-style-bind");',
    '    var b = bindings[key]; if (!b) return;',
    '    var v = window._tgReadVarByPath(b.varPath);',
    '    var n = (typeof v === "number" && isFinite(v)) ? v : null;',
    '    var picked = b.defaultCls;',
    '    if (n !== null) {',
    '      for (var i = 0; i < b.variants.length; i++) {',
    '        var entry = b.variants[i];',
    '        if (entry.kind === "exact" && n === entry.value) { picked = entry.cls; break; }',
    '        if (entry.kind === "range" && n >= entry.min && n <= entry.max) { picked = entry.cls; break; }',
    '      }',
    '    }',
    '    // Strip any prior variant class for this binding, then add the chosen one.',
    '    var prefix = b.classPrefix;',
    '    var classes = el.className.split(/\\s+/).filter(function(c) { return c.indexOf(prefix) !== 0; });',
    '    classes.push(picked);',
    '    el.className = classes.join(" ");',
    '  });',
    '};',
    '$(document).on(":passagedisplay", function() { window._tgRefreshStyleBind(); });',
  ].join('\n');
}

/**
 * Build scoped CSS for a live dialogue preview inside the editor (CharacterModal).
 * Mirrors the export output so the modal preview matches the finished story exactly,
 * including any raw CSS the user adds.
 *
 * @param scopeClass — unique class applied to the preview's `.dialogue` element
 * @param char       — character with the live (unsaved) form state
 * @param variantIdx — bound-mode variant index: 0..N-1 for mapping entries, -1 for default,
 *                     undefined when mode is static
 */
export function buildDialogueLivePreviewCss(
  scopeClass: string,
  char: Character,
  variantIdx?: number,
): string {
  const std = dialogueStdFields(char);
  const cs = char.customDialogueStyle;

  if (!cs?.enabled) {
    return buildDialogueRulesForScope(scopeClass, std);
  }

  if ((cs.mode ?? 'static') === 'static') {
    return buildDialogueRulesForScope(scopeClass, mergeFields(std, cs.fields), cs.rawCss);
  }

  // Bound mode
  if (variantIdx === undefined || variantIdx === -1) {
    return buildDialogueRulesForScope(scopeClass, mergeFields(std, cs.defaultFields), cs.defaultRawCss);
  }
  const entry = (cs.mapping ?? [])[variantIdx];
  if (!entry) {
    return buildDialogueRulesForScope(scopeClass, std);
  }
  return buildDialogueRulesForScope(scopeClass, mergeFields(std, entry.fields), entry.rawCss);
}

/** Returns true if the project has at least one bound style binding. */
export function hasStyleBindings(project: Project): boolean {
  for (const char of project.characters) {
    const cs = char.customDialogueStyle;
    if (cs?.enabled && (cs.mode ?? 'static') === 'bound' && cs.variableId) return true;
  }
  const defaults = project.settings.defaultBlockStyles ?? {};
  for (const type of ['button', 'link', 'function'] as const) {
    const cs = defaults[type];
    if (cs?.enabled && (cs.mode ?? 'static') === 'bound' && cs.variableId) return true;
  }
  return false;
}
