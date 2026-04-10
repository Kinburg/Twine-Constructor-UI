import {GoogleGenAI, ThinkingLevel, type ThinkingConfig} from '@google/genai';
import type {Project, Scene} from '../../types';
import type {LLMProviderImpl, ProviderConfig, GenerationParams, LLMMode, GeminiModel} from './types';
import {constructGenerationPrompt} from './promptBuilder';
import {filterThought} from './utils';

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
        signal?: AbortSignal,
        onChunk?: (accumulated: string) => void
    ): Promise<string> {
        const ai = new GoogleGenAI({apiKey: config.apiKey});
        const modelName = config.model.startsWith('models/') ? config.model.slice(7) : config.model;

        let sysInstruction: string;
        let userContent: string;

        if (params.rawUserPrompt) {
            sysInstruction = systemPrompt.trim();
            userContent = params.rawUserPrompt;
        } else {
            const structured = constructGenerationPrompt(systemPrompt, project, scene, blockId, currentValue, mode);
            sysInstruction = structured.systemInstruction;
            userContent = structured.userPrompt;
        }

        // Gemini models use thinkingBudget, Gemma models use thinkingLevel
        const thinkingConfig: ThinkingConfig = modelName.includes('gemma')
            ? {includeThoughts: false, thinkingLevel: ThinkingLevel.MINIMAL}
            : {includeThoughts: false, thinkingBudget: 0};

        const requestConfig = {
            model: modelName,
            contents: userContent,
            config: {
                systemInstruction: sysInstruction,
                maxOutputTokens: params.maxTokens,
                temperature: params.temperature,
                topP: 0.95,
                topK: 40,
                thinkingConfig,
            },
        };

        try {
            const prefix = mode === 'continue' ? currentValue.trim() : '';
            let accumulated = '';

            const stream = await ai.models.generateContentStream(requestConfig);

            for await (const chunk of stream) {
                if (signal?.aborted) {
                    throw new DOMException('Aborted', 'AbortError');
                }
                const text = chunk.text ?? '';
                accumulated += text;
                onChunk?.(prefix + accumulated);
            }

            let generatedText = accumulated;

            if (params.filterThought) {
                generatedText = filterThought(generatedText);
            }

            return prefix ? prefix + " " + generatedText : generatedText;
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return "";
            }
            console.error("Failed to generate text from Gemini:", error);
            throw error;
        }
    },

    async abort(_config: ProviderConfig): Promise<void> {
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
