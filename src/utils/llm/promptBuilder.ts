import type {Scene, Character, Project} from '../../types';
import type {LLMMode, StructuredPrompt} from './types';

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
 * Constructs a structured prompt for LLM generation.
 * Returns separate system instruction, user prompt, and continuation prefix
 * so that each provider can use them appropriately.
 */
export function constructGenerationPrompt(
    systemPrompt: string,
    project: Project,
    scene: Scene,
    blockId: string,
    currentValue: string,
    mode: LLMMode
): StructuredPrompt {
    const context = buildSceneContext(scene, project.characters, blockId);
    const targetBlock = scene.blocks.find(b => b.id === blockId);

    // --- System Instruction: system prompt + lore + character info ---
    let systemInstruction = systemPrompt.trim();

    if (project.lore) {
        systemInstruction += `\n\n### Story Lore:\n${project.lore}`;
    }

    if (targetBlock?.type === 'dialogue') {
        const char = project.characters.find(c => c.id === targetBlock.characterId);
        if (char) {
            systemInstruction += `\n\n### Character Info:\nName: ${char.name}`;
            if (char.llm_descr) {
                systemInstruction += `\nPersonality/Description: ${char.llm_descr}`;
            }
        }
    }

    // --- User Prompt: context + task ---
    let userPrompt = "";

    if (context) {
        userPrompt += `### Story Context (Previous events):\n${context}\n\n`;
    }

    userPrompt += `### Current Task:\n`;

    // Block-type-specific writing style instruction
    let styleInstruction: string;
    if (targetBlock?.type === 'dialogue') {
        const char = project.characters.find(c => c.id === targetBlock?.characterId);
        const charName = char?.name || 'the character';
        styleInstruction = `Write it as a ${charName}'s phrase. Do not use "${charName}:" and quotation marks.`;
    } else {
        styleInstruction = `Write it as an author of the story. Do not write dialogues or character's speeches. Write only descriptions of actions, objects and progression through the plot.`;
    }

    // Continuation prefix (used by completion-style models like KoboldCPP)
    let continuationPrefix = "";

    if (mode === 'rephrase') {
        userPrompt += `Rephrase, improve, and expand the following text. `;
        if (targetBlock?.type === 'dialogue') {
            userPrompt += `Make sure the speech strictly matches the character's personality and style. `;
            userPrompt += styleInstruction;
        } else {
            userPrompt += styleInstruction;
        }
        userPrompt += ` Return ONLY the improved text.\n\nSYSTEM: [Text to improve:\n${currentValue.trim()}]\n`;
    } else if (mode === 'hint') {
        userPrompt += `Generate a text based on the following hint and instruction. `;
        userPrompt += styleInstruction;
        userPrompt += ` Return ONLY the generated content, do not repeat the instruction.\n\nSYSTEM: [Take the following into special consideration for your next message: ${currentValue.trim()}]\n`;
    } else {
        // continue
        userPrompt += `Continue the story from where the text below ends. `;
        userPrompt += styleInstruction;
        userPrompt += ` Maintain the tone and style.\n`;
        userPrompt += `Do NOT repeat or echo any part of the existing text. Write ONLY the new continuation that comes after the last line.\n\n`;
        userPrompt += `### Text so far:\n${currentValue.trim()}\n\n`;
        userPrompt += `### Continue from here:\n`;

        continuationPrefix = currentValue.trim();
    }

    return {
        systemInstruction,
        userPrompt,
        continuationPrefix,
    };
}
