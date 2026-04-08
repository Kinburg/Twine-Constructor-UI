import type {Project, Scene} from '../../types';
import type {LLMProvider, LLMProviderImpl, ProviderConfig, LLMMode} from './types';
import {koboldcppProvider} from './koboldcppProvider';
import {geminiProvider} from './geminiProvider';

// --- Provider Registry ---

const providers: Record<LLMProvider, LLMProviderImpl> = {
    koboldcpp: koboldcppProvider,
    gemini: geminiProvider,
};

// --- Main Dispatcher ---

/**
 * Dispatches text generation to the appropriate LLM provider.
 */
export async function generateText(
    provider: LLMProvider,
    urlOrApiKey: string,
    model: string,
    systemPrompt: string,
    project: Project,
    scene: Scene,
    blockId: string,
    currentValue: string,
    params: { maxTokens: number; temperature: number; filterThought?: boolean },
    mode: LLMMode = 'continue',
    signal?: AbortSignal
): Promise<string> {
    const impl = providers[provider];
    if (!impl) throw new Error(`Unknown LLM provider: ${provider}`);

    const config: ProviderConfig = {
        url: urlOrApiKey,
        apiKey: urlOrApiKey,
        model,
    };

    return impl.generate(config, systemPrompt, project, scene, blockId, currentValue, params, mode, signal);
}

/**
 * Sends a stop/abort request to the specified LLM provider.
 */
export async function abortGeneration(provider: LLMProvider, genUrl: string) {
    const impl = providers[provider];
    if (!impl) return;
    await impl.abort({url: genUrl, apiKey: '', model: ''});
}

// --- Re-exports ---

export type {LLMMode, LLMProvider, GeminiModel, GenerationParams, ProviderConfig} from './types';
export {fetchGeminiModels} from './geminiProvider';
export {filterThought} from './utils';
export {buildSceneContext} from './promptBuilder';
