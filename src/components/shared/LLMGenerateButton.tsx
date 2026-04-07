import { useState } from 'react';
import { useEditorPrefsStore } from '../../store/editorPrefsStore';
import { useProjectStore } from '../../store/projectStore';
import { buildSceneContext, generateText } from '../../utils/llmApi';
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
  const [loading, setLoading] = useState(false);

  if (!llmEnabled) return null;

  const handleGenerate = async () => {
    const scene = project.scenes.find(s => s.id === sceneId);
    if (!scene) return;

    setLoading(true);
    try {
      const context = buildSceneContext(scene, project.characters, blockId);
      
      const result = await generateText(
        llmUrl,
        llmSystemPrompt,
        context,
        currentValue,
        {
          maxTokens: llmMaxTokens,
          temperature: llmTemperature,
        }
      );

      if (result) {
        onGenerated(result);
      }
    } catch (error) {
      toast.error("Failed to generate text. Check your LLM settings and connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleGenerate}
      disabled={loading}
      className={`p-1 rounded transition-colors flex items-center justify-center ${
        loading 
          ? 'text-indigo-400 bg-slate-700/50 cursor-wait' 
          : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-700 cursor-pointer'
      }`}
      title="Generate with LLM"
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )}
    </button>
  );
}
