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

export async function generateImagePromptWithLlm(
  options: LlmOptions,
  project: Project,
  scene: Scene,
  blockId: string,
  hint: string,
  signal?: AbortSignal,
): Promise<string> {
  const context = buildSceneContext(scene, project.characters, blockId);
  const input = [
    'Task: write one concise image-generation prompt in English.',
    'Return only the prompt text, no markdown, no quotes, no explanations.',
    context ? `Scene context:\n${context}` : 'Scene context: (empty)',
    hint.trim() ? `Additional hint:\n${hint.trim()}` : '',
  ].filter(Boolean).join('\n\n');

  const result = await generateText(
    options.provider,
    options.urlOrApiKey,
    options.model,
    `${options.systemPrompt}\n\nYou are an assistant for text-to-image prompt writing.`,
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
