import { useEditorPrefsStore } from '../../store/editorPrefsStore';
import { useT } from '../../i18n';

interface Props {
  onClose: () => void;
}

export function LLMSettingsModal({ onClose }: Props) {
  const t = useT();
  const llm = t.llmSettingsModal;
  const { setPrefs, llmUrl, llmMaxTokens, llmTemperature, llmSystemPrompt } = useEditorPrefsStore();

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

          {/* KoboldCPP API URL */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-300">{llm.urlLabel}</label>
            <input
              type="text"
              value={llmUrl}
              onChange={e => setPrefs({ llmUrl: e.target.value })}
              className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
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
