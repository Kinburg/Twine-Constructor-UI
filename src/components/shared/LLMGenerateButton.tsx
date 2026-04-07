import { useState } from 'react';
import { useEditorPrefsStore } from '../../store/editorPrefsStore';
import { useProjectStore } from '../../store/projectStore';
import { generateText, type LLMMode } from '../../utils/llmApi';
import { toast } from 'sonner';

interface Props {
  sceneId: string;
  blockId: string;
  currentValue: string;
  onGenerated: (text: string) => void;
}

export function LLMGenerateButton({ sceneId, blockId, currentValue, onGenerated }: Props) {
  const { llmEnabled, llmUrl, llmMaxTokens, llmTemperature, llmSystemPrompt } = useEditorPrefsStore();
  const { project } = useProjectStore();
  const [loading, setLoading] = useState<LLMMode | null>(null);

  if (!llmEnabled) return null;

  const handleGenerate = async (mode: LLMMode) => {
    const scene = project.scenes.find(s => s.id === sceneId);
    if (!scene) return;

    setLoading(mode);
    try {
      const result = await generateText(
        llmUrl,
        llmSystemPrompt,
        project,
        scene,
        blockId,
        currentValue,
        {
          maxTokens: llmMaxTokens,
          temperature: llmTemperature,
        },
        mode
      );

      if (result) {
        onGenerated(result.trim());
      }
    } catch (error) {
      toast.error("Failed to generate text. Check your LLM settings and connection.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-0.5">
      {/* Continue Generation */}
      <button
        onClick={() => handleGenerate('continue')}
        disabled={!!loading}
        className={`p-1 rounded transition-colors flex items-center justify-center ${
          loading === 'continue'
            ? 'text-indigo-400 bg-slate-700/50 cursor-wait' 
            : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-700 cursor-pointer'
        }`}
        title="Continue generation"
      >
        {loading === 'continue' ? <LoadingIcon /> : <GenerateIcon />}
      </button>

      {/* Rephrase / Improve */}
      <button
        onClick={() => handleGenerate('rephrase')}
        disabled={!!loading || !currentValue.trim()}
        className={`p-1 rounded transition-colors flex items-center justify-center ${
          loading === 'rephrase'
            ? 'text-emerald-400 bg-slate-700/50 cursor-wait' 
            : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed'
        }`}
        title="Rephrase and improve text"
      >
        {loading === 'rephrase' ? <LoadingIcon /> : <RephraseIcon />}
      </button>

      {/* Generate from Hint */}
      <button
        onClick={() => handleGenerate('hint')}
        disabled={!!loading || !currentValue.trim()}
        className={`p-1 rounded transition-colors flex items-center justify-center ${
          loading === 'hint'
            ? 'text-amber-400 bg-slate-700/50 cursor-wait' 
            : 'text-slate-400 hover:text-amber-400 hover:bg-slate-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed'
        }`}
        title="Generate based on this hint/instruction"
      >
        {loading === 'hint' ? <LoadingIcon /> : <HintIcon />}
      </button>
    </div>
  );
}

function LoadingIcon() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function GenerateIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function RephraseIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function HintIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}
