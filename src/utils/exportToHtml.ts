import type { Project, ProjectSettings, Character } from '../types';
import { START_TAG } from '../types';
import { flattenVariables, hasLeafVariables } from './treeUtils';
import { blockToSC, buildStoryCaptionSC, buildPanelCSS, buildButtonsCSS, buildTooltipCSS, buildPanelScript, buildInputScript, buildLiveScript, buildWatcherScript, buildPurlSignatureScript, defaultValueLiteral, buildObjectLiteral, buildAudioCacheLines, buildAudioScript, buildInventoryScript, buildContainerScript, buildContainerCSS, buildDateTimeScript, buildPaperdollScript, buildPaperdollCSS } from './exportToTwee';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// ─── Project settings → CSS / JS ──────────────────────────────────────────────

function buildGlobalCSS(settings?: ProjectSettings): string {
  if (!settings) return '';
  const rules: string[] = [];

  if (settings.bgColor)
    rules.push(`body, #story { background-color: ${settings.bgColor} !important; }`);

  if (settings.sidebarColor)
    rules.push(`#ui-bar, #ui-bar-body { background-color: ${settings.sidebarColor} !important; }`);

  if (settings.titleColor || settings.titleFont) {
    const props: string[] = [];
    if (settings.titleColor) props.push(`color: ${settings.titleColor}`);
    if (settings.titleFont)  props.push(`font-family: ${settings.titleFont}`);
    rules.push(`#story-title { ${props.join('; ')}; }`);
  }

  return rules.join('\n');
}

function buildSettingsScript(settings?: ProjectSettings): string {
  if (!settings) return '';
  const lines: string[] = [];

  if (settings.historyControls === false)
    lines.push('Config.history.controls = false;');

  if (settings.saveLoadMenu === false)
    lines.push('if (window.UIBar) UIBar.stow(); Config.saves.isAllowed = () => false;');

  return lines.join('\n');
}

// ─── CSS generation ───────────────────────────────────────────────────────────

function buildCharacterCSS(characters: Character[]): string {
  if (characters.length === 0) return '';
  const base = [
    '.dialogue { display: flex; align-items: flex-start; gap: 8px; margin: 4px 0; font-style: italic; }',
    '.dialogue.dlg-right { flex-direction: row-reverse; }',
    '.char-avatar { width: 96px; height: 96px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }',
    '.char-body { flex: 1; padding: 8px 12px; border-radius: 4px; }',
    '.char-name { font-weight: bold; display: block; margin-bottom: 4px; }',
    '.char-text { display: block; margin: 0 !important; padding: 0; }',
  ].join('\n');
  const perChar = characters.map(c => {
    const cls = `char-${c.id}`;
    return [
      `.dialogue.${cls} .char-body {`,
      `  background: ${c.bgColor};`,
      `  border-left: 4px solid ${c.borderColor};`,
      `}`,
      `.dialogue.dlg-right.${cls} .char-body {`,
      `  border-left: none;`,
      `  border-right: 4px solid ${c.borderColor};`,
      `}`,
      `.dialogue.${cls} .char-name {`,
      `  color: ${c.nameColor};`,
      `}`,
      `.dialogue.${cls} .char-text {`,
      `  color: ${c.textColor ?? '#e2e8f0'};`,
      `}`,
    ].join('\n');
  }).join('\n\n');
  return `${base}\n\n${perChar}`;
}

// ─── Passage builder ──────────────────────────────────────────────────────────

interface PassageEntry {
  pid: number;
  name: string;
  tags: string;
  content: string;
  x: number;
  y: number;
}

