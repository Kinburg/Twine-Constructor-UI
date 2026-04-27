/**
 * Filters out internal thoughts/reasoning from the LLM output.
 * Handles common tags like <thought>, [thought], or lines starting with "Thought:".
 */
export function filterThought(text: string): string {
    let cleaned = text;

    // Remove <thought>...</thought> blocks (case insensitive, including newlines)
    cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '');

    // Remove [thought]...[/thought] blocks
    cleaned = cleaned.replace(/\[thought\][\s\S]*?\[\/thought\]/gi, '');

    // Remove lines starting with "Thought:" or "Reasoning:"
    cleaned = cleaned.replace(/^(Thought|Reasoning):.*$/gm, '');

    return cleaned.trim();
}
