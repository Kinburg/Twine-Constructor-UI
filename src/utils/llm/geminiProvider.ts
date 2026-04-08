import {GoogleGenAI, ThinkingLevel, type ThinkingConfig} from '@google/genai';
import type {Project, Scene} from '../../types';
import type {LLMProviderImpl, ProviderConfig, GenerationParams, LLMMode, GeminiModel} from './types';
import {constructGenerationPrompt} from './promptBuilder';
import {filterThought} from './utils';

/**
 * Wraps a promise with AbortSignal support.
 * Rejects with AbortError if the signal fires before the promise resolves.
 */
function withAbortSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));

    return new Promise<T>((resolve, reject) => {
        const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
        signal.addEventListener('abort', onAbort, {once: true});
        promise
            .then(resolve)
            .catch(reject)
            .finally(() => signal.removeEventListener('abort', onAbort));
    });
}

export const geminiProvider: LLMProviderImpl = {
    async generate(
        config: ProviderConfig,
        systemPrompt: string,
        project: Project,
        scene: Scene,
        blockId: string,
        currentValue: string,
        params: GenerationParams,
        mode: LLMMode,
        signal?: AbortSignal
    ): Promise<string> {
        const structured = constructGenerationPrompt(systemPrompt, project, scene, blockId, currentValue, mode);

        const ai = new GoogleGenAI({apiKey: config.apiKey});
        const modelName = config.model.startsWith('models/') ? config.model.slice(7) : config.model;

        // Gemini models use thinkingBudget, Gemma models use thinkingLevel
        const thinkingConfig: ThinkingConfig = modelName.includes('gemma')
            ? {includeThoughts: false, thinkingLevel: ThinkingLevel.MINIMAL}
            : {includeThoughts: false, thinkingBudget: 0};

        const response = await withAbortSignal(
            ai.models.generateContent({
                model: modelName,
                contents: structured.userPrompt,
                config: {
                    systemInstruction: structured.systemInstruction,
                    maxOutputTokens: params.maxTokens,
                    temperature: params.temperature,
                    topP: 0.95,
                    topK: 40,
                    thinkingConfig,
                },
            }),
            signal
        );

        let generatedText = response.text ?? '';

        if (params.filterThought) {
            generatedText = filterThought(generatedText);
        }

        if (mode === "continue") {
            return `${currentValue.trim()}${generatedText}`;
        }
        return generatedText;
    },

    async abort(_config: ProviderConfig): Promise<void> {
        // Gemini API does not have a direct abort endpoint.
        // Aborting is handled by the AbortController on the fetch side.
        console.log("Abort request for Gemini is handled by AbortController.");
    }
};

/**
 * Fetches available models from Gemini API using the SDK.
 */
export async function fetchGeminiModels(apiKey: string): Promise<GeminiModel[]> {
    try {
        const ai = new GoogleGenAI({apiKey});
        const pager = await ai.models.list({config: {pageSize: 100}});

        const models: GeminiModel[] = [];
        for await (const model of pager) {
            const actions = model.supportedActions ?? [];
            if (actions.includes('generateContent')) {
                models.push({
                    name: model.name ?? '',
                    version: model.version ?? '',
                    displayName: model.displayName ?? '',
                    description: model.description ?? '',
                    supportedGenerationMethods: actions,
                });
            }
        }
        return models;
    } catch (error) {
        console.error("Error fetching Gemini models:", error);
        throw error;
    }
}
