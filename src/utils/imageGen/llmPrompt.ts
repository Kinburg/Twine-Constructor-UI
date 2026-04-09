import type { Project, Scene } from '../../types';
import { generateText } from '../llm';
import { buildSceneContext } from '../llm/promptBuilder';
import type { LLMProvider } from '../llm';

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

export async function generateImagePromptWithLlm(
  options: LlmOptions,
  project: Project,
  scene: Scene,
  blockId: string,
  hint: string,
  signal?: AbortSignal,
): Promise<string> {
  const context = buildSceneContext(scene, project.characters, blockId);
  const charIds = getCharacterIdsInScene(scene, blockId);

  const parts: string[] = [
    'You are writing a text-to-image prompt. Describe only what can be visually SEEN in the image.',
    'Include: scene location, characters present with their appearance, lighting, mood, composition.',
    'Do NOT describe plot events, feelings, or dialogue — only visual elements.',
    'Return ONLY the prompt text in English. No markdown, no quotes, no explanations.',
  ];

  if (project.lore?.trim()) {
    parts.push(`World/Setting:\n${project.lore.trim()}`);
  }

  const charsInScene = project.characters.filter(
    c => charIds.has(c.id) && c.llm_descr?.trim(),
  );
  if (charsInScene.length > 0) {
    const charLines = charsInScene.map(c => `  ${c.name}: ${c.llm_descr!.trim()}`).join('\n');
    parts.push(`Characters in scene:\n${charLines}`);
  }

  if (context) {
    parts.push(`Scene narrative context:\n${context}`);
  }

  if (hint.trim()) {
    parts.push(`Additional hint:\n${hint.trim()}`);
  }

  const input = parts.join('\n\n');

  const result = await generateText(
    options.provider,
    options.urlOrApiKey,
    options.model,
    options.systemPrompt,
    project,
    scene,
    blockId,
    input,
    {
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      filterThought: true,
    },
    'hint',
    signal,
    undefined,
    options.apiKey,
  );

  return (result ?? '').trim();
}
