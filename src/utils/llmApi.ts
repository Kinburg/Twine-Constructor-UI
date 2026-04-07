import type { Scene, Character } from '../types';

interface KoboldGenerateRequest {
  prompt: string;
  max_length?: number;
  max_context_length?: number;
  temperature?: number;
  top_p?: number;
  // ... other KoboldCPP parameters
}

interface KoboldGenerateResponse {
  results: { text: string }[];
}

/**
 * Builds context from scene blocks up to the specified target block.
 * Concatenates text and dialogue content.
 */
export function buildSceneContext(scene: Scene, characters: Character[], targetBlockId: string): string {
  let context = "";
  
  for (const block of scene.blocks) {
    if (block.id === targetBlockId) break;

    if (block.type === 'text') {
      context += block.content + "\n\n";
    } else if (block.type === 'dialogue') {
      const char = characters.find(c => c.id === block.characterId);
      const name = char ? char.name : "???";
      context += `${name}: ${block.text}\n\n`;
    }
  }

  return context.trim();
}

/**
 * Calls KoboldCPP API to generate text based on the context.
 */
export async function generateText(
  url: string,
  systemPrompt: string,
  context: string,
  currentValue: string,
  params: { maxTokens: number; temperature: number }
): Promise<string> {
  let prompt = systemPrompt;
  if (context) {
    prompt += "\n\n" + context;
  }
  if (currentValue.trim()) {
    prompt += "\n\n" + currentValue.trim();
  }

  const requestBody: KoboldGenerateRequest = {
    prompt,
    max_length: params.maxTokens,
    temperature: params.temperature,
    // KoboldCPP specific defaults
    top_p: 0.9,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.statusText}`);
    }

    const data: KoboldGenerateResponse = await response.json();
    return data.results[0]?.text || "";
  } catch (error) {
    console.error("Failed to generate text:", error);
    throw error;
  }
}
