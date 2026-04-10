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

/** Build a mode-specific user prompt for image prompt generation. */
function buildImageGenUserPrompt(currentPrompt: string, mode: LLMMode): string {
  const trimmed = currentPrompt.trim();

  if (mode === 'rephrase') {
    return `Improve and refine the following image prompt. Make it more vivid and visually specific. Return ONLY the improved prompt.\n\nOriginal prompt:\n${trimmed}`;
  }

  if (mode === 'continue' && trimmed) {
    return `Expand and complete the following image prompt with more visual details. Return ONLY the full expanded prompt.\n\nCurrent prompt:\n${trimmed}`;
  }

  // 'hint' mode, or 'continue' with empty prompt (fresh generation)
  if (trimmed) {
    return `Generate a detailed image prompt based on the following creative direction.\n\nCreative direction:\n${trimmed}`;
  }

  return 'Generate a detailed image prompt for this scene based on the context provided.';
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
  _styleHints: string[] = [],
  signal?: AbortSignal,
): Promise<string> {
  const sysParts: string[] = [
    'You are an expert at writing text-to-image prompts for visual novel scene illustrations.',
    'Describe a single scene as it would appear in a visual novel CG.',
    'Focus on visual elements only: environment, character appearances, age, gender, poses, facial expressions, clothing, lighting, color palette, camera angle, and composition.',
    'Be specific and concrete — use precise visual details rather than abstract concepts.',
    'Do NOT include any art style, rendering style, or medium descriptions in the prompt — style tags are appended separately by the user.',
    'Keep the prompt between 2–5 sentences.',
    'Output ONLY the prompt text in English. No markdown, no quotes, no commentary.',
  ];

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
  const userPrompt = buildImageGenUserPrompt(currentPrompt, effectiveMode);

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
    { maxTokens: options.maxTokens, temperature: options.temperature, filterThought: true, rawUserPrompt: userPrompt },
    effectiveMode,
    signal,
    undefined,
    options.apiKey,
  );
  return (result ?? '').trim();
}

/**
 * Generates a text-to-image prompt for a character avatar using an LLM.
 * Uses character name + description + world setting as context.
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
  _styleHints: string[] = [],
  signal?: AbortSignal,
): Promise<string> {
  const sysParts: string[] = [
    'You are an expert at writing text-to-image prompts for character portraits in visual novels.',
    'Write a prompt for a portrait illustration (head and upper body) suitable as a character avatar.',
    'Focus on: face, facial expression, hairstyle, eye details, skin tone, visible clothing, lighting, and background.',
    'Be specific and concrete — describe exact visual details.',
    'Do NOT include any art style, rendering style, or medium descriptions in the prompt — style tags are appended separately by the user.',
    'Keep the prompt between 2–4 sentences.',
    'Output ONLY the prompt text in English. No markdown, no quotes, no commentary.',
  ];

  if (project.lore?.trim()) {
    sysParts.push(`World setting (for visual context): ${project.lore.trim()}`);
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
  const userPrompt = buildImageGenUserPrompt(currentPrompt, effectiveMode);

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
    { maxTokens: options.maxTokens, temperature: options.temperature, filterThought: true, rawUserPrompt: userPrompt },
    effectiveMode,
    signal,
    undefined,
    options.apiKey,
  );
  return (result ?? '').trim();
}
