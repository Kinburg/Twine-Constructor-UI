import { useState, useEffect, useRef } from 'react';
import { useEditorPrefsStore } from '../../store/editorPrefsStore';
import { useT } from '../../i18n';
import { type LLMProvider, fetchGeminiModels, classifyModel, type GeminiModelWithTier } from '../../utils/llm';
import { fsApi } from '../../lib/fsApi';
import { toast } from 'sonner';

interface Props {
  onClose: () => void;
}

// ── System prompt presets ─────────────────────────────────────────────────────

const SYSTEM_PROMPT_PRESETS = [
  {
    label: 'Storyteller (default)',
    value: 'You are a professional storyteller. Write a continuation of the story based on the context provided. Maintain the tone and style of the existing text.',
  },
  {
    label: 'Literary novelist',
    value: 'You are a literary author crafting immersive prose fiction. Continue the narrative with rich sensory detail, deep psychological insight, and elegant language. Match the established voice precisely.',
  },
  {
    label: 'Visual novel writer',
    value: 'You are writing dialogue and narration for a visual novel. Keep prose concise and punchy. Convey emotion through character reactions and subtext. End naturally for player pacing.',
  },
  {
    label: 'Horror & suspense',
    value: 'You are a horror writer. Build dread through atmosphere, ambiguity, and the unseen. Use short, tense sentences during high-stress moments. Never explain the horror fully.',
  },
  {
    label: 'Fantasy & adventure',
    value: 'You are writing high-fantasy adventure fiction. Embrace vivid world-building, heroic action, and mythic language. Keep the momentum going and the stakes clear.',
  },
  {
    label: 'Dialogue-focused',
    value: 'You are writing character dialogue for a visual novel. Each character must have a distinct voice and speech pattern. Dialogue should feel natural, emotionally resonant, and advance the relationship or plot.',
  },
  {
    label: 'Romance',
    value: 'You are writing a romance story. Focus on emotional tension, chemistry between characters, and meaningful moments. Use sensory detail to convey longing and connection.',
  },
  {
    label: 'Sci-fi',
    value: 'You are writing science fiction. Ground fantastical elements in consistent internal logic. Balance wonder with plausibility. Explore the human dimension of technological or cosmic themes.',
  },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function AISettingsModal({ onClose }: Props) {
  const t = useT();
  const llm = t.llmSettingsModal;
  const ep = t.editorPrefs;
  const {
    setPrefs,
    llmEnabled,
    llmProvider,
    llmUrl,
    llmGeminiApiKey,
    llmGeminiModel,
    llmGeminiModelsList,
    llmOpenaiUrl,
    llmOpenaiApiKey,
    llmOpenaiModel,
    llmMaxTokens,
    llmTemperature,
    llmSystemPrompt,
    llmFilterThought,
    llmGenerationHistory,
    imageGenProvider,
    comfyUiUrl,
    comfyUiWorkflowsDir,
    pollinationsModel,
    pollinationsToken,
  } = useEditorPrefsStore();

  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<GeminiModelWithTier[]>([]);
  const [isCustomModel, setIsCustomModel] = useState(!llmGeminiModelsList.includes(llmGeminiModel));
  const [presetsOpen, setPresetsOpen] = useState(false);
  const presetsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!llmGeminiModelsList.includes(llmGeminiModel) && !isCustomModel) {
      setIsCustomModel(true);
    }
  }, [isCustomModel, llmGeminiModel, llmGeminiModelsList]);

  // Close presets dropdown on outside click
  useEffect(() => {
    if (!presetsOpen) return;
    const handler = (e: MouseEvent) => {
      if (!presetsRef.current?.contains(e.target as Node)) setPresetsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [presetsOpen]);

  const toggle = (key: 'llmEnabled' | 'llmFilterThought') => {
    if (key === 'llmEnabled') {
      setPrefs({ llmEnabled: !llmEnabled });
    } else if (key === 'llmFilterThought') {
      setPrefs({ llmFilterThought: !llmFilterThought });
    }
  };

  const handleModelChange = (val: string) => {
    if (val === 'custom') {
      setIsCustomModel(true);
    } else {
      setIsCustomModel(false);
      setPrefs({ llmGeminiModel: val });
    }
  };

  const handleRefreshModels = async () => {
    if (!llmGeminiApiKey) {
      toast.error("Please enter an API Key first");
      return;
    }
    setFetchingModels(true);
    try {
      const models = await fetchGeminiModels(llmGeminiApiKey);
      const modelNames = models.map(m => m.name);

      setFetchedModels(models);
      setPrefs({ llmGeminiModelsList: modelNames });
      toast.success(`Fetched ${modelNames.length} text models`);

      if (modelNames.includes(llmGeminiModel)) {
        setIsCustomModel(false);
      }
    } catch (e) {
      toast.error("Failed to fetch models. Check your API Key.");
    } finally {
      setFetchingModels(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-[500px] flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
          <h2 className="text-sm font-semibold text-white">{llm.title}</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors cursor-pointer text-base leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-5">

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between gap-4 pb-2 border-b border-slate-700">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{ep.llmEnabled}</span>
            <Toggle value={llmEnabled} onChange={() => toggle('llmEnabled')} />
          </div>

          <div className={`flex flex-col gap-5 transition-opacity duration-200 ${llmEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>

            {/* Provider Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-300">LLM Provider</label>
              <select
                value={llmProvider}
                onChange={e => setPrefs({ llmProvider: e.target.value as LLMProvider })}
                className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="koboldcpp">KoboldCPP (Local)</option>
                <option value="gemini">Google Gemini (Cloud)</option>
                <option value="openai">OpenAI Compatible</option>
              </select>
            </div>

            {/* KoboldCPP Settings */}
            {llmProvider === 'koboldcpp' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-300">API URL (KoboldCPP)</label>
                <input
                  type="text"
                  value={llmUrl}
                  onChange={e => setPrefs({ llmUrl: e.target.value })}
                  placeholder="http://localhost:5001/api/v1/generate"
                  className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {/* Gemini Settings */}
            {llmProvider === 'gemini' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-300">API Key (Gemini)</label>
                  <PasswordInput
                    value={llmGeminiApiKey}
                    onChange={e => setPrefs({ llmGeminiApiKey: e.target.value })}
                    placeholder="Enter your Gemini API Key"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-300">Gemini Model</label>
                    <button
                      onClick={handleRefreshModels}
                      disabled={fetchingModels}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {fetchingModels ? 'Fetching...' : 'Refresh Models'}
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <GeminiModelSelect
                      modelNames={llmGeminiModelsList}
                      fetchedModels={fetchedModels}
                      value={isCustomModel ? 'custom' : llmGeminiModel}
                      onChange={handleModelChange}
                    />

                    {isCustomModel && (
                      <input
                        type="text"
                        value={llmGeminiModel}
                        onChange={e => setPrefs({ llmGeminiModel: e.target.value })}
                        placeholder="Enter custom model name (e.g. models/gemini-2.0-preview)"
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500 animate-in fade-in slide-in-from-top-1 duration-200"
                        autoFocus
                      />
                    )}
                  </div>
                </div>
              </>
            )}

            {/* OpenAI Compatible Settings */}
            {llmProvider === 'openai' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-300">Endpoint URL</label>
                  <input
                    type="text"
                    value={llmOpenaiUrl}
                    onChange={e => setPrefs({ llmOpenaiUrl: e.target.value })}
                    placeholder="https://api.openai.com/v1/chat/completions"
                    className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500">Works with OpenAI, Ollama, LM Studio, text-generation-webui, etc.</span>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-300">API Key (optional for local servers)</label>
                  <PasswordInput
                    value={llmOpenaiApiKey}
                    onChange={e => setPrefs({ llmOpenaiApiKey: e.target.value })}
                    placeholder="sk-..."
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-300">Model Name</label>
                  <input
                    type="text"
                    value={llmOpenaiModel}
                    onChange={e => setPrefs({ llmOpenaiModel: e.target.value })}
                    placeholder="gpt-4o-mini"
                    className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </>
            )}

            {/* Filter Thought Toggle */}
            <div className="flex items-center justify-between gap-4 pb-2 border-b border-slate-700">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Filter LLM Thoughts</span>
              <Toggle value={llmFilterThought} onChange={() => toggle('llmFilterThought')} />
            </div>

            {/* Max Tokens and Temperature */}
            <div className="flex gap-4">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-xs text-slate-300">{llm.maxTokensLabel}</label>
                <input
                  type="number"
                  value={llmMaxTokens}
                  onChange={e => setPrefs({ llmMaxTokens: parseInt(e.target.value) || 100 })}
                  className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-xs text-slate-300">{llm.temperatureLabel}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="2.0"
                  value={llmTemperature}
                  onChange={e => setPrefs({ llmTemperature: parseFloat(e.target.value) || 0.7 })}
                  className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* System Prompt */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-300">{llm.systemPromptLabel}</label>
                {/* Presets dropdown */}
                <div className="relative" ref={presetsRef}>
                  <button
                    type="button"
                    onClick={() => setPresetsOpen(v => !v)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer flex items-center gap-0.5"
                  >
                    Presets ▾
                  </button>
                  {presetsOpen && (
                    <div className="absolute right-0 top-full mt-1 z-10 bg-slate-900 border border-slate-600 rounded shadow-lg min-w-[200px] py-1">
                      {SYSTEM_PROMPT_PRESETS.map(p => (
                        <button
                          key={p.label}
                          type="button"
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                          onClick={() => {
                            setPrefs({ llmSystemPrompt: p.value });
                            setPresetsOpen(false);
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <textarea
                value={llmSystemPrompt}
                onChange={e => setPrefs({ llmSystemPrompt: e.target.value })}
                placeholder={llm.systemPromptPlaceholder}
                className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500 min-h-[100px]"
              />
              <div className="text-right text-[10px] text-slate-500 tabular-nums">
                {llmSystemPrompt.length} chars
              </div>
            </div>

            {/* Image Generation Section */}
            <div className="flex flex-col gap-3 pt-1 border-t border-slate-700">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{llm.imageGenSectionLabel}</span>

              {/* Generation History */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-300">Generation History Storage</label>
                <select
                    value={llmGenerationHistory}
                    onChange={e => setPrefs({ llmGenerationHistory: e.target.value as 'memory' | 'project' | 'disabled' })}
                    className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="memory">In memory (lost on reload)</option>
                  <option value="project">In project file (persistent)</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              {/* Default Provider */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-300">{llm.imageGenProviderLabel}</label>
                <select
                  value={imageGenProvider}
                  onChange={e => setPrefs({ imageGenProvider: e.target.value as 'comfyui' | 'pollinations' })}
                  className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="comfyui">ComfyUI</option>
                  <option value="pollinations">Pollinations.AI (free)</option>
                </select>
              </div>

              {imageGenProvider === 'comfyui' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-300">{llm.comfyUiUrlLabel}</label>
                  <input
                    type="text"
                    value={comfyUiUrl}
                    onChange={e => setPrefs({ comfyUiUrl: e.target.value })}
                    placeholder={llm.comfyUiUrlPlaceholder}
                    className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {imageGenProvider === 'pollinations' && (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-300">{llm.pollinationsModelLabel}</label>
                    <input
                      type="text"
                      value={pollinationsModel}
                      onChange={e => setPrefs({ pollinationsModel: e.target.value })}
                      placeholder={llm.pollinationsModelPlaceholder}
                      className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-300">{llm.pollinationsTokenLabel}</label>
                    <PasswordInput
                      value={pollinationsToken}
                      onChange={e => setPrefs({ pollinationsToken: e.target.value })}
                      placeholder={llm.pollinationsTokenPlaceholder}
                    />
                  </div>
                </>
              )}
            </div>

            {/* ComfyUI Workflows Folder */}
            <div className="flex flex-col gap-1 pt-1 border-t border-slate-700">
              <label className="text-xs text-slate-300">{llm.comfyUiWorkflowsDirLabel}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={comfyUiWorkflowsDir}
                  onChange={e => setPrefs({ comfyUiWorkflowsDir: e.target.value })}
                  placeholder={llm.comfyUiWorkflowsDirPlaceholder}
                  className="flex-1 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  className="px-2 py-1.5 text-xs rounded bg-slate-600 hover:bg-slate-500 text-slate-200 transition-colors cursor-pointer shrink-0"
                  onClick={async () => {
                    const dir = await fsApi.openFolderDialog();
                    if (dir) setPrefs({ comfyUiWorkflowsDir: dir });
                  }}
                >
                  {llm.comfyUiWorkflowsDirBrowse}
                </button>
              </div>
              <span className="text-[10px] text-slate-500">{llm.comfyUiWorkflowsDirHint}</span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-700 shrink-0">
          <button
            className="w-full py-1.5 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors cursor-pointer"
            onClick={onClose}
          >
            {t.common.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PasswordInput ─────────────────────────────────────────────────────────────

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-2 py-1.5 pr-8 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible(v => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        aria-label={visible ? 'Hide' : 'Show'}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

// ── GeminiModelSelect ─────────────────────────────────────────────────────────

const TIER_LABELS: Record<string, string> = {
  free: 'Free',
  'free-limited': 'Free (with limits)',
  paid: 'Paid',
  experimental: 'Experimental / Preview',
};

const TIER_ORDER = ['free', 'free-limited', 'paid', 'experimental'];

function GeminiModelSelect({
  modelNames,
  fetchedModels,
  value,
  onChange,
}: {
  modelNames: string[];
  fetchedModels: GeminiModelWithTier[];
  value: string;
  onChange: (v: string) => void;
}) {
  // displayName lookup — only available after a manual refresh (optional enhancement)
  const displayByName = new Map(fetchedModels.map(m => [m.name, m.displayName]));

  // Tier is always derived from the model name — no refresh needed
  const grouped = new Map<string, string[]>();
  for (const name of modelNames) {
    const tier = classifyModel(name);
    if (!grouped.has(tier)) grouped.set(tier, []);
    grouped.get(tier)!.push(name);
  }
  const hasGroups = grouped.size > 1;

  const renderOption = (name: string) => (
    <option key={name} value={name}>
      {displayByName.get(name) ?? name.replace('models/', '')}
    </option>
  );

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
    >
      {hasGroups ? (
        TIER_ORDER.filter(t => grouped.has(t)).map(tier => (
          <optgroup key={tier} label={TIER_LABELS[tier]}>
            {grouped.get(tier)!.map(renderOption)}
          </optgroup>
        ))
      ) : (
        modelNames.map(renderOption)
      )}
      <option value="custom">-- Custom model name --</option>
    </select>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
        value ? 'bg-indigo-600' : 'bg-slate-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          value ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function EyeIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}
