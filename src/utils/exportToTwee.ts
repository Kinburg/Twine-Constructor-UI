import type {
  Project, Block, Character, Variable, ConditionBranch,
  SidebarPanel, SidebarRow, SidebarCell,
  Scene, ButtonBlock,
} from '../types';
import { flattenVariables } from './treeUtils';

// ─── Block → SugarCube markup ─────────────────────────────────────────────

/** Escape a string for safe use inside an HTML double-quoted attribute value. */
function htmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function blockToSC(block: Block, chars: Character[], vars: Variable[], indent = ''): string {
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
      const charNameDisplay = nameVar ? `<<print $${nameVar.name}>>` : (char?.name ?? 'Unknown');

      // Avatar HTML — static mode or variable-bound mode
      const avatarVarId = char?.varIds?.avatarVarId;
      const avatarVar = avatarVarId ? vars.find(v => v.id === avatarVarId) : null;
      const cfg = char?.avatarConfig;

      let avatarHtml = '';
      if (cfg?.mode === 'bound' && cfg.variableId) {
        // Bound mode: generate <<if>>...<<elseif>>...<<else>>...<</if>> chain
        const boundVar = vars.find(v => v.id === cfg.variableId);
        const vname = boundVar ? `$${boundVar.name}` : '$???';
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
      } else if (avatarVar) {
        // Static mode (or legacy data without avatarConfig): use $prefix_avatar variable.
        // @src="$var" is SugarCube's attribute directive — evaluates the expression at render time.
        avatarHtml = `<<if $${avatarVar.name}>><img class="char-avatar" @src="$${avatarVar.name}"><</if>>`;
      }

      const body = `<div class="char-body"><span class="char-name">${charNameDisplay}</span><span class="char-text">${block.text}</span></div>`;
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
        .map((branch, i) => branchToSC(branch, chars, vars, indent, i === 0))
        .join('\n') + `\n${indent}<</if>>`;
    }

    case 'variable-set': {
      const v = vars.find(x => x.id === block.variableId);
      if (!v) return `${indent}/* variable not found */`;
      let val = block.value;
      if (v.varType === 'string') val = `"${val}"`;
      if (block.operator === '=') return `${indent}<<set $${v.name} to ${val}>>`;
      return `${indent}<<set $${v.name} ${block.operator} ${val}>>`;
    }

    case 'image': {
      const w = block.width > 0 ? ` width="${block.width}"` : '';
      return `${indent}<img src="${block.src}" alt="${block.alt}"${w} />`;
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
      if (!v) return `${indent}/* переменная не найдена */`;
      const vname = `$${v.name}`;
      // numberbox for numeric variables, textbox for everything else
      const macro = v.varType === 'number' ? 'numberbox' : 'textbox';
      // Use the current variable value as the textbox default so the field
      // keeps whatever the player typed if the passage is re-rendered (Engine.show).
      // $varname evaluates to its StoryInit default on first load, and to the
      // player's input on subsequent re-renders.
      const defVal = `$${v.name}`;
      const lines: string[] = [];
      if (block.label) lines.push(`${indent}${block.label}`);
      lines.push(`${indent}<<${macro} "${vname}" ${defVal}>>`);
      return lines.join('\n');
    }

    case 'button': {
      const cls = `tg-btn-${block.id.replace(/-/g, '').substring(0, 12)}`;
      const actionLines = block.actions
        .map(a => {
          const v = vars.find(x => x.id === a.variableId);
          if (!v) return '';
          let val = a.value;
          if (v.varType === 'string') val = `"${val}"`;
          if (a.operator === '=') return `${indent}  <<set $${v.name} to ${val}>>`;
          return `${indent}  <<set $${v.name} ${a.operator} ${val}>>`;
        })
        .filter(Boolean);
      if (block.refreshScene) actionLines.push(`${indent}  <<run Engine.show()>>`);
      actionLines.push(`${indent}  <<run UIBar.update()>>`);
      return (
        `${indent}<span class="tg-btn ${cls}">` +
        `<<link "${block.label}">>\n` +
        actionLines.join('\n') + '\n' +
        `${indent}<</link>></span>`
      );
    }
  }
}

