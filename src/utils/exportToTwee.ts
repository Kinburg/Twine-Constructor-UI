import type {
  Project, Block, Character, Variable, ConditionBranch,
  SidebarPanel, SidebarRow, SidebarCell, PanelStyle, TableBlock,
  Scene, ButtonBlock, LinkBlock, FunctionBlock, ButtonStyle, CellProgress, CellButton, BlockDelay, BlockTypewriter, IncludeBlock,
  ArrayAccessor, ButtonAction, CheckboxBlock, RadioBlock, CellList,
  Watcher, WatcherCondition, AudioBlock,
  VariableTreeNode, VariableGroup,
} from '../types';
import { DEFAULT_PANEL_STYLE } from '../store/projectStore';
import { flattenVariables, getVariablePath, hasLeafVariables } from './treeUtils';

// ─── Variable path helpers ────────────────────────────────────────────────────

/** Get the dot-path for a variable given the full tree. Root-level → just name, nested → group1.group2.name */
function varPath(v: Variable, nodes: VariableTreeNode[]): string {
  return getVariablePath(v.id, nodes) || v.name;
}

/** Build a JS reference for a variable path: State.variables["chars"].developer.hp */
function buildJSRef(path: string): string {
  const parts = path.split('.');
  return `State.variables[${JSON.stringify(parts[0])}]${parts.slice(1).map(p => `.${p}`).join('')}`;
}

/** Convert a variable default value to a SugarCube literal string */
export function defaultValueLiteral(v: Variable): string {
  if (v.varType === 'string') return `"${v.defaultValue}"`;
  if (v.varType === 'boolean') return v.defaultValue === 'true' ? 'true' : 'false';
  if (v.varType === 'array') return v.defaultValue || '[]';
  return v.defaultValue || '0';
}

/** Recursively build a JS object literal from a VariableGroup for StoryInit export */
export function buildObjectLiteral(group: VariableGroup, allNodes: VariableTreeNode[]): string {
  const entries = group.children
    .map(n => {
      if (n.kind === 'variable') return `${n.name}: ${defaultValueLiteral(n)}`;
      if (n.kind === 'group' && hasLeafVariables(n)) return `${n.name}: ${buildObjectLiteral(n, allNodes)}`;
      return null;
    })
    .filter(Boolean);
  return `{ ${entries.join(', ')} }`;
}

// ─── Block → SugarCube markup ─────────────────────────────────────────────

/** Escape a string for safe use inside an HTML double-quoted attribute value. */
function htmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Build the SugarCube variable reference string including array accessor. */
function varRefWithAccessor(path: string, accessor: ArrayAccessor | undefined, vars: Variable[], nodes: VariableTreeNode[]): string {
  if (!accessor || accessor.kind === 'whole') return `$${path}`;
  if (accessor.kind === 'length') return `$${path}.length`;
  if (accessor.kind === 'index') {
    const src = accessor.source;
    if (src.kind === 'literal') return `$${path}[${src.index}]`;
    const idxVar = vars.find(v => v.id === src.variableId);
    return `$${path}[${idxVar ? `$${varPath(idxVar, nodes)}` : '0'}]`;
  }
  return `$${path}`;
}

/** Convert a single ButtonAction to SugarCube macro, handling array operators. */
function actionToSC(a: ButtonAction, vars: Variable[], nodes: VariableTreeNode[], lineIndent: string): string {
  if (a.type === 'open-popup') {
    const name = a.targetSceneId || '???';
    const title = a.title ?? '';
    return `${lineIndent}<<run Dialog.setup("${title}"); Dialog.wiki(Story.get("${name}").processText()); Dialog.open();>>`;
  }
  const v = vars.find(x => x.id === a.variableId);
  if (!v) return '';
  const path = varPath(v, nodes);

  if (v.varType === 'array') {
    const accessorKind = a.accessor?.kind ?? 'whole';
    if (accessorKind === 'index') {
      const ref = varRefWithAccessor(path, a.accessor, vars, nodes);
      return `${lineIndent}<<set ${ref} to "${a.value}">>`;
    }
    switch (a.operator) {
      case 'push':   return `${lineIndent}<<run $${path}.push("${a.value}")>>`;
      case 'remove': return `${lineIndent}<<run $${path}.deleteWith(function(x){return x==="${a.value}";})>>`;
      case 'clear':  return `${lineIndent}<<set $${path} to []>>`;
      default:       return `${lineIndent}<<set $${path} to ${a.value}>>`;
    }
  }

  let val = a.value;
  if (v.varType === 'string') val = `"${val}"`;
  if (a.operator === '=') return `${lineIndent}<<set $${path} to ${val}>>`;
  return `${lineIndent}<<set $${path} ${a.operator} ${val}>>`;
}

/** Wrap block output with <<timed>> delay and/or <<type>> typewriter effect. */
function wrapBlockEffects(
  content: string,
  delay: BlockDelay | undefined,
  typewriter: BlockTypewriter | undefined,
  indent: string,
  blockId?: string,
): string {
  if (!content) return content;
  let result = content;

  // Typewriter (inner wrapper — applied first, closest to content)
  if (typewriter?.speed && typewriter.speed > 0) {
    result = `<<type ${typewriter.speed}ms>>${result}<</type>>`;
  }

  // Delay + optional entrance animation (outer wrapper)
  if (delay?.delay && delay.delay > 0) {
    if (delay.animation && blockId) {
      const dur          = delay.animDuration ?? 0.4;
      const ox           = delay.animOffsetX ?? 0;
      const oy           = delay.animOffsetY ?? 0;
      const useFade      = delay.animFade !== false; // default true
      const hasTransform = ox !== 0 || oy !== 0;

      // Skip wrapping if nothing would actually animate
      if (useFade || hasTransform) {
        // CSS transitions + setTimeout(16ms): insert element in initial state, then one frame
        // later JS sets the final state so the transition fires.  CSS @keyframe animations on
        // DOM-inserted elements are unreliable inside SugarCube's <<timed>> macro.
        const uid = `tg${blockId.replace(/-/g, '').substring(0, 10)}`;
        const txParts = [ox !== 0 ? `translateX(${ox}px)` : '', oy !== 0 ? `translateY(${oy}px)` : ''].filter(Boolean);
        const initTransform = txParts.join(' ');
        const transitionParts = [
          useFade      ? `opacity ${dur}s ease-out`   : '',
          hasTransform ? `transform ${dur}s ease-out` : '',
        ].filter(Boolean);
        const initStyle = [
          useFade      ? 'opacity:0'                      : '',
          hasTransform ? `transform:${initTransform}`     : '',
          `transition:${transitionParts.join(',')}`,
        ].filter(Boolean).join(';') + ';';
        const finalParts = [
          useFade      ? `e.style.opacity='1'`      : '',
          hasTransform ? `e.style.transform='none'` : '',
        ].filter(Boolean).join(';');
        const script = `<<script>>setTimeout(function(){var e=document.getElementById('${uid}');if(e){${finalParts};}},16);<</script>>`;
        result = `<div id="${uid}" style="${initStyle}">${result}</div>${script}`;
      }
    }
    result = `${indent}<<timed ${delay.delay}s>>${result}<</timed>>`;
  }

  return result;
}

export function blockToSC(block: Block, chars: Character[], vars: Variable[], nodes: VariableTreeNode[], indent = ''): string {
  const raw = blockToSCInner(block, chars, vars, nodes, indent);
  if (!raw || block.type === 'condition' || block.type === 'note') return raw;
  const b = block as { delay?: BlockDelay; typewriter?: BlockTypewriter };
  return wrapBlockEffects(raw, b.delay, b.typewriter, indent, block.id);
}

