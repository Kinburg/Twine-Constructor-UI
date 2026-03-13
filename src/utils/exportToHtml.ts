import type { Project, Character } from '../types';
import { flattenVariables } from './treeUtils';
import { blockToSC, buildStoryCaptionSC, buildPanelCSS, buildButtonsCSS, buildPanelScript, buildInputScript } from './exportToTwee';

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
  let pid = 1;
  const passages: PassageEntry[] = [];
  const colW = 180, rowH = 120;

  // StoryTitle passage
  passages.push({
    pid: pid++, name: 'StoryTitle', tags: '',
    content: project.title, x: colW, y: 100,
  });

  // StoryInit — variable initialization + $__tgTab
  const inits = variables.map(v => {
    let val = v.defaultValue;
    if (v.varType === 'string')  val = `"${val}"`;
    if (v.varType === 'boolean') val = val === 'true' ? 'true' : 'false';
    return `<<set $${v.name} to ${val}>>`;
  });
  if (sidebarPanel.tabs.length > 0) inits.push('<<set $__tgTab to 0>>');
  if (inits.length > 0) {
    passages.push({
      pid: pid++, name: 'StoryInit', tags: '',
      content: inits.join('\n'), x: colW * 2, y: 100,
    });
  }

  // StoryCaption (sidebar panel)
  const captionSC = buildStoryCaptionSC(sidebarPanel, variables);
  if (captionSC) {
    passages.push({
      pid: pid++, name: 'StoryCaption', tags: '',
      content: captionSC, x: colW * 3, y: 100,
    });
  }

  // Record where scene passages start
  const startPid = pid;

  // Scene passages
  scenes.forEach((scene, idx) => {
    const body = scene.blocks
      .map(b => blockToSC(b, characters, variables))
      .filter(Boolean)
      .join('\n');
    passages.push({
      pid: pid++,
      name: scene.name,
      tags: scene.tags.join(' '),
      content: body || '',
      x: colW * (idx % 5 + 1),
      y: 100 + rowH * (Math.floor(idx / 5) + 1),
    });
  });

  const charCSS   = buildCharacterCSS(characters);
  const panelCSS  = buildPanelCSS(sidebarPanel);
  const buttonCSS = buildButtonsCSS(scenes);
  const combinedCSS = [charCSS, panelCSS, buttonCSS].filter(Boolean).join('\n\n');

  const scriptContent = [buildPanelScript(sidebarPanel), buildInputScript(scenes)]
    .filter(Boolean).join('\n\n');

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

  const storyDataElement =
    `<tw-storydata name="${escAttr(project.title)}" startnode="${startPid}" ` +
    `creator="TwineConstructor" creator-version="1.0.0" ` +
    `format="SugarCube" format-version="2.36.1" ` +
    `ifid="${escAttr(project.ifid)}" zoom="1" options="" hidden>\n` +
    `${innerContent}\n` +
    `</tw-storydata>`;

  let html = scTemplate;

  html = html.replace(/\{\{STORY_DATA\}\}/g, storyDataElement);
  html = html.replace(/\{\{STORY_NAME\}\}/g,           escAttr(project.title));
  html = html.replace(/\{\{STORY_START\}\}/g,          String(startPid));
  html = html.replace(/\{\{STORY_IFID\}\}/g,           project.ifid);
  html = html.replace(/\{\{CREATOR_NAME\}\}/g,         'TwineConstructor');
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
