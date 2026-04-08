import type {Scene, Project} from '../../types';

// --- Shared Types ---

export type LLMMode = 'continue' | 'rephrase' | 'hint';
export type LLMProvider = 'koboldcpp' | 'gemini' | 'openai';

export interface GeminiModel {
    name: string;
    version: string;
    displayName: string;
    description: string;
    supportedGenerationMethods: string[];
}

export interface GenerationParams {
    maxTokens: number;
    temperature: number;
    filterThought?: boolean;
}

// --- Structured Prompt ---

export interface StructuredPrompt {
    systemInstruction: string;
    userPrompt: string;
    continuationPrefix: string;
}

// --- Provider Abstraction ---

export interface ProviderConfig {
    url: string;
    apiKey: string;
    model: string;
}

export interface LLMProviderImpl {
    generate(
        config: ProviderConfig,
        systemPrompt: string,
        project: Project,
        scene: Scene,
        blockId: string,
        currentValue: string,
        params: GenerationParams,
        mode: LLMMode,
        signal?: AbortSignal,
        onChunk?: (accumulated: string) => void
    ): Promise<string>;

    abort(config: ProviderConfig): Promise<void>;
}