export function buildPassages(project: Project): {
  passages: PassageEntry[];
  startPid: number;
  combinedCSS: string;
  scriptContent: string;
} {
  const variables = flattenVariables(project.variableNodes);
  const { scenes, characters, sidebarPanel } = project;
  const idToName = new Map(scenes.map(s => [s.id, s.name]));
  let pid = 1;
  const passages: PassageEntry[] = [];
  const colW = 180, rowH = 120;

  // StoryTitle passage
  passages.push({
    pid: pid++, name: 'StoryTitle', tags: '',
    content: project.title, x: colW, y: 100,
  });

  const variableNodes = project.variableNodes;

  // StoryInit — variable initialization + $__tgTab
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
  // Initial inventory: push starting items for each character
  for (const char of project.characters) {
    if (!char.varName) continue;
    const charPath = `$${char.varName}`;
    // Paperdoll default equipment: set slot variables from defaultItemVarName
    if (char.paperdoll?.slots?.length) {
      for (const pdSlot of char.paperdoll.slots) {
        if (pdSlot.defaultItemVarName) {
          inits.push(`<<set ${charPath}.equipment.${pdSlot.id} to "${pdSlot.defaultItemVarName}">>`);
        }
      }
    }
    if (!char.initialInventory?.length) continue;
    for (const slot of char.initialInventory) {
      const isDefaultEquipped = char.paperdoll?.slots?.some(
        ps => ps.defaultItemVarName === slot.itemVarName
      ) ?? false;
      inits.push(`<<run ${charPath}.inventory.push({ item: "${slot.itemVarName}", qty: ${slot.quantity}, equipped: ${isDefaultEquipped} })>>`);
    }
  }
  if (inits.length > 0) {
    passages.push({
      pid: pid++, name: 'StoryInit', tags: '',
      content: inits.join('\n'), x: colW * 2, y: 100,
    });
  }

  // StoryCaption (sidebar panel)
  const captionSC = buildStoryCaptionSC(sidebarPanel, variables, variableNodes, idToName, project.characters, project.items);
  if (captionSC) {
    passages.push({
      pid: pid++, name: 'StoryCaption', tags: '',
      content: captionSC, x: colW * 3, y: 100,
    });
  }

  // Scene passages — track PID for start-tagged scene
  let startPid = pid; // fallback to first scene

  scenes.forEach((scene, idx) => {
    const body = scene.blocks
      .map(b => blockToSC(b, characters, variables, variableNodes, '', idToName, project))
      .filter(Boolean)
      .join('\n');
    const scenePid = pid++;
    if (scene.tags.includes(START_TAG)) startPid = scenePid;
    const exportTags = scene.tags.filter(t => t !== START_TAG);
    passages.push({
      pid: scenePid,
      name: scene.name,
      tags: exportTags.join(' '),
      content: body || '',
      x: colW * (idx % 5 + 1),
      y: 100 + rowH * (Math.floor(idx / 5) + 1),
    });
  });

  const charCSS      = buildCharacterCSS(characters);
  const panelCSS     = buildPanelCSS(sidebarPanel);
  const buttonCSS    = buildButtonsCSS(scenes);
  const tipCSS       = buildTooltipCSS();
  const globalCSS    = buildGlobalCSS(project.settings);
  const containerCSS = buildContainerCSS();
  const paperdollCSS = buildPaperdollCSS(project);
  const combinedCSS = [globalCSS, charCSS, panelCSS, buttonCSS, tipCSS, containerCSS, paperdollCSS].filter(Boolean).join('\n\n');

  const settingsScript = buildSettingsScript(project.settings);
  const scriptContent = [
    settingsScript,
    buildDateTimeScript(),
    buildPanelScript(sidebarPanel),
    buildInputScript(scenes),
    buildLiveScript(scenes),
    buildWatcherScript(project.watchers ?? [], variables, variableNodes, idToName),
    buildAudioScript(scenes, project.settings?.audioUnlockText),
    buildInventoryScript(project),
    buildContainerScript(project),
    buildPaperdollScript(project),
    buildPurlSignatureScript(),
    hasAudioVolume ? [
      '// Audio volume: restore from saved state on load (audio + video)',
      '$(document).on(":passagedisplay", function() {',
      '  var v = State.variables.__tgMasterVol;',
      '  if (v != null) {',
      '    SimpleAudio.volume(v);',
      '    document.querySelectorAll("video").forEach(function(el) { el.volume = v; });',
      '  }',
      '});',
    ].join('\n') : '',
  ].filter(Boolean).join('\n\n');

  return { passages, startPid, combinedCSS, scriptContent };
}

// ─── Standalone HTML generator ────────────────────────────────────────────────

export function generateStandaloneHtml(project: Project, scTemplate: string): string {
  const { passages, startPid, combinedCSS, scriptContent } = buildPassages(project);

  const styleBlock  = `<style role="stylesheet" id="twine-user-stylesheet" type="text/twine-css">${esc(combinedCSS)}</style>`;
  const scriptBlock = `<script role="script" id="twine-user-script" type="text/twine-javascript">${scriptContent}</script>`;

  const passageBlocks = passages.map(p =>
    `<tw-passagedata pid="${p.pid}" name="${escAttr(p.name)}" tags="${escAttr(p.tags)}" position="${p.x},${p.y}" size="100,100">${esc(p.content)}</tw-passagedata>`
  ).join('\n');

  const innerContent = `${styleBlock}\n${scriptBlock}\n${passageBlocks}`;

  const authorAttr = project.author ? ` author="${escAttr(project.author)}"` : '';
  const storyDataElement =
    `<tw-storydata name="${escAttr(project.title)}" startnode="${startPid}" ` +
    `creator="Purl" creator-version="1.0.0"${authorAttr} ` +
    `format="SugarCube" format-version="2.36.1" ` +
    `ifid="${escAttr(project.ifid)}" zoom="1" options="" hidden>\n` +
    `${innerContent}\n` +
    `</tw-storydata>`;

  let html = scTemplate;

  html = html.replace(/\{\{STORY_DATA\}\}/g, storyDataElement);
  html = html.replace(/\{\{STORY_NAME\}\}/g,           escAttr(project.title));
  html = html.replace(/\{\{STORY_START\}\}/g,          String(startPid));
  html = html.replace(/\{\{STORY_IFID\}\}/g,           project.ifid);
  html = html.replace(/\{\{CREATOR_NAME\}\}/g,         'Purl');
  html = html.replace(/\{\{CREATOR_VERSION\}\}/g,      '1.0.0');
  html = html.replace(/\{\{STORY_FORMAT\}\}/g,         'SugarCube');
  html = html.replace(/\{\{STORY_FORMAT_VERSION\}\}/g, '2.36.1');
  html = html.replace(/\{\{STORY_ZOOM\}\}/g,           '1');
  html = html.replace(/\{\{STORY_OPTIONS\}\}/g,        '');

  html = html.replace(
    /(<tw-storydata\b[^>]*?\bstartnode=")[^"]*"/,
    `$1${startPid}"`,
  );

  return html;
}
