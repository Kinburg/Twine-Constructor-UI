import type { Project, Scene } from '../../types';
import { generateText } from '../llm';
import { buildSceneContext } from '../llm/promptBuilder';
import type { LLMProvider, LLMMode } from '../llm';

export type { LLMProvider };

interface LlmOptions {
  provider: LLMProvider;
  urlOrApiKey: string;
  model: string;
  apiKey?: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}

/** Collect unique character IDs that appear as dialogue speakers before the target block. */
function getCharacterIdsInScene(scene: Scene, targetBlockId: string): Set<string> {
  const ids = new Set<string>();
  for (const block of scene.blocks) {
    if (block.id === targetBlockId) break;
    if (block.type === 'dialogue' && block.characterId) {
      ids.add(block.characterId);
    }
  }
  return ids;
}

/**
 * Generates a text-to-image prompt for a scene illustration using an LLM.
 *
 * @param llmMode  - 'continue' = generate from scratch (or continue if prompt non-empty)
 *                   'rephrase' = improve / rephrase the existing prompt
 *                   'hint'     = use the current prompt as a creative hint
 * @param styleHints - selected style tags; when non-empty, LLM is told NOT to include style
 */
export async function generateImagePromptWithLlm(
  options: LlmOptions,
  project: Project,
  scene: Scene,
  blockId: string,
  currentPrompt: string,
  llmMode: LLMMode = 'hint',
  styleHints: string[] = [],
  signal?: AbortSignal,
): Promise<string> {
  const sysParts: string[] = [
    'You are generating a text-to-image prompt for a visual novel illustration.',
    'Describe only what can be visually SEEN in the image: scene location, characters present with their appearance, lighting, mood, composition.',
    'Return ONLY the prompt text in English. No markdown, no quotes, no explanations.',
  ];

  if (styleHints.length > 0) {
    sysParts.push('IMPORTANT: Do NOT include art style in the prompt — it will be appended separately after generation.');
  }

  if (project.lore?.trim()) {
    sysParts.push(`World/Setting:\n${project.lore.trim()}`);
  }

  const charIds = getCharacterIdsInScene(scene, blockId);
  const charsInScene = project.characters.filter(c => charIds.has(c.id) && c.llm_descr?.trim());
  if (charsInScene.length > 0) {
    const charLines = charsInScene.map(c => `  ${c.name}: ${c.llm_descr!.trim()}`).join('\n');
    sysParts.push(`Characters in scene:\n${charLines}`);
  }

  const context = buildSceneContext(scene, project.characters, blockId);
  if (context) {
    sysParts.push(`Scene narrative context:\n${context}`);
  }

  const systemPrompt = sysParts.join('\n\n');

  // For 'continue' mode with an empty field, switch to 'hint' so we get a fresh generation
  const effectiveMode: LLMMode = llmMode === 'continue' && !currentPrompt.trim() ? 'hint' : llmMode;

  // Pass a stripped-down project (context already embedded in systemPrompt above)
  const strippedProject = { ...project, lore: '' };

  // Dummy scene — scene context is already embedded in systemPrompt
  const dummyScene: Scene = { id: '__img_gen__', name: '', tags: [], blocks: [] };

  const result = await generateText(
    options.provider,
    options.urlOrApiKey,
    options.model,
    systemPrompt,
    strippedProject,
    dummyScene,
    '__no_block__',
    currentPrompt,
    { maxTokens: options.maxTokens, temperature: options.temperature, filterThought: true },
    effectiveMode,
    signal,
    undefined,
    options.apiKey,
  );
  console.log(result);
  return (result ?? '').trim();
}

/**
 * Generates a text-to-image prompt for a character avatar using an LLM.
 * Only uses character name + description as context — no story lore or scene data.
 *
 * @param llmMode  - 'continue' = generate from scratch (or continue if prompt non-empty)
 *                   'rephrase' = improve / rephrase the existing prompt
 *                   'hint'     = use the current prompt as a creative hint
 * @param styleHints - selected style tags; when non-empty, LLM is told NOT to include style
 */
export async function generateAvatarPromptWithLlm(
  options: LlmOptions,
  project: Project,
  charName: string,
  charDescr: string | undefined,
  slotLabel: string,
  currentPrompt: string,
  llmMode: LLMMode = 'hint',
  styleHints: string[] = [],
  signal?: AbortSignal,
): Promise<string> {
  const sysParts: string[] = [
    'You are generating a text-to-image prompt for a character avatar illustration in a visual novel.',
    'The image should be a portrait or bust illustration suitable for use as a character avatar.',
    'Describe: character appearance, facial expression, pose, clothing, lighting.',
    'Return ONLY the prompt text in English. No markdown, no quotes, no explanations.',
  ];

  if (styleHints.length > 0) {
    sysParts.push('IMPORTANT: Do NOT include art style in the prompt — it will be appended separately after generation.');
  }

  sysParts.push(`Character name: ${charName}`);
  if (charDescr?.trim()) {
    sysParts.push(`Character description: ${charDescr.trim()}`);
  }

  if (slotLabel && slotLabel !== 'static' && slotLabel !== 'default') {
    sysParts.push(`Avatar variant / emotional state: ${slotLabel}`);
  }

  const systemPrompt = sysParts.join('\n\n');

  const effectiveMode: LLMMode = llmMode === 'continue' && !currentPrompt.trim() ? 'hint' : llmMode;

  // Pass a stripped project — no lore, no characters (context embedded in systemPrompt)
  const strippedProject = { ...project, lore: '', characters: [] };
  const dummyScene: Scene = { id: '__avatar_gen__', name: '', tags: [], blocks: [] };

  const result = await generateText(
    options.provider,
    options.urlOrApiKey,
    options.model,
    systemPrompt,
    strippedProject,
    dummyScene,
    '__no_block__',
    currentPrompt,
    { maxTokens: options.maxTokens, temperature: options.temperature, filterThought: true },
    effectiveMode,
    signal,
    undefined,
    options.apiKey,
  );
  console.log(result);
  return (result ?? '').trim();
}