function branchToSC(
  branch: ConditionBranch,
  chars: Character[],
  vars: Variable[],
  indent: string,
  isFirst: boolean,
): string {
  const innerLines = branch.blocks
    .map(b => blockToSC(b, chars, vars, indent + '  '))
    .join('\n');

  if (branch.branchType === 'else') {
    return `${indent}<<else>>\n${innerLines}`;
  }

  const v = vars.find(x => x.id === branch.variableId);
  const varName = v ? `$${v.name}` : '$unknown';
  let val = branch.value;
  if (v?.varType === 'string') val = `"${val}"`;
  const expr = `${varName} ${branch.operator} ${val}`;

  if (branch.branchType === 'if' || isFirst) {
    return `${indent}<<if ${expr}>>\n${innerLines}`;
  }
  return `${indent}<<elseif ${expr}>>\n${innerLines}`;
}

// ─── Panel → StoryCaption markup ──────────────────────────────────────────────

function cellToSC(cell: SidebarCell, vars: Variable[]): string {
  const c = cell.content;
  const flex = `flex: ${cell.width};`;
  let inner = '';

  switch (c.type) {
    case 'text':
      inner = c.value;
      break;

    case 'variable': {
      const v = vars.find(x => x.id === c.variableId);
      const vname = v ? `$${v.name}` : '$???';
      inner = `${c.prefix}<<print ${vname}>>${c.suffix}`;
      break;
    }

    case 'progress': {
      const v = vars.find(x => x.id === c.variableId);
      const vname = v ? `$${v.name}` : '$???';
      const pct = `Math.min(100, Math.max(0, ${vname} / ${c.maxValue} * 100)).toFixed(0)`;
      const barStyle = `width: <<print ${pct}>>%; background: ${c.color};`;
      const text = c.showText ? `<<print ${vname}>>/${c.maxValue}` : '';
      inner = `<span class="tg-progress"><span class="tg-bar" style="${barStyle}">${text}</span></span>`;
      break;
    }

    case 'image-static':
      inner = `<img class="tg-cell-img tg-lb" src="${c.src}" style="object-fit: ${c.objectFit};" onclick="tgOpenLightbox(this.src)" />`;
      break;

    case 'image-bound': {
      const v = vars.find(x => x.id === c.variableId);
      const vname = v ? `$${v.name}` : '$???';
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
  }

  return `<span class="tg-cell" style="${flex}">${inner}</span>`;
}

function rowToSC(row: SidebarRow, vars: Variable[]): string {
  if (row.cells.length === 0) return '';
  const cells = row.cells.map(c => cellToSC(c, vars)).join('');
  return `<div class="tg-row" style="height: ${row.height}px;">${cells}</div>`;
}

export function buildStoryCaptionSC(panel: SidebarPanel, vars: Variable[]): string {
  if (panel.tabs.length === 0) return '';

  const lines: string[] = [];
  lines.push('<<if ndef $__tgTab>><<set $__tgTab to 0>><</if>>');

  if (panel.tabs.length > 1) {
    lines.push('<div class="tg-tabs">');
    panel.tabs.forEach((tab, i) => {
      lines.push(`<<link "${tab.label}">><<set $__tgTab to ${i}>><<run UIBar.update()>><</link>>`);
    });
    lines.push('</div>');
  }

  panel.tabs.forEach((tab, i) => {
    const kw = i === 0 ? '<<if' : '<<elseif';
    lines.push(`${kw} $__tgTab eq ${i}>>`);
    for (const row of tab.rows) {
      const r = rowToSC(row, vars);
      if (r) lines.push(r);
    }
  });

  if (panel.tabs.length > 0) lines.push('<</if>>');

  return lines.join('\n');
}

export function buildPanelCSS(panel: SidebarPanel): string {
  if (panel.tabs.length === 0) return '';
  return [
    '.tg-tabs { display: flex; gap: 2px; margin-bottom: 4px; }',
    '.tg-tabs a { flex: 1; padding: 2px 4px; text-align: center; font-size: 0.8em; border: 1px solid #555; border-radius: 2px; cursor: pointer; text-decoration: none; color: inherit; }',
    '.tg-tabs a:hover { background: rgba(255,255,255,0.15); }',
    '.tg-row { display: flex; gap: 4px; margin-bottom: 2px; overflow: hidden; align-items: stretch; }',
    '.tg-cell { display: flex; align-items: center; overflow: hidden; font-size: 0.85em; min-width: 0; }',
    '.tg-progress { width: 100%; height: 100%; background: #333; border-radius: 2px; overflow: hidden; display: flex; align-items: center; }',
    '.tg-bar { height: 100%; transition: width 0.3s; display: flex; align-items: center; justify-content: center; font-size: 0.75em; }',
    '.tg-cell-img { width: 100%; height: 100%; display: block; }',
    '/* lightbox */',
    '.tg-lb { cursor: pointer !important; }',
    '#tg-lb-ov { display: none; position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,.85); align-items: center; justify-content: center; cursor: zoom-out; }',
    '#tg-lb-ov.on { display: flex; }',
    '#tg-lb-ov img { max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: 6px; box-shadow: 0 8px 48px rgba(0,0,0,.8); cursor: default; }',
    '#tg-lb-x { position: absolute; top: 12px; right: 18px; color: #fff; font-size: 2em; line-height: 1; cursor: pointer; opacity: .7; user-select: none; transition: opacity .15s; }',
    '#tg-lb-x:hover { opacity: 1; }',
  ].join('\n');
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

// ─── Button CSS ───────────────────────────────────────────────────────────────

function collectButtons(blocks: Block[]): ButtonBlock[] {
  const result: ButtonBlock[] = [];
  for (const b of blocks) {
    if (b.type === 'button') result.push(b);
    if (b.type === 'condition') {
      for (const br of b.branches) result.push(...collectButtons(br.blocks));
    }
  }
  return result;
}

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

// ─── Character CSS ─────────────────────────────────────────────────────────────

function buildCharacterCSS(characters: Character[]): string {
  if (characters.length === 0) return '';
  const base = [
    '.dialogue { display: flex; align-items: flex-start; gap: 8px; margin: 4px 0; font-style: italic; }',
    '.dialogue.dlg-right { flex-direction: row-reverse; }',
    '.char-avatar { width: 48px; height: 48px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }',
    '.char-body { flex: 1; padding: 8px 12px; border-radius: 4px; }',
    '.char-name { font-weight: bold; display: block; margin-bottom: 4px; }',
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
      `}`
    );
  }).join('\n\n');
  return `${base}\n\n${perChar}`;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function exportToTwee(project: Project): string {
  const variables = flattenVariables(project.variableNodes);
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
  const inits = variables.map(v => {
    let val = v.defaultValue;
    if (v.varType === 'string')  val = `"${val}"`;
    if (v.varType === 'boolean') val = val === 'true' ? 'true' : 'false';
    return `<<set $${v.name} to ${val}>>`;
  });
  if (sidebarPanel.tabs.length > 0) inits.push('<<set $__tgTab to 0>>');
  if (inits.length > 0) {
    parts.push(`::StoryInit [script]\n${inits.join('\n')}\n`);
  }

  // StoryStylesheet
  const charCSS    = buildCharacterCSS(characters);
  const panelCSS   = buildPanelCSS(sidebarPanel);
  const buttonCSS  = buildButtonsCSS(scenes);
  const allCSS     = [charCSS, panelCSS, buttonCSS].filter(Boolean).join('\n\n');
  if (allCSS) parts.push(`::StoryStylesheet [stylesheet]\n${allCSS}\n`);

  // StoryScript (lightbox + input debounce) — single passage, sections joined
  const storyScript = [buildPanelScript(sidebarPanel), buildInputScript(scenes)]
    .filter(Boolean).join('\n\n');
  if (storyScript) parts.push(`::StoryScript [script]\n${storyScript}\n`);

  // StoryCaption
  const captionSC = buildStoryCaptionSC(sidebarPanel, variables);
  if (captionSC) parts.push(`::StoryCaption\n${captionSC}\n`);

  // Scene passages
  for (const scene of scenes) {
    const tags = scene.tags.length > 0 ? ` [${scene.tags.join(' ')}]` : '';
    const body = scene.blocks
      .map(b => blockToSC(b, characters, variables))
      .filter(Boolean)
      .join('\n');
    parts.push(`::${scene.name}${tags}\n${body || '(пустая сцена)'}\n`);
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
