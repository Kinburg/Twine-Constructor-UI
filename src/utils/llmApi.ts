import type {Scene, Character, Project} from '../types';

interface KoboldGenerateRequest {
    prompt: string;
    max_length?: number;
    max_context_length?: number;
    temperature?: number;
    top_p?: number;
    [key: string]: any; // Allow other KoboldCPP parameters
}

interface KoboldGenerateResponse {
    results: { text: string }[];
}

export type LLMMode = 'continue' | 'rephrase' | 'hint';

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
 * Sends a stop/abort request to KoboldCPP.
 */
export async function abortGeneration(genUrl: string) {
    try {
        const url = new URL(genUrl);
        // KoboldCPP abort endpoint: /api/extra/abort
        const abortUrl = `${url.protocol}//${url.host}/api/extra/abort`;
        
        await fetch(abortUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
    } catch (e) {
        console.error("Failed to send abort request to KoboldCPP:", e);
    }
}

/**
 * Calls KoboldCPP API to generate text based on the context.
 */
export async function generateText(
    url: string,
    systemPrompt: string,
    project: Project,
    scene: Scene,
    blockId: string,
    currentValue: string,
    params: { maxTokens: number; temperature: number },
    mode: LLMMode = 'continue',
    signal?: AbortSignal
): Promise<string> {
    const context = buildSceneContext(scene, project.characters, blockId);
    const targetBlock = scene.blocks.find(b => b.id === blockId);

    let generationPrompt = "";

    // 1. Lore / Story Context
    if (project.lore) {
        generationPrompt += `### Story Lore:\n${project.lore}\n\n`;
    }

    // 2. Character / Field Context
    if (targetBlock?.type === 'dialogue') {
        const char = project.characters.find(c => c.id === targetBlock.characterId);
        if (char) {
            generationPrompt += `### Character Info:\nName: ${char.name}\n`;
            if (char.llm_descr) {
                generationPrompt += `Personality/Description: ${char.llm_descr}\n`;
            }
            generationPrompt += "\n";
        }
    }

    // 3. Main Context (History)
    if (context) {
        generationPrompt += `### Story Context (Previous events):\n${context}\n\n`;
    }

    // 4. Task based on mode
    generationPrompt += `### Current Task:\n`;
    if (mode === 'rephrase') {
        generationPrompt += `Rephrase, improve, and expand the following text. `;
        if (targetBlock?.type === 'dialogue') {
            const char = project.characters.find(c => c.id === targetBlock?.characterId);
            generationPrompt += `Make sure the speech strictly matches the character's personality and style. Write it as a ${char?.name || 'the character'}'s phrase. Do not use "${char?.name || 'the character'}:" and quotation marks.`;
        } else {
            generationPrompt += `Write it as an author of the story. Do not write dialogues or character's speeches. Write only descriptions of actions, objects and progression through the plot.`;
        }
        generationPrompt += `Return ONLY the improved text.\n\nSYSTEM: [Text to improve:\n${currentValue.trim()}]\n`;
    } else if (mode === 'hint') {
        generationPrompt += `Generate a text based on the following hint and instruction. `;
        if (targetBlock?.type === 'dialogue') {
            const char = project.characters.find(c => c.id === targetBlock?.characterId);
            generationPrompt += `Write it as a ${char?.name || 'the character'}'s phrase. Do not use "${char?.name || 'the character'}:" and quotation marks.`;
        } else {
            generationPrompt += `Write it as an author of the story. Do not write dialogues or character's speeches. Write only descriptions of actions, objects and progression through the plot.`;
        }
        generationPrompt += `Return ONLY the generated content, do not repeat the instruction.\n\nSYSTEM: [Take the following into special consideration for your next message: ${currentValue.trim()}]\n`;
    } else {
        // continue
        generationPrompt += `Continue the story. `;
        if (targetBlock?.type === 'dialogue') {
            const char = project.characters.find(c => c.id === targetBlock?.characterId);
            generationPrompt += `Write it as a ${char?.name || 'the character'}'s phrase. Do not use "${char?.name || 'the character'}:" and quotation marks.`;
        } else {
            generationPrompt += `Write it as an author of the story. Do not write dialogues or character's speeches. Write only descriptions of actions, objects and progression through the plot.`;
        }
        generationPrompt += `Maintain the tone and style.\n\n### Continuation:\n${currentValue.trim()}`;
    }

    // Build full prompt
    const fullPrompt = `${systemPrompt.trim()}\n\n${generationPrompt}`;

    const requestBody: KoboldGenerateRequest = {
        prompt: fullPrompt,
        max_length: params.maxTokens,
        temperature: params.temperature,
        top_p: 0.95,
        typical_p: 1,
        typical: 1,
        min_p: 0.05,
        repetition_penalty: 1.1,
        frequency_penalty: 0,
        presence_penalty: 0,
        top_k: 40,
        skew: 0,
        min_length: 0,
        min_tokens: 0,
        num_beams: 1,
        length_penalty: 1,
        early_stopping: false,
        add_bos_token: true,
        smoothing_factor: 0,
        smoothing_curve: 1,
        dry_allowed_length: 2,
        dry_multiplier: 1.25,
        dry_base: 1.75,
        dry_sequence_breakers: "[\"\\n\",\":\",\"\\\"\",\"*\"]",
        dry_penalty_last_n: 0,
        max_tokens_second: 0,
        sampler_priority: [
            "repetition_penalty",
            "presence_penalty",
            "frequency_penalty",
            "dry",
            "temperature",
            "dynamic_temperature",
            "quadratic_sampling",
            "top_n_sigma",
            "top_k",
            "top_p",
            "typical_p",
            "epsilon_cutoff",
            "eta_cutoff",
            "tfs",
            "top_a",
            "min_p",
            "mirostat",
            "xtc",
            "encoder_repetition_penalty",
            "no_repeat_ngram"
        ],
        truncation_length: 8192,
        ban_eos_token: false,
        skip_special_tokens: true,
        include_reasoning: false,
        top_a: 0,
        tfs: 1,
        epsilon_cutoff: 0,
        eta_cutoff: 0,
        mirostat_mode: 0,
        mirostat_tau: 5,
        mirostat_eta: 0.1,
        custom_token_bans: "",
        banned_strings: [],
        api_type: "ooba",
        api_server: "http://127.0.0.1:5001/",
        xtc_threshold: 0.1,
        xtc_probability: 0,
        nsigma: 0,
        top_n_sigma: 0,
        min_keep: 0,
        adaptive_target: -0.01,
        adaptive_decay: 0.9,
        rep_pen: 1.1,
        rep_pen_range: 0,
        repetition_penalty_range: 0,
        encoder_repetition_penalty: 1,
        no_repeat_ngram_size: 0,
        penalty_alpha: 0,
        temperature_last: true,
        do_sample: true,
        guidance_scale: 1,
        negative_prompt: "",
        repeat_penalty: 1.1,
        repeat_last_n: 0,
        n_predict: 200,
        num_predict: 200,
        num_ctx: 8192,
        mirostat: 0,
        ignore_eos: false,
        n_probs: 10,
        rep_pen_slope: 1,
        stream: true
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal
        });

        if (!response.ok) {
            throw new Error(`LLM API error: ${response.statusText}`);
        }

        const data: KoboldGenerateResponse = await response.json();
        if (mode === "continue") {
            return `${currentValue.trim()}${data.results[0]?.text || ""}`;
        }
        return data.results[0]?.text || "";
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            return "";
        }
        console.error("Failed to generate text:", error);
        throw error;
    }
}
