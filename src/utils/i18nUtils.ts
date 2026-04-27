import type { Project, Block } from '../types';

/**
 * A flat map of translatable strings.
 * Key format: "id.propertyName"
 * Example: "scene-123.name", "block-456.content", "char-789.name"
 */
export type TranslationMap = Record<string, string>;

/**
 * Traverses the entire project and extracts all translatable strings.
 */
export function extractProjectStrings(project: Project): TranslationMap {
  const map: TranslationMap = {};

  // 1. Project metadata
  if (project.title) map['project.title'] = project.title;
  if (project.author) map['project.author'] = project.author;
  if (project.description) map['project.description'] = project.description;
  if (project.settings.audioUnlockText) {
    map['project.settings.audioUnlockText'] = project.settings.audioUnlockText;
  }

  // 2. Characters
  for (const char of project.characters) {
    map[`${char.id}.name`] = char.name;
  }

  // 3. Scenes and Blocks
  for (const scene of project.scenes) {
    map[`${scene.id}.name`] = scene.name;
    if (scene.notes) map[`${scene.id}.notes`] = scene.notes;
    extractBlocksStrings(scene.blocks, map);
  }

  // 4. Sidebar Panel
  if (project.sidebarPanel) {
    for (const tab of project.sidebarPanel.tabs) {
      map[`${tab.id}.label`] = tab.label;
      for (const row of tab.rows) {
        for (const cell of row.cells) {
          const c = cell.content;
          if (c.type === 'text') map[`${cell.id}.value`] = c.value;
          if (c.type === 'variable') {
            map[`${cell.id}.prefix`] = c.prefix;
            map[`${cell.id}.suffix`] = c.suffix;
          }
          if (c.type === 'button') map[`${cell.id}.label`] = c.label;
          if (c.type === 'list') {
            map[`${cell.id}.emptyText`] = c.emptyText;
            map[`${cell.id}.prefix`] = c.prefix;
            map[`${cell.id}.suffix`] = c.suffix;
          }
        }
      }
    }
  }

  return map;
}

function extractBlocksStrings(blocks: Block[], map: TranslationMap) {
  for (const block of blocks) {
    switch (block.type) {
      case 'text': map[`${block.id}.content`] = block.content; break;
      case 'dialogue':
        map[`${block.id}.text`] = block.text;
        if (block.nameSuffix) map[`${block.id}.nameSuffix`] = block.nameSuffix;
        if (block.innerBlocks) extractBlocksStrings(block.innerBlocks, map);
        break;
      case 'choice':
        for (const opt of block.options) map[`${opt.id}.label`] = opt.label;
        break;
      case 'condition':
        for (const branch of block.branches) if (branch.blocks) extractBlocksStrings(branch.blocks, map);
        break;
      case 'button':
      case 'link':
      case 'function': map[`${block.id}.label`] = block.label; break;
      case 'input-field':
        map[`${block.id}.label`] = block.label;
        map[`${block.id}.placeholder`] = block.placeholder;
        break;
      case 'checkbox':
      case 'radio':
        if (block.label) map[`${block.id}.groupLabel`] = block.label;
        for (const opt of block.options) map[`${opt.id}.label`] = opt.label;
        break;
      case 'note': map[`${block.id}.text`] = block.text; break;
      case 'image': if (block.alt) map[`${block.id}.alt`] = block.alt; break;
      case 'popup': if (block.title) map[`${block.id}.title`] = block.title; break;
    }
  }
}

/**
 * Creates a DEEP CLONE of the project and replaces all strings found in TranslationMap.
 */
export function applyTranslations(project: Project, map: TranslationMap): Project {
  const p = JSON.parse(JSON.stringify(project)) as Project;
  const t = (id: string, prop: string, original: string) => map[`${id}.${prop}`] ?? original;

  // 1. Meta
  p.title = t('project', 'title', p.title);
  if (p.author) p.author = t('project', 'author', p.author);
  if (p.description) p.description = t('project', 'description', p.description);
  if (p.settings.audioUnlockText) {
    p.settings.audioUnlockText = t('project', 'settings.audioUnlockText', p.settings.audioUnlockText);
  }

  // 2. Characters
  for (const char of p.characters) {
    char.name = t(char.id, 'name', char.name);
  }

  // 3. Scenes
  for (const scene of p.scenes) {
    scene.name = t(scene.id, 'name', scene.name);
    if (scene.notes) scene.notes = t(scene.id, 'notes', scene.notes);
    applyBlocksTranslations(scene.blocks, map);
  }

  // 4. Panel
  if (p.sidebarPanel) {
    for (const tab of p.sidebarPanel.tabs) {
      tab.label = t(tab.id, 'label', tab.label);
      for (const row of tab.rows) {
        for (const cell of row.cells) {
          const c = cell.content;
          if (c.type === 'text') c.value = t(cell.id, 'value', c.value);
          if (c.type === 'variable') {
            c.prefix = t(cell.id, 'prefix', c.prefix);
            c.suffix = t(cell.id, 'suffix', c.suffix);
          }
          if (c.type === 'button') c.label = t(cell.id, 'label', c.label);
          if (c.type === 'list') {
            c.emptyText = t(cell.id, 'emptyText', c.emptyText);
            c.prefix = t(cell.id, 'prefix', c.prefix);
            c.suffix = t(cell.id, 'suffix', c.suffix);
          }
        }
      }
    }
  }

  return p;
}

function applyBlocksTranslations(blocks: Block[], map: TranslationMap) {
  const t = (id: string, prop: string, original: string) => map[`${id}.${prop}`] ?? original;

  for (const block of blocks) {
    switch (block.type) {
      case 'text':
        block.content = t(block.id, 'content', block.content);
        break;
      case 'dialogue':
        block.text = t(block.id, 'text', block.text);
        if (block.nameSuffix) block.nameSuffix = t(block.id, 'nameSuffix', block.nameSuffix);
        if (block.innerBlocks) applyBlocksTranslations(block.innerBlocks, map);
        break;
      case 'choice':
        for (const opt of block.options) opt.label = t(opt.id, 'label', opt.label);
        break;
      case 'condition':
        for (const branch of block.branches) if (branch.blocks) applyBlocksTranslations(branch.blocks, map);
        break;
      case 'button':
      case 'link':
      case 'function':
        block.label = t(block.id, 'label', block.label);
        break;
      case 'input-field':
        block.label = t(block.id, 'label', block.label);
        block.placeholder = t(block.id, 'placeholder', block.placeholder);
        break;
      case 'checkbox':
      case 'radio':
        if (block.label) block.label = t(block.id, 'groupLabel', block.label);
        for (const opt of block.options) opt.label = t(opt.id, 'label', opt.label);
        break;
      case 'note':
        block.text = t(block.id, 'text', block.text);
        break;
      case 'image':
        if (block.alt) block.alt = t(block.id, 'alt', block.alt);
        break;
      case 'popup':
        if (block.title) block.title = t(block.id, 'title', block.title);
        break;
    }
  }
}
