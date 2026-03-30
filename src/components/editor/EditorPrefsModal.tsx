import { useEditorPrefsStore } from '../../store/editorPrefsStore';
import { useT } from '../../i18n';
import { useState, useEffect, useCallback } from 'react';

const AUTOSAVE_INTERVALS = [1, 5, 10, 30] as const;

interface Props {
  onClose: () => void;
}

export function EditorPrefsModal({ onClose }: Props) {
  const t  = useT();
  const ep = t.editorPrefs;
  const { setPrefs, ...prefs } = useEditorPrefsStore();

  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  const hasTitleBarControl = !!api?.getTitleBarStyle;
  const [titleBarStyle, setTitleBarStyleState] = useState<'custom' | 'native'>('custom');

  useEffect(() => {
    if (!api?.getTitleBarStyle) return;
    api.getTitleBarStyle().then(s => setTitleBarStyleState(s));
  }, []);

  const toggle = (key: keyof typeof prefs) =>
    setPrefs({ [key]: !prefs[key] } as any);

  const handleTitleBarStyleChange = (style: 'custom' | 'native') => {
    if (!api?.setTitleBarStyle || style === titleBarStyle) return;
    api.setTitleBarStyle(style);
  };

  // ── Workspace presets ──────────────────────────────────────────────────────
  const [presets, setPresets] = useState<WorkspacePresetInfo[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [newPresetName, setNewPresetName] = useState('');

  const loadPresets = useCallback(() => {
    if (!api?.getWindowLayout) return;
    api.getWindowLayout().then(data => {
      setPresets(data.workspacePresets);
      setActivePresetId(data.activePresetId);
    });
  }, [api]);

  useEffect(() => { loadPresets(); }, [loadPresets]);

  const handleSavePreset = () => {
    const name = newPresetName.trim();
    if (!name || !api?.saveWorkspacePreset) return;
    api.saveWorkspacePreset(name).then(() => {
      setNewPresetName('');
      loadPresets();
    });
  };

  const handleApplyPreset = (id: string) => {
    if (!api?.applyWorkspacePreset) return;
    api.applyWorkspacePreset(id).then(() => {
      setActivePresetId(id);
    });
  };

  const handleOverwritePreset = (id: string) => {
    if (!api?.overwriteWorkspacePreset) return;
    api.overwriteWorkspacePreset(id).then(() => {
      setActivePresetId(id);
      loadPresets();
    });
  };

  const handleDeletePreset = (id: string) => {
    if (!api?.deleteWorkspacePreset) return;
    api.deleteWorkspacePreset(id).then(() => loadPresets());
  };

  const builtInPresets = presets.filter(p => p.builtIn);
  const userPresets    = presets.filter(p => !p.builtIn);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-[460px] flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
          <h2 className="text-sm font-semibold text-white">{ep.title}</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors cursor-pointer text-base leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-5">

          {/* ── Autosave ──────────────────────────────────────────────────── */}
          <Section title={ep.sectionAutosave}>
            <Row label={ep.autosaveLabel}>
              <Toggle value={prefs.autosave} onChange={() => toggle('autosave')} />
            </Row>
            {prefs.autosave && (
              <Row label={ep.autosaveIntervalLabel}>
                <div className="flex gap-1">
                  {AUTOSAVE_INTERVALS.map(n => (
                    <button
                      key={n}
                      onClick={() => setPrefs({ autosaveInterval: n })}
                      className={`px-2.5 py-1 rounded text-xs cursor-pointer transition-colors border ${
                        prefs.autosaveInterval === n
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {ep.intervalMinutes(n)}
                    </button>
                  ))}
                </div>
              </Row>
            )}
            <Row label={ep.saveOnExitLabel}>
              <Toggle value={prefs.saveOnExit} onChange={() => toggle('saveOnExit')} />
            </Row>
          </Section>

          {/* ── Appearance ────────────────────────────────────────────────── */}
          <Section title={ep.sectionAppearance}>
            <Row label={ep.compactModeLabel}>
              <Toggle value={prefs.compactMode} onChange={() => toggle('compactMode')} />
            </Row>
            {hasTitleBarControl && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-300">{ep.titleBarStyleLabel}</span>
                <div className="flex flex-col gap-1 pl-1">
                  {(['custom', 'native'] as const).map(style => (
                    <button
                      key={style}
                      onClick={() => handleTitleBarStyleChange(style)}
                      className={`flex items-center gap-2 text-xs px-3 py-2 rounded border cursor-pointer transition-colors text-left ${
                        titleBarStyle === style
                          ? 'bg-indigo-900/40 border-indigo-600 text-indigo-200'
                          : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-400'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                        titleBarStyle === style
                          ? 'border-indigo-400 bg-indigo-400'
                          : 'border-slate-500 bg-transparent'
                      }`} />
                      <span className="flex-1">{style === 'custom' ? ep.titleBarStyleCustom : ep.titleBarStyleNative}</span>
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-slate-500 pl-1">{ep.titleBarStyleRestartNote}</span>
              </div>
            )}
          </Section>

          {/* ── Confirm on delete ─────────────────────────────────────────── */}
          <Section title={ep.sectionConfirms}>
            <Row label={ep.confirmDeleteScene}>
              <Toggle value={prefs.confirmDeleteScene} onChange={() => toggle('confirmDeleteScene')} />
            </Row>
            <Row label={ep.confirmDeleteGroup}>
              <Toggle value={prefs.confirmDeleteGroup} onChange={() => toggle('confirmDeleteGroup')} />
            </Row>
            <Row label={ep.confirmDeleteVariable}>
              <Toggle value={prefs.confirmDeleteVariable} onChange={() => toggle('confirmDeleteVariable')} />
            </Row>
            <Row label={ep.confirmDeleteWatcher}>
              <Toggle value={prefs.confirmDeleteWatcher} onChange={() => toggle('confirmDeleteWatcher')} />
            </Row>
            <Row label={ep.confirmDeleteBlock}>
              <Toggle value={prefs.confirmDeleteBlock} onChange={() => toggle('confirmDeleteBlock')} />
            </Row>
            <Row label={ep.confirmDeleteCharacter}>
              <Toggle value={prefs.confirmDeleteCharacter} onChange={() => toggle('confirmDeleteCharacter')} />
            </Row>
          </Section>

          {/* ── Group deletion behaviour ──────────────────────────────────── */}
          <Section title={ep.sectionGroupDelete}>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">{ep.deleteGroupBehaviorLabel}</span>
              <div className="flex flex-col gap-1 pl-1">
                {([false, true] as const).map(withScenes => (
                  <button
                    key={String(withScenes)}
                    onClick={() => setPrefs({ deleteGroupWithScenes: withScenes })}
                    className={`flex items-center gap-2 text-xs px-3 py-2 rounded border cursor-pointer transition-colors text-left ${
                      prefs.deleteGroupWithScenes === withScenes
                        ? 'bg-indigo-900/40 border-indigo-600 text-indigo-200'
                        : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                      prefs.deleteGroupWithScenes === withScenes
                        ? 'border-indigo-400 bg-indigo-400'
                        : 'border-slate-500 bg-transparent'
                    }`} />
                    {withScenes ? ep.deleteGroupWithScenes : ep.deleteGroupUngroup}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* ── Export ────────────────────────────────────────────────────── */}
          <Section title={ep.sectionExport}>
            <Row label={ep.confirmOpenFolderAfterExport}>
              <Toggle value={prefs.confirmOpenFolderAfterExport} onChange={() => toggle('confirmOpenFolderAfterExport')} />
            </Row>
          </Section>

          {/* ── Window Layout ────────────────────────────────────────────── */}
          {api?.getWindowLayout && (
            <Section title={ep.sectionWindowLayout}>
              {/* Active indicator */}
              <div className="text-xs text-slate-400">
                {ep.activePresetLabel}{' '}
                <span className="text-slate-200">
                  {presets.find(p => p.id === activePresetId)?.name ?? ep.customLayout}
                </span>
              </div>

              {/* Built-in presets */}
              {builtInPresets.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">{ep.builtInPresets}</span>
                  {builtInPresets.map(p => (
                    <PresetRow
                      key={p.id}
                      preset={p}
                      isActive={p.id === activePresetId}
                      ep={ep}
                      onApply={handleApplyPreset}
                    />
                  ))}
                </div>
              )}

              {/* User presets */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">{ep.userPresets}</span>
                {userPresets.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">{ep.noPresetsSaved}</div>
                ) : (
                  userPresets.map(p => (
                    <PresetRow
                      key={p.id}
                      preset={p}
                      isActive={p.id === activePresetId}
                      ep={ep}
                      onApply={handleApplyPreset}
                      onOverwrite={handleOverwritePreset}
                      onDelete={handleDeletePreset}
                    />
                  ))
                )}
              </div>

              {/* Save current layout */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPresetName}
                  onChange={e => setNewPresetName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSavePreset(); }}
                  placeholder={ep.presetNamePlaceholder}
                  className="flex-1 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 min-w-0"
                />
                <button
                  onClick={handleSavePreset}
                  disabled={!newPresetName.trim()}
                  className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs cursor-pointer transition-colors shrink-0"
                >
                  {ep.saveCurrentLayout}
                </button>
              </div>
            </Section>
          )}

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

// ─── Small helpers ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700 pb-1">
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-slate-300">{label}</span>
      {children}
    </div>
  );
}

function PresetRow({ preset, isActive, ep, onApply, onOverwrite, onDelete }: {
  preset: WorkspacePresetInfo;
  isActive: boolean;
  ep: { applyPreset: string; overwritePreset: string; deletePreset: string };
  onApply: (id: string) => void;
  onOverwrite?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 text-xs px-3 py-2 rounded border transition-colors ${
        isActive
          ? 'bg-indigo-900/40 border-indigo-600 text-indigo-200'
          : 'bg-slate-700/50 border-slate-600 text-slate-300'
      }`}
    >
      <span className="flex-1 truncate">{preset.name}</span>
      <button
        onClick={() => onApply(preset.id)}
        className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] cursor-pointer transition-colors shrink-0"
      >
        {ep.applyPreset}
      </button>
      {onOverwrite && (
        <button
          onClick={() => onOverwrite(preset.id)}
          className="px-2 py-0.5 rounded bg-slate-600 hover:bg-amber-600 text-slate-300 hover:text-white text-[10px] cursor-pointer transition-colors shrink-0"
        >
          {ep.overwritePreset}
        </button>
      )}
      {onDelete && (
        <button
          onClick={() => onDelete(preset.id)}
          className="px-2 py-0.5 rounded bg-slate-600 hover:bg-red-600 text-slate-300 hover:text-white text-[10px] cursor-pointer transition-colors shrink-0"
        >
          {ep.deletePreset}
        </button>
      )}
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