function blockToSCInner(block: Block, chars: Character[], vars: Variable[], nodes: VariableTreeNode[], indent = ''): string {
  switch (block.type) {
    case 'text':
      if (block.live) {
        const attr = htmlAttr(block.content);
        return `${indent}<span class="tg-live" data-wiki="${attr}">${block.content}</span>`;
      }
      return indent + block.content;

    case 'dialogue': {
      const char = chars.find(c => c.id === block.characterId);
      const charClass = char ? `char-${char.id}` : 'char-unknown';
      const alignClass = block.align === 'right' ? 'dlg-right' : 'dlg-left';

      // Use runtime $name variable if available, otherwise fall back to static name
      const nameVarId = char?.varIds?.nameVarId;
      const nameVar = nameVarId ? vars.find(v => v.id === nameVarId) : null;
      const baseName = nameVar ? `<<print $${varPath(nameVar, nodes)}>>` : (char?.name ?? 'Unknown');
      const charNameDisplay = block.nameSuffix
        ? `${baseName} (${block.nameSuffix})`
        : baseName;

      // Avatar HTML — static mode or variable-bound mode
      const avatarVarId = char?.varIds?.avatarVarId;
      const avatarVar = avatarVarId ? vars.find(v => v.id === avatarVarId) : null;
      const cfg = char?.avatarConfig;

      let avatarHtml = '';
      if (cfg?.mode === 'bound' && cfg.variableId) {
        // Bound mode: generate <<if>>...<<elseif>>...<<else>>...<</if>> chain
        const boundVar = vars.find(v => v.id === cfg.variableId);
        const vname = boundVar ? `$${varPath(boundVar, nodes)}` : '$???';
        const imgTag = (src: string) => `<img class="char-avatar" src="${src}">`;
        const cases = cfg.mapping.map((m, i) => {
          const kw = i === 0 ? '<<if' : '<<elseif';
          const mt = m.matchType ?? 'exact';
          let cond: string;
          if (mt === 'range') {
            const lo = m.rangeMin ?? '0';
            const hi = m.rangeMax ?? '0';
            cond = `${vname} >= ${lo} && ${vname} <= ${hi}`;
          } else {
            const val = boundVar?.varType === 'string' ? `"${m.value}"` : m.value;
            cond = `${vname} eq ${val}`;
          }
          return `${kw} ${cond}>>${imgTag(m.src)}`;
        });
        if (cfg.defaultSrc) cases.push(`<<else>>${imgTag(cfg.defaultSrc)}`);
        if (cases.length > 0) cases.push('<</if>>');
        avatarHtml = cases.join('');
      } else if (cfg?.mode === 'static' && cfg.src) {
        // Static mode: fixed image path
        avatarHtml = `<img class="char-avatar" src="${cfg.src}">`;
      } else if (avatarVar) {
        // Legacy: avatar stored in a $variable
        avatarHtml = `<<if $${varPath(avatarVar, nodes)}>><img class="char-avatar" @src="$${varPath(avatarVar, nodes)}"><</if>>`;
      }

      // Inner blocks rendered inside the dialogue bubble after the main text
      const innerBlocksHtml = (block.innerBlocks ?? [])
        .map(b => blockToSC(b, chars, vars, nodes, ''))
        .filter(Boolean)
        .join('');

      // ── Color variables: use runtime $vars so color changes reflect immediately ─
      // Inline @style overrides static CSS and is re-evaluated on every render.
      const bgColorVar     = char?.varIds?.bgColorVarId
        ? vars.find(v => v.id === char!.varIds!.bgColorVarId)    : null;
      const borderColorVar = char?.varIds?.borderColorVarId
        ? vars.find(v => v.id === char!.varIds!.borderColorVarId) : null;
      const nameColorVar   = char?.varIds?.nameColorVarId
        ? vars.find(v => v.id === char!.varIds!.nameColorVarId)   : null;
      const textColorVar   = char?.varIds?.textColorVarId
        ? vars.find(v => v.id === char!.varIds!.textColorVarId)   : null;
      // Fallback to static value (quoted string literal) when variable not found
      const bgExpr       = bgColorVar     ? `$${varPath(bgColorVar, nodes)}`     : `'${char?.bgColor     ?? '#23262e'}'`;
      const borderExpr   = borderColorVar ? `$${varPath(borderColorVar, nodes)}` : `'${char?.borderColor  ?? '#4a90d9'}'`;
      const nameExpr     = nameColorVar   ? `$${varPath(nameColorVar, nodes)}`   : `'${char?.nameColor    ?? '#e0e0e0'}'`;
      const textExpr     = textColorVar   ? `$${varPath(textColorVar, nodes)}`   : `'${char?.textColor    ?? '#e2e8f0'}'`;
      // Border side switches with alignment; explicitly reset the opposite side
      const borderDir     = block.align === 'right' ? 'right' : 'left';
      const borderAntiDir = block.align === 'right' ? 'left'  : 'right';
      const bodyStyleExpr = `'background:'+${bgExpr}+';border-${borderDir}:4px solid '+${borderExpr}+';border-${borderAntiDir}:none'`;
      const nameStyleExpr = block.align === 'right'
        ? `'text-align:right;color:'+${nameExpr}`
        : `'color:'+${nameExpr}`;
      const textStyleExpr = `'color:'+${textExpr}`;
      const body = `<div class="char-body" @style="${bodyStyleExpr}"><span class="char-name" @style="${nameStyleExpr}">${charNameDisplay}</span><span class="char-text" @style="${textStyleExpr}">${block.text}</span>${innerBlocksHtml}</div>`;
      // Avatar always comes first in DOM for BOTH alignments.
      // CSS `.dlg-right { flex-direction: row-reverse }` flips the visual order for right-aligned dialogues,
      // placing the avatar on the right side without changing the DOM order.
      const inner = avatarHtml + body;

      const divContent = `<div class="dialogue ${charClass} ${alignClass}">${inner}</div>`;
      if (block.live) {
        const attr = htmlAttr(divContent);
        return `${indent}<span class="tg-live" data-wiki="${attr}">${divContent}</span>`;
      }
      return `${indent}${divContent}`;
    }

    case 'choice': {
      if (block.options.length === 0) return '';
      const lines = block.options.map(opt => {
        const cond = opt.condition.trim();
        const link = `<<link "${opt.label}" "${opt.targetSceneId || 'Start'}">><</link>>`;
        if (cond) return `${indent}<<if ${cond}>>${link}<</if>>`;
        return `${indent}${link}`;
      });
      return lines.join('\n');
    }

    case 'condition': {
      if (block.branches.length === 0) return '';
      return block.branches
        .map((branch, i) => branchToSC(branch, chars, vars, nodes, indent, i === 0))
        .join('\n') + `\n${indent}<</if>>`;
    }

    case 'variable-set': {
      const v = vars.find(x => x.id === block.variableId);
      if (!v) return `${indent}/* variable not found */`;
      const path = varPath(v, nodes);

      // ── Array type — special operators ──────────────────────────────────────
      if (v.varType === 'array') {
        const accessorKind = block.accessor?.kind ?? 'whole';
        if (accessorKind === 'index') {
          const ref = varRefWithAccessor(path, block.accessor, vars, nodes);
          return `${indent}<<set ${ref} to "${block.value}">>`;
        }
        switch (block.operator) {
          case 'push':   return `${indent}<<run $${path}.push("${block.value}")>>`;
          case 'remove': return `${indent}<<run $${path}.deleteWith(function(x){return x==="${block.value}";})>>`;
          case 'clear':  return `${indent}<<set $${path} to []>>`;
          case '=':      return `${indent}<<set $${path} to ${block.value}>>`;
          default:       return `${indent}<<set $${path} to ${block.value}>>`;
        }
      }

      // Effective mode — backward compat with old randomize boolean
      const mode = block.valueMode ?? (block.randomize ? 'random' : 'manual');

      // ── Expression mode (numbers) ────────────────────────────────────────────
      if (mode === 'expression' && block.expression) {
        if (block.operator === '=') return `${indent}<<set $${path} to ${block.expression}>>`;
        return `${indent}<<set $${path} ${block.operator} ${block.expression}>>`;
      }

      // ── Dynamic mode (strings) — if/elseif/else chain ────────────────────────
      if (mode === 'dynamic' && block.dynamicMapping && block.dynamicMapping.length > 0) {
        const cv     = vars.find(x => x.id === block.dynamicVariableId);
        const cvName = cv ? `$${varPath(cv, nodes)}` : '$???';

        const cases = block.dynamicMapping.map((m, i) => {
          const kw = i === 0 ? '<<if' : '<<elseif';
          const mt = m.matchType ?? 'exact';
          let cond: string;
          if (mt === 'range') {
            cond = `${cvName} >= ${m.rangeMin ?? '0'} && ${cvName} <= ${m.rangeMax ?? '0'}`;
          } else {
            const val = cv?.varType === 'string' ? `"${m.value}"` : m.value;
            cond = `${cvName} eq ${val}`;
          }
          return `${indent}${kw} ${cond}>><<set $${path} to "${m.result}">>`;
        });

        if (block.dynamicDefault !== undefined) {
          cases.push(`${indent}<<else>><<set $${path} to "${block.dynamicDefault}">>`);
        }
        cases.push(`${indent}<</if>>`);
        return cases.join('\n');
      }

      // ── Random value ────────────────────────────────────────────────────────
      if (mode === 'random' && block.randomConfig) {
        const cfg = block.randomConfig;
        switch (cfg.kind) {
          case 'number': {
            const expr = `random(${cfg.min}, ${cfg.max})`;
            // Respect the chosen operator — e.g. $hp -= random(10, 15)
            if (block.operator === '=') return `${indent}<<set $${path} to ${expr}>>`;
            return `${indent}<<set $${path} ${block.operator} ${expr}>>`;
          }
          case 'boolean':
            return `${indent}<<set $${path} to either(true, false)>>`;
          case 'string': {
            const len = Math.max(1, cfg.length);
            const expr = `Array(${len}).fill(0).map(()=>"abcdefghijklmnopqrstuvwxyz0123456789".charAt(random(0,35))).join("")`;
            return `${indent}<<set $${path} to ${expr}>>`;
          }
        }
      }

      // ── Manual value ────────────────────────────────────────────────────────
      let val = block.value;
      if (v.varType === 'string') val = `"${val}"`;
      if (block.operator === '=') return `${indent}<<set $${path} to ${val}>>`;
      return `${indent}<<set $${path} ${block.operator} ${val}>>`;
    }

    case 'image': {
      const w   = block.width > 0 ? ` width="${block.width}"` : '';
      const alt = block.alt ? ` alt="${block.alt}"` : '';
      const imgTag = (src: string) => `<img src="${src}"${alt}${w} />`;
      const mode = block.mode ?? 'static';

      // ── Bound mode: <<if>>…<<elseif>>…<<else>>…<</if>> chain ────────────
      if (mode === 'bound' && block.mapping && block.mapping.length > 0) {
        const bv = vars.find(x => x.id === block.variableId);
        const vname = bv ? `$${varPath(bv, nodes)}` : '$???';

        const cases = block.mapping.map((m, i) => {
          const kw = i === 0 ? '<<if' : '<<elseif';
          const mt = m.matchType ?? 'exact';
          let cond: string;
          if (mt === 'range') {
            cond = `${vname} >= ${m.rangeMin ?? '0'} && ${vname} <= ${m.rangeMax ?? '0'}`;
          } else {
            const val = bv?.varType === 'string' ? `"${m.value}"` : m.value;
            cond = `${vname} eq ${val}`;
          }
          return `${indent}${kw} ${cond}>>${imgTag(m.src)}`;
        });

        if (block.defaultSrc) cases.push(`${indent}<<else>>${imgTag(block.defaultSrc)}`);
        cases.push(`${indent}<</if>>`);
        return cases.join('\n');
      }

      // ── Static mode ──────────────────────────────────────────────────────
      return `${indent}${imgTag(block.src)}`;
    }

    case 'video': {
      const attrs = [
        block.controls ? 'controls' : '',
        block.autoplay ? 'autoplay' : '',
        block.loop ? 'loop' : '',
        block.width > 0 ? `width="${block.width}"` : '',
      ].filter(Boolean).join(' ');
      return `${indent}<video src="${block.src}"${attrs ? ' ' + attrs : ''}></video>`;
    }

    case 'input-field': {
      const v = vars.find(x => x.id === block.variableId);
      if (!v) return `${indent}/* variable not found */`;
      const path = varPath(v, nodes);
      const vname = `$${path}`;
      // numberbox for numeric variables, textbox for everything else
      const macro = v.varType === 'number' ? 'numberbox' : 'textbox';
      // Use the current variable value as the textbox default so the field
      // keeps whatever the player typed if the passage is re-rendered (Engine.show).
      // $varname evaluates to its StoryInit default on first load, and to the
      // player's input on subsequent re-renders.
      const defVal = `$${path}`;
      const lines: string[] = [];
      if (block.label) lines.push(`${indent}${block.label}`);
      lines.push(`${indent}<<${macro} "${vname}" ${defVal}>>`);
      return lines.join('\n');
    }

    case 'raw':
      if (!block.code) return '';
      return block.code.split('\n').map(line => `${indent}${line}`).join('\n');

    case 'include': {
      const name = (block as IncludeBlock).passageName.trim();
      if (!name) return '';

      const include = `<<include "${name}">>`;

      const styles: string[] = [];
      if (block.maxWidth && block.maxWidth > 0)
        styles.push(`max-width:${block.maxWidth}px`);
      if (block.bordered) {
        const bw = block.borderWidth ?? 1;
        const bc = block.borderColor ?? '#555555';
        const br = block.borderRadius ?? 0;
        styles.push(`border:${bw}px solid ${bc}`);
        if (br > 0) styles.push(`border-radius:${br}px`);
      }
      if (block.padding && block.padding > 0)
        styles.push(`padding:${block.padding}px`);
      if (block.bgColor)
        styles.push(`background-color:${block.bgColor}`);

      if (styles.length === 0) return `${indent}${include}`;
      return `${indent}<div style="${styles.join(';')}">${include}</div>`;
    }

    case 'divider': {
      const color     = block.color     ?? '#555555';
      const thickness = block.thickness ?? 1;
      const marginV   = block.marginV   ?? 8;
      return `${indent}<hr style="border:none;border-top:${thickness}px solid ${color};margin:${marginV}px 0;">`;
    }

    case 'note':
      // Developer note — never exported
      return '';

    case 'table':
      return tableBlockToSC(block, vars, nodes, indent);

    case 'button': {
      const cls = `tg-btn-${block.id.replace(/-/g, '').substring(0, 12)}`;
      const actionLines = block.actions
        .map(a => actionToSC(a, vars, nodes, `${indent}  `))
        .filter(Boolean);
      if (block.refreshScene) {
        actionLines.push(`${indent}  <<run Engine.show()>>`);
      } else {
        actionLines.push(`${indent}  <<run $('.tg-live[data-wiki]').each(function(){$(this).empty().wiki($(this).attr('data-wiki'));})>>`);
      }
      actionLines.push(`${indent}  <<run window._tgCheckWatchers && window._tgCheckWatchers()>>`);
      actionLines.push(`${indent}  <<run UIBar.update()>>`);
      return (
        `${indent}<span class="tg-btn ${cls}">` +
        `<<link "${block.label}">>\n` +
        actionLines.join('\n') + '\n' +
        `${indent}<</link>></span>`
      );
    }

    case 'link': {
      const cls = `tg-btn-${block.id.replace(/-/g, '').substring(0, 12)}`;
      const actionLines = block.actions
        .map(a => actionToSC(a, vars, nodes, `${indent}  `))
        .filter(Boolean);
      // targetSceneId stores the scene NAME (same convention as ChoiceOption.targetSceneId)
      if (block.target === 'back') {
        actionLines.push(`${indent}  <<run Engine.backward()>>`);
      } else {
        actionLines.push(`${indent}  <<goto "${block.targetSceneId ?? ''}">>`);
      }
      actionLines.push(`${indent}  <<run UIBar.update()>>`);
      return (
        `${indent}<span class="tg-btn ${cls}"><<link "${block.label}">>\n` +
        actionLines.join('\n') + '\n' +
        `${indent}<</link>></span>`
      );
    }

    case 'function': {
      const cls = `tg-btn-${block.id.replace(/-/g, '').substring(0, 12)}`;
      const actionLines = block.actions
        .map(a => actionToSC(a, vars, nodes, `${indent}  `))
        .filter(Boolean);
      const sceneName = block.targetSceneId || '???';
      actionLines.push(`${indent}  <<include "${sceneName}">>`);
      actionLines.push(`${indent}  <<run $('.tg-live[data-wiki]').each(function(){$(this).empty().wiki($(this).attr('data-wiki'));})>>`);
      actionLines.push(`${indent}  <<run window._tgCheckWatchers && window._tgCheckWatchers()>>`);
      actionLines.push(`${indent}  <<run UIBar.update()>>`);
      return (
        `${indent}<span class="tg-btn ${cls}"><<link "${block.label}">>\n` +
        actionLines.join('\n') + '\n' +
        `${indent}<</link>></span>`
      );
    }

    case 'checkbox': {
      const cb = block as CheckboxBlock;
      if (cb.options.length === 0) return '';
      const lines: string[] = [];
      if (cb.label) lines.push(`${indent}${cb.label}`);

      if (cb.mode === 'flags') {
        // Each option toggles its own boolean variable
        for (const opt of cb.options) {
          const v = vars.find(x => x.id === opt.variableId);
          const vname = v ? `$${varPath(v, nodes)}` : '$???';
          lines.push(`${indent}<<checkbox "${vname}" false true autocheck>> ${opt.label}`);
        }
      } else {
        // Array mode: plain HTML checkboxes + script sets initial state and attaches handlers
        const arrVar = vars.find(x => x.id === cb.variableId);
        const arrPath = arrVar ? varPath(arrVar, nodes) : '???';
        const uid = `tgcb_${cb.id.replace(/-/g, '').substring(0, 10)}`;
        const inputLines = cb.options.map((opt, i) => {
          const optId = `${uid}_${i}`;
          return `<input id="${optId}" type="checkbox"> <label for="${optId}">${opt.label}</label>`;
        });
        lines.push(`${indent}<span id="${uid}">${inputLines.join('<br>')}</span>`);
        const handlers = cb.options.map((opt, i) => {
          const optId = `${uid}_${i}`;
          const val = (opt.value ?? '').replace(/"/g, '\\"');
          return (
            `var e${i}=document.getElementById('${optId}');` +
            `if(e${i}){` +
            `e${i}.checked=State.variables.${arrPath}.includes("${val}");` +
            `e${i}.addEventListener('change',function(){` +
            `if(this.checked){State.variables.${arrPath}.push("${val}");}` +
            `else{State.variables.${arrPath}.deleteWith(function(x){return x==="${val}";});}});}`
          );
        }).join('');
        lines.push(`${indent}<<script>>setTimeout(function(){${handlers}},0);<</script>>`);
      }
      return lines.join('\n');
    }

    case 'radio': {
      const rb = block as RadioBlock;
      if (rb.options.length === 0) return '';
      const v = vars.find(x => x.id === rb.variableId);
      const vname = v ? `$${varPath(v, nodes)}` : '$???';
      const lines: string[] = [];
      if (rb.label) lines.push(`${indent}${rb.label}`);
      for (const opt of rb.options) {
        lines.push(`${indent}<<radiobutton "${vname}" "${opt.value}" autocheck>> ${opt.label}`);
      }
      return lines.join('\n');
    }

    case 'popup': {
      const name = block.targetSceneId || '???';
      const title = block.title ?? '';
      return `${indent}<<run Dialog.setup("${title}"); Dialog.wiki(Story.get("${name}").processText()); Dialog.open();>>`;
    }

    case 'audio': {
      const ab = block as AudioBlock;
      const trackId = `tga_${ab.id.replace(/-/g, '')}`;
      const vol = Math.round(ab.volume) / 100;

      const stopAllMacro = ab.stopOthers ? `<<audio ":all" stop>>` : '';

      // No source — only stop others (if requested), nothing to play.
      if (!ab.src) {
        return stopAllMacro ? `${indent}${stopAllMacro}` : '';
      }

      const parts: string[] = [];
      if (vol !== 1) parts.push(`volume ${vol}`);
      if (ab.loop) parts.push('loop');
      parts.push('play');
      const audioMacro = `<<audio "${trackId}" ${parts.join(' ')}>>`;

      // Trigger
      if (ab.trigger === 'delay' && ab.triggerDelay && ab.triggerDelay > 0) {
        // stopOthers fires immediately; the new audio starts after the delay.
        // Use cancellable setTimeout instead of <<timed>> so navigation away
        // before the delay fires won't still start the audio on a different scene.
        const ms = Math.round(ab.triggerDelay * 1000);
        const chain = [
          vol !== 1 ? `.volume(${vol})` : '',
          ab.loop ? '.loop(true)' : '',
          '.play()',
        ].join('');
        const jsPlay = `var _tr=SugarCube.SimpleAudio.tracks.get("${trackId}");if(_tr){_tr${chain};}`;
        const jsTimer = `(window._tgDA=window._tgDA||[]).push(setTimeout(function(){${jsPlay}},${ms}));`;
        const timerMacro = `<<script>>${jsTimer}<</script>>`;
        return stopAllMacro
          ? `${indent}${stopAllMacro}\n${indent}${timerMacro}`
          : `${indent}${timerMacro}`;
      }

      return stopAllMacro
        ? `${indent}${stopAllMacro}\n${indent}${audioMacro}`
        : `${indent}${audioMacro}`;
    }
  }
}

function branchToSC(
  branch: ConditionBranch,
  chars: Character[],
  vars: Variable[],
  nodes: VariableTreeNode[],
  indent: string,
  isFirst: boolean,
): string {
  const innerLines = branch.blocks
    .map(b => blockToSC(b, chars, vars, nodes, indent + '  '))
    .join('\n');

  if (branch.branchType === 'else') {
    return `${indent}<<else>>\n${innerLines}`;
  }

  const v = vars.find(x => x.id === branch.variableId);
  const vPath = v ? varPath(v, nodes) : 'unknown';
  const varName = `$${vPath}`;
  const acc = branch.accessor;
  const accessorKind = acc?.kind ?? 'whole';

  let expr: string;
  if (branch.rangeMode) {
    const ref = (v?.varType === 'array' && accessorKind === 'length') ? `${varName}.length` : varName;
    const lo = branch.rangeMin ?? '0';
    const hi = branch.rangeMax ?? '0';
    expr = `${ref} >= ${lo} && ${ref} <= ${hi}`;
  } else if (v?.varType === 'array' && accessorKind === 'whole') {
    switch (branch.operator) {
      case 'contains':  expr = `${varName}.includes("${branch.value}")`; break;
      case '!contains': expr = `!${varName}.includes("${branch.value}")`; break;
      case 'empty':     expr = `${varName}.length === 0`; break;
      case '!empty':    expr = `${varName}.length > 0`; break;
      default: {
        const val = branch.value;
        expr = `${varName} ${branch.operator} ${val}`;
      }
    }
  } else if (v?.varType === 'array' && accessorKind === 'index') {
    const ref = varRefWithAccessor(vPath, acc, vars, nodes);
    expr = `${ref} ${branch.operator} "${branch.value}"`;
  } else if (v?.varType === 'array' && accessorKind === 'length') {
    expr = `${varName}.length ${branch.operator} ${branch.value}`;
  } else {
    let val = branch.value;
    if (v?.varType === 'string') val = `"${val}"`;
    expr = `${varName} ${branch.operator} ${val}`;
  }

  if (branch.branchType === 'if' || isFirst) {
    return `${indent}<<if ${expr}>>\n${innerLines}`;
  }
  return `${indent}<<elseif ${expr}>>\n${innerLines}`;
}

// ─── Progress bar → SugarCube markup ─────────────────────────────────────────
//
// Uses pure TwineScript: <<set _tgP to ...>> stores the percentage, then
// <<print '...' + _tgP + '...'>> outputs the HTML string inline.
// TwineScript supports Math.min/max/round, $story vars, _temp vars, and +.
// It does NOT support `function`, `var`, `return`, or IIFEs.
// <<script>>output.wiki()<</script>> also fails — `output` is a plain DOM node.

function buildProgressBarSC(c: CellProgress, vars: Variable[], nodes: VariableTreeNode[], forTable: boolean): string {
  const v = vars.find(x => x.id === c.variableId);
  const vname = v ? varPath(v, nodes) : '???';
  const sv = `$${vname}`;  // TwineScript story variable
  const emptyColor = c.emptyColor ?? '#333';
  const textColorCSS = c.textColor ? `color:${c.textColor};` : '';

  // Percentage stored in TwineScript temp var _tgP
  const setPct = `<<set _tgP to Math.min(100,Math.max(0,${sv}/${c.maxValue}*100))>>`;

  // Fill color — either a literal or interpolated into _tgC
  let setColor = '';
  let colorRef: string;
  const cr = c.colorRange;
  if (cr?.from && cr?.to && /^#[0-9a-fA-F]{6}$/.test(cr.from) && /^#[0-9a-fA-F]{6}$/.test(cr.to)) {
    const fr = parseInt(cr.from.slice(1, 3), 16), fg = parseInt(cr.from.slice(3, 5), 16), fb = parseInt(cr.from.slice(5, 7), 16);
    const tr = parseInt(cr.to.slice(1, 3), 16),   tg = parseInt(cr.to.slice(3, 5), 16),   tb = parseInt(cr.to.slice(5, 7), 16);
    setColor = `<<set _tgC to 'rgb('+Math.round(${fr}+(${tr-fr})*_tgP/100)+','+Math.round(${fg}+(${tg-fg})*_tgP/100)+','+Math.round(${fb}+(${tb-fb})*_tgP/100)+')'>>`;
    colorRef = '_tgC';
  } else {
    colorRef = `'${c.color}'`;
  }

  // Text label (raw variable value / maxValue)
  const textRef = c.showText ? `${sv}+'/${c.maxValue}'` : "''";
  const vert = c.vertical ?? false;

  if (forTable) {
    // Table cells use fully inline styles (no CSS class deps)
    const printExpr = vert
      ? `'<span style="width:100%;height:100%;background:${emptyColor};border-radius:2px;overflow:hidden;display:flex;flex-direction:column-reverse;align-items:stretch;">'` +
        `+'<span style="height:'+_tgP+'%;width:100%;background:'+${colorRef}+';display:flex;align-items:center;justify-content:center;font-size:0.75em;${textColorCSS}">'+${textRef}+'</span></span>'`
      : `'<span style="width:100%;height:100%;background:${emptyColor};border-radius:2px;overflow:hidden;display:flex;align-items:center;">'` +
        `+'<span style="width:'+_tgP+'%;background:'+${colorRef}+';height:100%;display:flex;align-items:center;justify-content:center;font-size:0.75em;${textColorCSS}">'+${textRef}+'</span></span>'`;
    return `${setPct}${setColor}<<print ${printExpr}>>`;
  } else {
    // StoryCaption: use CSS classes (.tg-progress / .tg-bar), override bg via inline style
    const printExpr = vert
      ? `'<span class="tg-progress" style="background:${emptyColor};flex-direction:column-reverse;align-items:stretch;">'` +
        `+'<span class="tg-bar" style="height:'+_tgP+'%;width:100%;background:'+${colorRef}+';${textColorCSS}">'+${textRef}+'</span></span>'`
      : `'<span class="tg-progress" style="background:${emptyColor};">'` +
        `+'<span class="tg-bar" style="width:'+_tgP+'%;background:'+${colorRef}+';${textColorCSS}">'+${textRef}+'</span></span>'`;
    return `${setPct}${setColor}<<print ${printExpr}>>`;
  }
}

// ─── Cell button: <<link>> (behavior) + inline <<script>> (styles on <a>) ─────

/** Builds an inline style string for a CellButton. */
function buildCellBtnStyleStr(s: ButtonStyle): string {
  return [
    `background:${s.bgColor}`,
    `color:${s.textColor}`,
    `border:1px solid ${s.borderColor}`,
    `border-radius:${s.borderRadius}px`,
    `padding:${s.paddingV}px ${s.paddingH}px`,
    `font-size:${(s.fontSize / 10).toFixed(1)}em`,
    `text-decoration:none`,
    s.bold ? 'font-weight:bold' : '',
    s.fullWidth
      ? 'display:block;width:100%;text-align:center;box-sizing:border-box'
      : 'display:inline-block',
    'cursor:pointer',
    'transition:filter 0.15s',
  ].filter(Boolean).join(';');
}

/**
 * Generates <<link>> for a CellButton.
 * Behavior via SugarCube macros; inline styles applied immediately via <<script>>+setTimeout
 * so they override any SugarCube CSS regardless of specificity.
 */
function buildCellButtonSC(c: CellButton, cellId: string, vars: Variable[], nodes: VariableTreeNode[]): string {
  const domId = `tgcb${cellId.replace(/-/g, '').substring(0, 12)}`;
  const styleStr = buildCellBtnStyleStr(c.style);

  const macros: string[] = c.actions
    .map(a => actionToSC(a, vars, nodes, ''))
    .filter(Boolean);

  macros.push('<<run window._tgCheckWatchers && window._tgCheckWatchers()>>');

  if (c.navigate?.type === 'back') {
    macros.push('<<run Engine.backward()>>');
  } else if (c.navigate?.type === 'scene' && c.navigate.sceneId) {
    macros.push(`<<goto "${c.navigate.sceneId}">>`);
  }

  const label = c.label || '';
  const esc = styleStr.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  // <<script>> runs during passage render; setTimeout(fn,0) defers until <a> is in DOM
  const script =
    `<<script>>setTimeout(function(){` +
    `var e=document.getElementById('${domId}');` +
    `if(e){var a=e.querySelector('a');` +
    `if(a){a.style.cssText='${esc}';` +
    `a.onmouseenter=function(){a.style.filter='brightness(1.2)';};` +
    `a.onmouseleave=function(){a.style.filter='';};}}` +
    `},0);<</script>>`;

  return (
    `<span id="${domId}"><<link "${label}">>${macros.join('')}<</link>></span>` +
    script
  );
}

// ─── Cell list (array) ────────────────────────────────────────────────────────

function buildCellListSC(c: CellList, vars: Variable[], nodes: VariableTreeNode[]): string {
  const v = vars.find(x => x.id === c.variableId);
  const vname = v ? `$${varPath(v, nodes)}` : '$???';
  const sep = (c.separator || ', ').replace(/"/g, '\\"');
  const inner = `${c.prefix}<<print ${vname}.join("${sep}")>>${c.suffix}`;
  if (c.emptyText) {
    return `<<if ${vname}.length gt 0>>${inner}<<else>>${c.emptyText}<</if>>`;
  }
  return inner;
}

// ─── Table block → inline HTML (fully self-contained, no class deps) ──────────

function tableCellInnerToSC(cell: SidebarCell, vars: Variable[], nodes: VariableTreeNode[]): string {
  const c = cell.content;
  switch (c.type) {
    case 'text': return c.value;

    case 'variable': {
      const v = vars.find(x => x.id === c.variableId);
      const vname = v ? `$${varPath(v, nodes)}` : '$???';
      return `${c.prefix}<<print ${vname}>>${c.suffix}`;
    }

    case 'progress':
      return buildProgressBarSC(c, vars, nodes, true);

    case 'image-static':
      return `<img src="${c.src}" style="width:100%;height:100%;display:block;object-fit:${c.objectFit};" />`;

    case 'image-bound': {
      const v = vars.find(x => x.id === c.variableId);
      const vname = v ? `$${varPath(v, nodes)}` : '$???';
      const imgTag = (src: string) =>
        `<img src="${src}" style="width:100%;height:100%;display:block;object-fit:${c.objectFit};" />`;
      const cases = c.mapping.map((m, i) => {
        const kw = i === 0 ? '<<if' : '<<elseif';
        const mt = m.matchType ?? 'exact';
        let cond: string;
        if (mt === 'range') {
          cond = `${vname} >= ${m.rangeMin ?? '0'} && ${vname} <= ${m.rangeMax ?? '0'}`;
        } else {
          const val = (v?.varType === 'string') ? `"${m.value}"` : m.value;
          cond = `${vname} eq ${val}`;
        }
        return `${kw} ${cond}>>${imgTag(m.src)}`;
      });
      if (c.defaultSrc) cases.push(`<<else>>${imgTag(c.defaultSrc)}`);
      if (cases.length > 0) cases.push('<</if>>');
      return cases.join('');
    }

    case 'raw': return c.code;

    case 'button':
      return buildCellButtonSC(c, cell.id, vars, nodes);

    case 'list':
      return buildCellListSC(c as CellList, vars, nodes);

    default: return '';
  }
}

function tableBlockToSC(block: TableBlock, vars: Variable[], nodes: VariableTreeNode[], indent = ''): string {
  if (block.rows.length === 0) return '';
  const s = block.style;

  const outerParts = [
    'display:flex', 'flex-direction:column', `gap:${s.rowGap}px`, 'margin:0', 'padding:0',
  ];
  if (s.showOuterBorder) {
    outerParts.push(`border:${s.borderWidth}px solid ${s.borderColor}`, 'padding:2px');
  }

  const rowsHTML = block.rows.map(row => {
    if (row.cells.length === 0) return '';
    const rowParts = [
      'display:flex', 'overflow:hidden', 'align-items:stretch', 'margin:0',
      `height:${row.height}px`,
    ];
    if (s.showRowBorders) {
      rowParts.push(`border:${s.borderWidth}px solid ${s.borderColor}`);
    }
    const cellsHTML = row.cells.map((cell, ci) => {
      const cellParts = [
        `flex:${cell.width}`, 'display:flex', 'align-items:center', 'overflow:hidden',
        'font-size:0.85em', 'min-width:0', 'box-sizing:border-box', 'padding:2px 4px',
      ];
      if (s.showCellBorders && ci > 0) {
        cellParts.push(`border-left:${s.borderWidth}px solid ${s.borderColor}`);
      }
      return `<span style="${cellParts.join(';')}">${tableCellInnerToSC(cell, vars, nodes)}</span>`;
    }).join('');
    return `<div style="${rowParts.join(';')}">${cellsHTML}</div>`;
  }).filter(Boolean).join('');

  if (!rowsHTML) return '';
  return `${indent}<div style="${outerParts.join(';')}">${rowsHTML}</div>`;
}

// ─── Panel → StoryCaption markup ──────────────────────────────────────────────

function cellToSC(cell: SidebarCell, vars: Variable[], nodes: VariableTreeNode[]): string {
  const c = cell.content;
  // Use flex: N (proportional) so CSS gap is respected without overflow.
  // cell.width is a percentage (e.g. 40), flex: 40 gives the same 40:60 ratio.
  const flex = `flex: ${cell.width}; min-width: 0; overflow: hidden;`;
  let inner = '';

  switch (c.type) {
    case 'text':
      inner = c.value;
      break;

    case 'variable': {
      const v = vars.find(x => x.id === c.variableId);
      const vname = v ? `$${varPath(v, nodes)}` : '$???';
      inner = `${c.prefix}<<print ${vname}>>${c.suffix}`;
      break;
    }

    case 'progress':
      inner = buildProgressBarSC(c, vars, nodes, false);
      break;

    case 'image-static':
      inner = `<img class="tg-cell-img tg-lb" src="${c.src}" style="object-fit: ${c.objectFit};" onclick="tgOpenLightbox(this.src)" />`;
      break;

    case 'raw':
      inner = c.code;
      break;

    case 'image-bound': {
      const v = vars.find(x => x.id === c.variableId);
      const vname = v ? `$${varPath(v, nodes)}` : '$???';
      const imgTag = (src: string) =>
        `<img class="tg-cell-img tg-lb" src="${src}" style="object-fit: ${c.objectFit};" onclick="tgOpenLightbox(this.src)" />`;
      const cases = c.mapping.map((m, i) => {
        const kw = i === 0 ? '<<if' : '<<elseif';
        let cond: string;
        const mt = m.matchType ?? 'exact';
        if (mt === 'range') {
          const lo = m.rangeMin ?? '0';
          const hi = m.rangeMax ?? '0';
          cond = `${vname} >= ${lo} && ${vname} <= ${hi}`;
        } else {
          // exact — quote only string variables
          const val = (v?.varType === 'string') ? `"${m.value}"` : m.value;
          cond = `${vname} eq ${val}`;
        }
        return `${kw} ${cond}>>${imgTag(m.src)}`;
      });
      if (c.defaultSrc) cases.push(`<<else>>${imgTag(c.defaultSrc)}`);
      if (cases.length > 0) cases.push('<</if>>');
      inner = cases.join('');
      break;
    }

    case 'button': {
      const wrapFlex = c.style.fullWidth
        ? `${flex};display:flex;align-items:center`
        : flex;
      return `<span class="tg-cell" style="${wrapFlex}">${buildCellButtonSC(c, cell.id, vars, nodes)}</span>`;
    }

    case 'list':
      inner = buildCellListSC(c as CellList, vars, nodes);
      break;

    case 'audio-volume': {
      // Static HTML + <<script>> with setTimeout(0) to set values after DOM render.
      // This avoids quote conflicts inside <<print>>.
      const slider = '<input id="tg-vol" type="range" min="0" max="100" value="100" style="width:100%" oninput="var _v=this.value/100;SugarCube.SimpleAudio.volume(_v);SugarCube.State.variables.__tgMasterVol=_v;document.querySelectorAll(\'video\').forEach(function(el){el.volume=_v;})" />';
      const mute = c.showMuteButton
        ? '<button id="tg-mute" onclick="var S=SugarCube.SimpleAudio;S.mute(!S.mute());this.textContent=S.mute()?String.fromCodePoint(0x1F507):String.fromCodePoint(0x1F50A);document.querySelectorAll(\'video\').forEach(function(el){el.muted=S.mute();})" style="border:none;background:none;cursor:pointer;font-size:1.2em">&#x1F50A;</button>'
        : '';
      const initScript = [
        '<<script>>',
        'setTimeout(function(){',
        '  var v=State.variables.__tgMasterVol;',
        '  var s=document.getElementById("tg-vol");',
        '  if(s&&v!=null){s.value=Math.round(v*100);document.querySelectorAll("video").forEach(function(el){el.volume=v;});}',
        c.showMuteButton ? '  var m=document.getElementById("tg-mute");if(m)m.textContent=SugarCube.SimpleAudio.mute()?String.fromCodePoint(0x1F507):String.fromCodePoint(0x1F50A);' : '',
        '},0);',
        '<</script>>',
      ].filter(Boolean).join('');
      inner = `<span style="display:flex;align-items:center;gap:4px;width:100%">${mute}${slider}</span>${initScript}`;
      break;
    }
  }

  return `<span class="tg-cell" style="${flex}">${inner}</span>`;
}

function rowToSC(row: SidebarRow, vars: Variable[], nodes: VariableTreeNode[], style: PanelStyle): string {
  if (row.cells.length === 0) return '';
  const cells = row.cells.map(c => cellToSC(c, vars, nodes)).join('');
  const borderStyle = style.showCellBorders
    ? ` border: ${style.borderWidth}px solid ${style.borderColor};`
    : '';
  return `<div class="tg-row" style="height: ${row.height}px;${borderStyle}">${cells}</div>`;
}

export function buildStoryCaptionSC(panel: SidebarPanel, vars: Variable[], nodes: VariableTreeNode[]): string {
  if (panel.tabs.length === 0) return '';

  const style: PanelStyle = panel.style ?? DEFAULT_PANEL_STYLE;
  const lines: string[] = [];
  lines.push('<<if ndef $__tgTab>><<set $__tgTab to 0>><</if>>');

  if (panel.tabs.length > 1) {
    lines.push('<div class="tg-tabs">');
    panel.tabs.forEach((tab, i) => {
      lines.push(`<<link "${tab.label}">><<set $__tgTab to ${i}>><<run UIBar.update()>><</link>>`);
    });
    lines.push('</div>');
  }

  const outerOpen = style.showOuterBorder
    ? `<div class="tg-panel" style="border: ${style.borderWidth}px solid ${style.borderColor}; padding: 2px;">`
    : '<div class="tg-panel">';

  panel.tabs.forEach((tab, i) => {
    const kw = i === 0 ? '<<if' : '<<elseif';
    lines.push(`${kw} $__tgTab eq ${i}>>`);
    // Concatenate rows WITHOUT \n between them — SugarCube's wiki parser converts
    // \n between block-level elements into <p></p> tags (adding 1em vertical space).
    const rowsHTML = tab.rows.map(r => rowToSC(r, vars, nodes, style)).filter(Boolean).join('');
    lines.push(outerOpen + rowsHTML + '</div>');
  });

  if (panel.tabs.length > 0) lines.push('<</if>>');

  return lines.join('\n');
}

export function buildPanelCSS(panel: SidebarPanel): string {
  if (panel.tabs.length === 0) return '';
  const s: PanelStyle = panel.style ?? DEFAULT_PANEL_STYLE;
  const bw = s.borderWidth;
  const bc = s.borderColor;

  // Cell borders: left border on every cell except first (acts as column divider)
  const cellBorder = s.showCellBorders
    ? `.tg-row .tg-cell + .tg-cell { border-left: ${bw}px solid ${bc}; }`
    : '';
  // Row borders: top border on every row except first
  const rowBorder = s.showRowBorders
    ? `.tg-panel .tg-row + .tg-row { border-top: ${bw}px solid ${bc}; }`
    : '';

  return [
    '.tg-tabs { display: flex; gap: 2px; margin-bottom: 4px; }',
    '.tg-tabs a { flex: 1; padding: 2px 4px; text-align: center; font-size: 0.8em; border: 1px solid #555; border-radius: 2px; cursor: pointer; text-decoration: none; color: inherit; }',
    '.tg-tabs a:hover { background: rgba(255,255,255,0.15); }',
    `.tg-panel { display: flex; flex-direction: column; gap: ${s.rowGap}px; margin: 0; padding: 0; }`,
    `.tg-row { display: flex; overflow: hidden; align-items: stretch; margin: 0; }`,
    '.tg-cell { display: flex; align-items: center; overflow: hidden; font-size: 0.85em; min-width: 0; box-sizing: border-box; }',
    '.tg-progress { width: 100%; height: 100%; background: #333; border-radius: 2px; overflow: hidden; display: flex; align-items: center; }',
    '.tg-bar { height: 100%; transition: width 0.3s; display: flex; align-items: center; justify-content: center; font-size: 0.75em; }',
    '.tg-cell-img { width: 100%; height: 100%; display: block; }',
    cellBorder,
    rowBorder,
    '/* lightbox */',
    '.tg-lb { cursor: pointer !important; }',
    '#tg-lb-ov { display: none; position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,.85); align-items: center; justify-content: center; cursor: zoom-out; }',
    '#tg-lb-ov.on { display: flex; }',
    '#tg-lb-ov img { max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: 6px; box-shadow: 0 8px 48px rgba(0,0,0,.8); cursor: default; }',
    '#tg-lb-x { position: absolute; top: 12px; right: 18px; color: #fff; font-size: 2em; line-height: 1; cursor: pointer; opacity: .7; user-select: none; transition: opacity .15s; }',
    '#tg-lb-x:hover { opacity: 1; }',
  ].filter(Boolean).join('\n');
}

// ─── Panel script (lightbox) ──────────────────────────────────────────────────

export function buildPanelScript(panel: SidebarPanel): string {
  const hasImg = panel.tabs.some(t =>
    t.rows.some(r =>
      r.cells.some(c =>
        c.content.type === 'image-static' || c.content.type === 'image-bound'
      )
    )
  );
  if (!hasImg) return '';

  // Generates a self-contained global tgOpenLightbox function.
  // The overlay is created lazily on first call and reused afterwards.
  return [
    'window.tgOpenLightbox = function(src) {',
    "  var o = document.getElementById('tg-lb-ov');",
    '  if (!o) {',
    "    o = document.createElement('div');",
    "    o.id = 'tg-lb-ov';",
    "    o.innerHTML = '<span id=\"tg-lb-x\">\u2715</span><img id=\"tg-lb-img\">';",
    '    document.body.appendChild(o);',
    "    var cl = function() { o.classList.remove('on'); };",
    "    o.addEventListener('click', function(e) {",
    "      if (e.target === o || e.target.id === 'tg-lb-x') cl();",
    '    });',
    "    document.addEventListener('keydown', function(e) {",
    "      if (e.key === 'Escape') cl();",
    '    });',
    '  }',
    "  document.getElementById('tg-lb-img').src = src;",
    "  o.classList.add('on');",
    '};',
  ].join('\n');
}

// ─── Input-field script (sidebar auto-refresh) ───────────────────────────────

// ─── Live-block helpers ───────────────────────────────────────────────────────

function hasLiveBlocks(blocks: Block[]): boolean {
  return blocks.some(b => {
    if ('live' in b && (b as { live?: boolean }).live) return true;
    if (b.type === 'condition') return b.branches.some(br => hasLiveBlocks(br.blocks));
    if (b.type === 'dialogue' && b.innerBlocks) return hasLiveBlocks(b.innerBlocks);
    return false;
  });
}

// ─── Watcher export ───────────────────────────────────────────────────────────

/** Convert a stored condition/action value string to a JS literal or State reference. */
function valueToJS(val: string, varType: string, vars: Variable[], nodes: VariableTreeNode[]): string {
  if (val.startsWith('$')) {
    const refName = val.slice(1);
    const refVar = vars.find(v => v.name === refName);
    if (refVar) return buildJSRef(varPath(refVar, nodes));
    return `State.variables[${JSON.stringify(refName)}]`;
  }
  if (varType === 'number') return val || '0';
  if (varType === 'boolean') return val === 'true' ? 'true' : 'false';
  return JSON.stringify(val);
}

/** Convert a WatcherCondition to a JS boolean expression. */
function conditionToJS(cond: WatcherCondition, vars: Variable[], nodes: VariableTreeNode[]): string {
  const v = vars.find(x => x.id === cond.variableId);
  if (!v) return 'false';

  let ref = buildJSRef(varPath(v, nodes));
  const accessorKind = cond.accessor?.kind ?? 'whole';
  if (cond.accessor?.kind === 'length') {
    ref += '.length';
  } else if (cond.accessor?.kind === 'index') {
    const src = cond.accessor.source;
    if (src.kind === 'literal') ref += `[${src.index}]`;
    else {
      const idxVar = vars.find(x => x.id === src.variableId);
      ref += `[${idxVar ? buildJSRef(varPath(idxVar, nodes)) : '0'}]`;
    }
  }

  if (v.varType === 'array' && accessorKind === 'whole') {
    switch (cond.operator) {
      case 'contains':  return `Array.isArray(${ref}) && ${ref}.indexOf(${JSON.stringify(cond.value)}) !== -1`;
      case '!contains': return `(!Array.isArray(${ref}) || ${ref}.indexOf(${JSON.stringify(cond.value)}) === -1)`;
      case 'empty':     return `Array.isArray(${ref}) && ${ref}.length === 0`;
      case '!empty':    return `Array.isArray(${ref}) && ${ref}.length > 0`;
    }
  }

  const valueType = (v.varType === 'array' && accessorKind === 'index') ? 'string' : v.varType;
  const valJS = valueToJS(cond.value, valueType, vars, nodes);
  switch (cond.operator) {
    case '==': return `${ref} == ${valJS}`;
    case '!=': return `${ref} != ${valJS}`;
    case '>':  return `${ref} > ${valJS}`;
    case '<':  return `${ref} < ${valJS}`;
    case '>=': return `${ref} >= ${valJS}`;
    case '<=': return `${ref} <= ${valJS}`;
    default:   return 'false';
  }
}

/** Convert a single ButtonAction to a JS statement for use in the watcher script. */
function actionToJS(a: ButtonAction, vars: Variable[], nodes: VariableTreeNode[]): string {
  if (a.type === 'open-popup') {
    const name = a.targetSceneId || '???';
    const title = a.title ?? '';
    return `Dialog.setup("${title}"); Dialog.wiki(Story.get("${name}").processText()); Dialog.open();`;
  }
  const v = vars.find(x => x.id === a.variableId);
  if (!v) return '';

  const ref = buildJSRef(varPath(v, nodes));

  if (v.varType === 'array') {
    const accessorKind = a.accessor?.kind ?? 'whole';
    if (accessorKind === 'index') {
      let arrRef = ref;
      if (a.accessor?.kind === 'index') {
        const src = a.accessor.source;
        if (src.kind === 'literal') arrRef += `[${src.index}]`;
        else {
          const idxVar = vars.find(x => x.id === src.variableId);
          arrRef += `[${idxVar ? buildJSRef(varPath(idxVar, nodes)) : '0'}]`;
        }
      }
      return `${arrRef} = ${JSON.stringify(a.value)};`;
    }
    switch (a.operator) {
      case 'push':   return `if (Array.isArray(${ref})) ${ref}.push(${JSON.stringify(a.value)});`;
      case 'remove': return `if (Array.isArray(${ref})) { var _i = ${ref}.indexOf(${JSON.stringify(a.value)}); if (_i !== -1) ${ref}.splice(_i, 1); }`;
      case 'clear':  return `if (Array.isArray(${ref})) ${ref}.length = 0;`;
      default:       return `${ref} = ${JSON.stringify(a.value)};`;
    }
  }

  const valJS = valueToJS(a.value, v.varType, vars, nodes);
  switch (a.operator) {
    case '=':  return `${ref} = ${valJS};`;
    case '+=': return `${ref} += ${valJS};`;
    case '-=': return `${ref} -= ${valJS};`;
    case '*=': return `${ref} *= ${valJS};`;
    case '/=': return `${ref} /= ${valJS};`;
    default:   return '';
  }
}

/**
 * Generates a global _tgCheckWatchers function and a :passagedisplay hook.
 * The function uses rising-edge semantics (fires only when condition
 * transitions false → true).  It is also callable from button actions
 * so watchers react to variable changes even without Engine.show().
 * Only included when the project has at least one enabled watcher.
 */
export function buildWatcherScript(watchers: Watcher[], vars: Variable[], nodes: VariableTreeNode[]): string {
  const active = watchers.filter(w => w.enabled);
  if (active.length === 0) return '';

  const lines: string[] = [];
  lines.push('/* TG: watchers — global check function + :passagedisplay hook */');
  lines.push('window._tgCheckWatchers = function() {');
  lines.push('  window._tgWPrev = window._tgWPrev || {};');
  lines.push('  if (!State || !State.variables) return;');

  for (const w of active) {
    const label = w.label ? ` // ${w.label}` : '';
    const actionLines = w.actions.map(a => actionToJS(a, vars, nodes)).filter(Boolean);

    let navLine = '';
    if (w.navigate?.type === 'scene' && w.navigate.sceneId) {
      navLine = `    Engine.play(${JSON.stringify(w.navigate.sceneId)});`;
    } else if (w.navigate?.type === 'back') {
      navLine = '    Engine.backward();';
    }

    if (actionLines.length === 0 && !navLine) continue;

    if (!w.condition.variableId) {
      // Unconditional: run on every check
      lines.push(`  (function() {${label}`);
      for (const al of actionLines) lines.push(`    ${al}`);
      if (navLine) { lines.push(navLine); lines.push('    return;'); }
      lines.push('  })();');
    } else {
      // Conditional: rising-edge (fires only when condition transitions false → true)
      const condExpr = conditionToJS(w.condition, vars, nodes);
      if (condExpr === 'false') continue;

      const idJS = JSON.stringify(w.id);
      lines.push(`  (function() {${label}`);
      lines.push(`    var _cond = !!(${condExpr});`);
      lines.push(`    var _prev = window._tgWPrev[${idJS}];`);
      lines.push(`    window._tgWPrev[${idJS}] = _cond;`);
      lines.push(`    if (!_cond || _prev) return;`);
      for (const al of actionLines) lines.push(`    ${al}`);
      if (navLine) {
        lines.push(navLine);
        lines.push('    return;');
      }
      lines.push('  })();');
    }
  }

  lines.push('};');
  lines.push('$(document).on(":passagedisplay", window._tgCheckWatchers);');
  return lines.join('\n');
}

/** Returns true when the project has active watchers (used to inject check calls into buttons). */
export function hasActiveWatchers(watchers: Watcher[]): boolean {
  return (watchers ?? []).some(w => w.enabled);
}

/**
 * Generates a :passagedisplay/:passagehide pair that polls .tg-live[data-wiki]
 * spans every 200ms and re-wikifies them so live blocks stay in sync with
 * variable changes from buttons, function scenes, etc.
 * Only included when the project has at least one block with live: true.
 */
export function buildLiveScript(scenes: Scene[]): string {
  if (!scenes.some(s => hasLiveBlocks(s.blocks))) return '';
  return [
    '/* TG: periodic re-render of live blocks every 200ms */',
    '$(document).on(":passagedisplay", function() {',
    '  clearInterval(window._tgLiveTimer);',
    '  if ($(".tg-live[data-wiki]").length) {',
    '    window._tgLiveTimer = setInterval(function() {',
    '      $(".tg-live[data-wiki]").each(function() {',
    '        $(this).empty().wiki($(this).attr("data-wiki"));',
    '      });',
    '    }, 200);',
    '  }',
    '});',
    '$(document).on(":passagehide", function() {',
    '  clearInterval(window._tgLiveTimer);',
    '});',
  ].join('\n');
}

/**
 * Generates a debounced jQuery listener that calls UIBar.update() whenever
 * any <<textbox>> or <<numberbox>> in the passage changes.
 * Only included when the project has at least one input-field block.
 */
export function buildInputScript(scenes: Scene[]): string {
  function hasInput(blocks: Block[]): boolean {
    return blocks.some(b => {
      if (b.type === 'input-field') return true;
      if (b.type === 'condition') return b.branches.some(br => hasInput(br.blocks));
      return false;
    });
  }
  if (!scenes.some(s => hasInput(s.blocks))) return '';

  // Helper snippet: re-render all tg-live spans using their stored wiki template.
  // Harmless when no live blocks exist — selector simply matches nothing.
  const refreshLive = "  $('.tg-live[data-wiki]').each(function() { $(this).empty().wiki($(this).attr('data-wiki')); });";

  return [
    '/* TG: auto-refresh sidebar + live blocks when textbox/numberbox values change */',
    '/* change fires on Enter / blur / stepper-arrow — the moment SugarCube commits the value */',
    '$(document).on("change.tg-inp", ".macro-textbox, .macro-numberbox", function() {',
    '  UIBar.update();',
    refreshLive,
    '});',
    '/* input fires on every keystroke — debounced for live block preview */',
    '$(document).on("input.tg-inp", ".macro-textbox, .macro-numberbox", (function() {',
    '  var t;',
    '  return function() {',
    '    clearTimeout(t);',
    '    t = setTimeout(function() {',
    '      UIBar.update();',
    refreshLive,
    '    }, 200);',
    '  };',
    '})());',
  ].join('\n');
}

// ─── Animation CSS ────────────────────────────────────────────────────────────
// Animations use CSS transitions triggered via inline JS (setTimeout 16ms) rather than
// CSS @keyframes, which are unreliable on elements inserted by SugarCube's <<timed>> macro.

export function buildAnimationCSS(_scenes: Scene[]): string {
  return '';
}

// ─── Tooltip CSS ──────────────────────────────────────────────────────────────

export function buildTooltipCSS(): string {
  return [
    '.tg-tip { position: relative; border-bottom: 1px dotted currentColor; cursor: help; }',
    '.tg-tip .tg-tip-text { display: none; position: absolute; bottom: calc(100% + 4px); left: 50%; transform: translateX(-50%); background: #1a1a2e; color: #e2e8f0; padding: 6px 8px; border-radius: 4px; font-size: 0.85em; z-index: 100; pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,.4); max-width: 240px; text-align: center; }',
    '.tg-tip:hover .tg-tip-text { display: block; }',
    '.tg-tip-img { display: block; max-width: 100%; height: auto; border-radius: 3px; margin-bottom: 4px; }',
    '.tg-tip-text .tg-tip-img:last-child { margin-bottom: 0; }',
  ].join('\n');
}

// ─── Button CSS ───────────────────────────────────────────────────────────────

function collectButtons(blocks: Block[]): (ButtonBlock | LinkBlock | FunctionBlock)[] {
  const result: (ButtonBlock | LinkBlock | FunctionBlock)[] = [];
  for (const b of blocks) {
    if (b.type === 'button' || b.type === 'link' || b.type === 'function') result.push(b);
    if (b.type === 'condition') {
      for (const br of b.branches) result.push(...collectButtons(br.blocks));
    }
  }
  return result;
}

/** Generate per-block CSS for styled tg-btn-XXXX classes (ButtonBlock + LinkBlock). */
export function buildButtonsCSS(scenes: Scene[]): string {
  const buttons = scenes.flatMap(s => collectButtons(s.blocks));
  if (buttons.length === 0) return '';

  const base = [
    '.tg-btn { display: inline-block; }',
    '.tg-btn a { display: inline-block; text-decoration: none; cursor: pointer; transition: filter 0.15s; }',
    '.tg-btn a:hover { filter: brightness(1.2); }',
    '.tg-btn.full a { display: block; width: 100%; text-align: center; box-sizing: border-box; }',
  ].join('\n');

  const perBtn = buttons.map(b => {
    const s = b.style;
    const cls = `.tg-btn-${b.id.replace(/-/g, '').substring(0, 12)} a`;
    return [
      `${cls} {`,
      `  background: ${s.bgColor};`,
      `  color: ${s.textColor};`,
      `  border: 1px solid ${s.borderColor};`,
      `  border-radius: ${s.borderRadius}px;`,
      `  padding: ${s.paddingV}px ${s.paddingH}px;`,
      `  font-size: ${(s.fontSize / 10).toFixed(1)}em;`,
      s.bold ? `  font-weight: bold;` : null,
      `}`,
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  return `${base}\n\n${perBtn}`;
}

// ─── Audio helpers ──────────────────────────────────────────────────────────────

/** Collect all AudioBlocks from all scenes (including nested inside conditions). */
function collectAudioBlocks(scenes: Scene[]): { block: AudioBlock; sceneName: string }[] {
  const result: { block: AudioBlock; sceneName: string }[] = [];
  function walk(blocks: Block[], sceneName: string) {
    for (const b of blocks) {
      if (b.type === 'audio') result.push({ block: b as AudioBlock, sceneName });
      if (b.type === 'condition') {
        for (const br of b.branches) walk(br.blocks, sceneName);
      }
    }
  }
  for (const s of scenes) walk(s.blocks, s.name);
  return result;
}

/** Build <<cacheaudio>> lines for StoryInit. */
export function buildAudioCacheLines(scenes: Scene[]): string[] {
  const entries = collectAudioBlocks(scenes).filter(e => e.block.src);
  if (entries.length === 0) return [];
  return entries.map(({ block }) => {
    const trackId = `tga_${block.id.replace(/-/g, '')}`;
    return `<<cacheaudio "${trackId}" "${block.src}">>`;
  });
}

/** Build the :passageleave handler for stopping audio.
 *  Uses a static passage→trackIds map so it works reliably with back/forward navigation. */
export function buildAudioScript(scenes: Scene[], unlockText?: string): string {
  const allEntries = collectAudioBlocks(scenes);
  if (allEntries.length === 0) return '';

  // Only entries with a source file matter for track operations.
  const entries    = allEntries.filter(e => e.block.src);
  const stopEntries = entries.filter(e => e.block.onLeave === 'stop');
  const hasDelayed  = entries.some(
    e => e.block.trigger === 'delay' && e.block.triggerDelay && e.block.triggerDelay > 0,
  );
  // Immediate-trigger tracks — used to detect and recover from autoplay blocking.
  const immediateEntries = entries.filter(e => e.block.trigger === 'immediate');

  const lines: string[] = ['// Audio: passageinit handler + autoplay unlock'];

  // ── _tgAudioPlayMap: passage → [{id, volume, loop}] for immediate tracks ──────
  // Used by the autoplay-unlock overlay to replay blocked tracks on first click.
  if (immediateEntries.length > 0) {
    const playMap: Record<string, { id: string; volume: number; loop: boolean }[]> = {};
    for (const { block, sceneName } of immediateEntries) {
      const trackId = `tga_${block.id.replace(/-/g, '')}`;
      const vol     = Math.round(block.volume) / 100;
      (playMap[sceneName] ??= []).push({ id: trackId, volume: vol, loop: block.loop });
    }
    lines.push(`var _tgAudioPlayMap = ${JSON.stringify(playMap)};`);
  }

  // ── _tgAudioStopMap: passage → [trackId] for stop-on-leave tracks ─────────────
  if (stopEntries.length > 0) {
    const map: Record<string, string[]> = {};
    for (const { block, sceneName } of stopEntries) {
      const trackId = `tga_${block.id.replace(/-/g, '')}`;
      (map[sceneName] ??= []).push(trackId);
    }
    lines.push(`var _tgAudioStopMap = ${JSON.stringify(map)};`);
  }

  // ── :passageinit handler ───────────────────────────────────────────────────────
  if (stopEntries.length > 0 || hasDelayed) {
    lines.push('$(document).on(":passageinit", function(ev) {');
    if (hasDelayed) {
      // Cancel pending delayed-audio timers so they don't fire on a different scene.
      lines.push('  if (window._tgDA) { window._tgDA.forEach(function(id){ clearTimeout(id); }); window._tgDA = []; }');
    }
    if (stopEntries.length > 0) {
      lines.push(
        '  var incoming = ev.passage.title;',
        '  Object.keys(_tgAudioStopMap).forEach(function(passageName) {',
        '    if (passageName === incoming) return;',
        '    _tgAudioStopMap[passageName].forEach(function(id) {',
        '      var t = SimpleAudio.tracks.get(id);',
        '      if (t) t.stop();',
        '    });',
        '  });',
      );
    }
    lines.push('});');
  }

  // ── Autoplay-unlock overlay ────────────────────────────────────────────────────
  // Modern browsers block audio until the user interacts with the page.
  // After :passageend we check if immediate-trigger tracks are actually playing.
  // If any are blocked, we show a click-to-begin overlay. The click counts as a
  // user gesture, which unlocks the AudioContext so tracks can start.
  if (immediateEntries.length > 0) {
    // Sanitize user-supplied text: HTML-escape special chars, then escape single
    // quotes so the string is safe to embed inside a JS single-quoted literal.
    const rawText = (unlockText ?? '').trim() || '▶ Click to begin';
    const safeText = rawText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, "\\'");
    lines.push(
      '$(document).one(":passageend", function() {',
      '  if (typeof _tgAudioPlayMap === "undefined") return;',
      '  var ts = _tgAudioPlayMap[State.passage];',
      '  if (!ts || !ts.length) return;',
      '  var blocked = ts.some(function(t) {',
      '    var tr = SimpleAudio.tracks.get(t.id);',
      '    return tr && !tr.isPlaying();',
      '  });',
      '  if (!blocked) return;',
      '  var ov = document.createElement("div");',
      '  ov.id = "tg-audio-unlock";',
      '  ov.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);cursor:pointer";',
      `  ov.innerHTML = '<div style="pointer-events:none;color:#fff;font-size:1.4em;text-align:center;line-height:1.6">${safeText}</div>';`,
      '  ov.addEventListener("click", function() {',
      '    ov.remove();',
      '    var ts2 = _tgAudioPlayMap[State.passage];',
      '    if (ts2) ts2.forEach(function(t) {',
      '      var tr = SimpleAudio.tracks.get(t.id);',
      '      if (tr && !tr.isPlaying()) tr.volume(t.volume).loop(t.loop).play();',
      '    });',
      '  }, { once: true });',
      '  document.body.appendChild(ov);',
      '});',
    );
  }

  return lines.join('\n');
}

// ─── Character CSS ─────────────────────────────────────────────────────────────

function buildCharacterCSS(characters: Character[]): string {
  if (characters.length === 0) return '';
  const base = [
    '.dialogue { display: flex; align-items: flex-start; gap: 8px; margin: 4px 0; font-style: italic; }',
    '.dialogue.dlg-right { flex-direction: row-reverse; }',
    '.char-avatar { width: 96px; height: 96px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }',
    '.char-body { flex: 1; padding: 8px 12px; border-radius: 4px; }',
    '.char-name { font-weight: bold; display: block; margin-bottom: 4px; }',
    '.dialogue.dlg-right .char-name { text-align: right; }',
    '.char-text { display: block; margin: 0 !important; padding: 0; }',
  ].join('\n');
  const perChar = characters.map(c => {
    const cls = `char-${c.id}`;
    return (
      `.dialogue.${cls} .char-body {\n` +
      `  background: ${c.bgColor};\n` +
      `  border-left: 4px solid ${c.borderColor};\n` +
      `}\n` +
      `.dialogue.dlg-right.${cls} .char-body {\n` +
      `  border-left: none;\n` +
      `  border-right: 4px solid ${c.borderColor};\n` +
      `}\n` +
      `.dialogue.${cls} .char-name {\n` +
      `  color: ${c.nameColor};\n` +
      `}\n` +
      `.dialogue.${cls} .char-text {\n` +
      `  color: ${c.textColor ?? '#e2e8f0'};\n` +
      `}`
    );
  }).join('\n\n');
  return `${base}\n\n${perChar}`;
}

// ─── Twine graph hint helpers ─────────────────────────────────────────────────

/**
 * Recursively collect all target scene names reachable from a block list.
 * Used to emit <<if false>>[[Target]]<</if>> hints so the Twine editor can
 * draw passage connections in its graph view (it scans for [[...]] by regex,
 * while SugarCube never executes the content under `<<if false>>`).
 */
function collectSceneTargets(blocks: Block[]): string[] {
  const targets: string[] = [];
  for (const b of blocks) {
    if (b.type === 'choice') {
      for (const opt of b.options) {
        if (opt.targetSceneId) targets.push(opt.targetSceneId);
      }
    } else if (b.type === 'link') {
      if (b.target === 'scene' && b.targetSceneId) targets.push(b.targetSceneId);
    } else if (b.type === 'function') {
      if (b.targetSceneId) targets.push(b.targetSceneId);
    } else if (b.type === 'condition') {
      for (const branch of b.branches) {
        targets.push(...collectSceneTargets(branch.blocks));
      }
    } else if (b.type === 'dialogue' && b.innerBlocks?.length) {
      targets.push(...collectSceneTargets(b.innerBlocks));
    }
  }
  // deduplicate
  return [...new Set(targets)];
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function exportToTwee(project: Project): string {
  const variableNodes = project.variableNodes;
  const variables = flattenVariables(variableNodes);
  const { title, ifid, scenes, characters, sidebarPanel } = project;
  const startScene = scenes[0]?.name ?? 'Start';
  const parts: string[] = [];

  // StoryTitle
  parts.push(`::StoryTitle\n${title}\n`);

  // StoryData
  const storyData = JSON.stringify({
    ifid,
    format: 'SugarCube',
    'format-version': '2.36.1',
    start: startScene,
    zoom: 1,
  }, null, 2);
  parts.push(`::StoryData\n${storyData}\n`);

  // StoryInit — variable initialization
  const inits: string[] = [];
  for (const n of variableNodes) {
    if (n.kind === 'variable') {
      inits.push(`<<set $${n.name} to ${defaultValueLiteral(n)}>>`);
    } else if (n.kind === 'group' && hasLeafVariables(n)) {
      inits.push(`<<set $${n.name} = ${buildObjectLiteral(n, variableNodes)}>>`);
    }
  }
  if (sidebarPanel.tabs.length > 0) inits.push('<<set $__tgTab to 0>>');
  // Audio: <<cacheaudio>> lines + <<waitforaudio>> to block start until loaded
  const audioCacheLines = buildAudioCacheLines(scenes);
  inits.push(...audioCacheLines);
  if (audioCacheLines.length > 0) inits.push('<<waitforaudio>>');
  // Audio volume: init master volume variable
  const hasAudioVolume = sidebarPanel.tabs.some(tab =>
    tab.rows.some(r => r.cells.some(c => c.content.type === 'audio-volume')));
  if (hasAudioVolume) inits.push('<<set $__tgMasterVol to 1>>');
  if (inits.length > 0) {
    // NOTE: StoryInit must NOT have [script] tag — its content is SugarCube
    // markup (<<set>>), not raw JavaScript. The [script] tag would cause Twine
    // to interpret the macros as JS and throw "Unexpected token '<<'".
    parts.push(`::StoryInit\n${inits.join('\n')}\n`);
  }

  // StoryStylesheet
  const charCSS   = buildCharacterCSS(characters);
  const panelCSS  = buildPanelCSS(sidebarPanel);
  const buttonCSS = buildButtonsCSS(scenes);
  const animCSS   = buildAnimationCSS(scenes);
  const tipCSS    = buildTooltipCSS();
  const allCSS    = [charCSS, panelCSS, buttonCSS, animCSS, tipCSS].filter(Boolean).join('\n\n');
  if (allCSS) parts.push(`::StoryStylesheet [stylesheet]\n${allCSS}\n`);

  // StoryScript (lightbox + input debounce) — single passage
  const storyScript = [
    buildPanelScript(sidebarPanel),
    buildInputScript(scenes),
    buildLiveScript(scenes),
    buildWatcherScript(project.watchers ?? [], variables, variableNodes),
    buildAudioScript(scenes, project.settings?.audioUnlockText),
    hasAudioVolume ? [
      '// Audio volume: restore from saved state on load',
      '$(document).on(":passagedisplay", function() {',
      '  var v = State.variables.__tgMasterVol;',
      '  if (v != null) { SimpleAudio.volume(v); }',
      '});',
    ].join('\n') : '',
  ].filter(Boolean).join('\n\n');
  if (storyScript) parts.push(`::StoryScript [script]\n${storyScript}\n`);

  // StoryCaption
  const captionSC = buildStoryCaptionSC(sidebarPanel, variables, variableNodes);
  if (captionSC) parts.push(`::StoryCaption\n${captionSC}\n`);

  // Scene passages
  for (const scene of scenes) {
    const tags = scene.tags.length > 0 ? ` [${scene.tags.join(' ')}]` : '';
    const body = scene.blocks
      .map(b => blockToSC(b, characters, variables, variableNodes))
      .filter(Boolean)
      .join('\n');

    // Graph hint: <<if false>>[[Target1]][[Target2]]<</if>>
    // Twine's editor finds [[...]] by regex to draw connections.
    // SugarCube never executes content inside a false <<if>> condition.
    const navTargets = collectSceneTargets(scene.blocks);
    const graphHint = navTargets.length > 0
      ? `\n<<if false>>${navTargets.map(t => `[[${t}]]`).join('')}<</if>>`
      : '';

    parts.push(`::${scene.name}${tags}\n${body || '(empty scene)'}${graphHint}\n`);
  }

  return parts.join('\n\n') + '\n';
}

export function downloadFile(content: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
