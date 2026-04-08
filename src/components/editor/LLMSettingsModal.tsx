import { useState, useEffect } from 'react';
import { useEditorPrefsStore } from '../../store/editorPrefsStore';
import { useT } from '../../i18n';
import { type LLMProvider, fetchGeminiModels } from '../../utils/llm';
import { toast } from 'sonner';

interface Props {
  onClose: () => void;
}

export function LLMSettingsModal({ onClose }: Props) {
  const t = useT();
  const llm = t.llmSettingsModal;
  const ep = t.editorPrefs;
  const { 
    setPrefs, 
    llmEnabled, 
    llmProvider,
    llmUrl, 
    llmGeminiModel,
    llmGeminiModelsList,
    llmMaxTokens, 
    llmTemperature, 
    llmSystemPrompt,
    llmFilterThought
  } = useEditorPrefsStore();

  // Local state for fetching status
  const [fetchingModels, setFetchingModels] = useState(false);
  const [isCustomModel, setIsCustomModel] = useState(!llmGeminiModelsList.includes(llmGeminiModel));

  // Sync custom model state if the model changes elsewhere or list updates
  useEffect(() => {
    if (!llmGeminiModelsList.includes(llmGeminiModel) && !isCustomModel) {
      setIsCustomModel(true);
    }
  }, [isCustomModel, llmGeminiModel, llmGeminiModelsList]);

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
    if (!llmUrl) {
      toast.error("Please enter an API Key first");
      return;
    }
    setFetchingModels(true);
    try {
      const models = await fetchGeminiModels(llmUrl);
      const modelNames = models.map(m => m.name);
      
      setPrefs({ llmGeminiModelsList: modelNames });
      toast.success(`Fetched ${modelNames.length} models`);
      
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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
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
              </select>
            </div>

            {/* URL or API Key Field */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-300">
                {llmProvider === 'koboldcpp' ? 'API URL (KoboldCPP)' : 'API Key (Gemini)'}
              </label>
              <input
                type={llmProvider === 'gemini' ? "password" : "text"}
                value={llmUrl}
                onChange={e => setPrefs({ llmUrl: e.target.value })}
                placeholder={llmProvider === 'koboldcpp' ? "http://localhost:5001/api/v1/generate" : "Enter your Gemini API Key"}
                className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Gemini Model Selection */}
            {llmProvider === 'gemini' && (
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
                  <select
                    value={isCustomModel ? 'custom' : llmGeminiModel}
                    onChange={e => handleModelChange(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {llmGeminiModelsList.map(m => (
                      <option key={m} value={m}>{m.replace('models/', '')}</option>
                    ))}
                    <option value="custom">-- Custom model name --</option>
                  </select>

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
              <label className="text-xs text-slate-300">{llm.systemPromptLabel}</label>
              <textarea
                value={llmSystemPrompt}
                onChange={e => setPrefs({ llmSystemPrompt: e.target.value })}
                placeholder={llm.systemPromptPlaceholder}
                className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500 min-h-[100px]"
              />
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
