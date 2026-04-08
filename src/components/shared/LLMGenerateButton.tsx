import { useState, useRef, useEffect, useCallback } from 'react';
import { useEditorPrefsStore } from '../../store/editorPrefsStore';
import { useProjectStore } from '../../store/projectStore';
import { generateText, abortGeneration, type LLMMode } from '../../utils/llm';
import { toast } from 'sonner';

interface Props {
  sceneId: string;
  blockId: string;
  currentValue: string;
  onGenerated: (text: string) => void;
}

export function LLMGenerateButton({ sceneId, blockId, currentValue, onGenerated }: Props) {
  const { 
    llmEnabled, 
    llmProvider,
    llmUrl, 
    llmGeminiModel,
    llmMaxTokens, 
    llmTemperature, 
    llmSystemPrompt,
    llmFilterThought
  } = useEditorPrefsStore();
  const { project, saveSnapshot } = useProjectStore();
  const [loading, setLoading] = useState<LLMMode | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const toggle = useCallback(() => {
    if (loading) {
      // 1. Abort the local fetch request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      // 2. Send explicit abort request to backend if needed
      abortGeneration(llmProvider, llmUrl);
      
      setLoading(null);
      toast.info("Generation stopped");
      return;
    }

    if (open) {
      setOpen(false);
      return;
    }
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const left = Math.min(rect.right - 220, window.innerWidth - 228);
      setPos({ top: rect.bottom + 2, left: Math.max(4, left) });
    }
    setOpen(true);
  }, [open, loading, llmUrl, llmProvider]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (buttonRef.current?.contains(e.target as Node) || menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', handler, true);
    return () => window.removeEventListener('scroll', handler, true);
  }, [open]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (!llmEnabled) return null;

  const handleGenerate = async (mode: LLMMode) => {
    const scene = project.scenes.find(s => s.id === sceneId);
    if (!scene) return;

    setOpen(false);
    setLoading(mode);
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await generateText(
        llmProvider,
        llmUrl,
        llmGeminiModel,
        llmSystemPrompt,
        project,
        scene,
        blockId,
        currentValue,
        {
          maxTokens: llmMaxTokens,
          temperature: llmTemperature,
          filterThought: llmFilterThought
        },
        mode,
        controller.signal
      );

      if (result) {
        saveSnapshot();
        onGenerated(result.trim());
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Just stopped by user
      } else {
        toast.error(`Failed to generate text. Check your ${llmProvider} settings and connection.`);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(null);
        abortControllerRef.current = null;
      }
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        className={`px-1.5 py-0.5 text-xs border rounded cursor-pointer transition-colors leading-none flex items-center justify-center ${
          open || loading
            ? 'text-indigo-400 bg-slate-700 border-indigo-500'
            : 'text-slate-500 hover:text-indigo-400 bg-slate-800 border-slate-600 hover:border-indigo-500'
        }`}
        title={loading ? "Stop generation" : "AI Generation Tools"}
      >
        {loading ? <StopLoadingIcon /> : <SparklesIcon />}
      </button>

      {open && pos && (
        <div
          ref={menuRef}
          className="fixed z-[9999] bg-slate-800 border border-slate-600 rounded shadow-lg overflow-hidden py-1"
          style={{ top: pos.top, left: pos.left, width: 220 }}
        >
          <MenuOption
            icon={<GenerateIcon />}
            label="Continue generation"
            onClick={() => handleGenerate('continue')}
            colorClass="text-indigo-400"
          />
          <MenuOption
            icon={<RephraseIcon />}
            label="Rephrase and improve"
            disabled={!currentValue.trim()}
            onClick={() => handleGenerate('rephrase')}
            colorClass="text-emerald-400"
          />
          <MenuOption
            icon={<HintIcon />}
            label="Generate from hint"
            disabled={!currentValue.trim()}
            onClick={() => handleGenerate('hint')}
            colorClass="text-amber-400"
          />
        </div>
      )}
    </>
  );
}

function MenuOption({ 
  icon, 
  label, 
  onClick, 
  disabled, 
  colorClass 
}: { 
  icon: React.ReactNode; 
  label: string; 
  onClick: () => void; 
  disabled?: boolean;
  colorClass: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      onClick={onClick}
    >
      <span className={`shrink-0 ${colorClass}`}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function StopLoadingIcon() {
  return (
    <div className="relative h-4 w-4 flex items-center justify-center">
      <svg className="animate-spin h-4 w-4 absolute" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <div className="h-1.5 w-1.5 bg-indigo-400 rounded-sm" />
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
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
