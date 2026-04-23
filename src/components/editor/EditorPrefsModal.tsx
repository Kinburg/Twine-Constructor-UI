import { useEditorPrefsStore, BUILTIN_PANEL_PRESETS } from '../../store/editorPrefsStore';
import type { PanelLayoutPreset } from '../../store/editorPrefsStore';
import { useT, useLocaleStore, getLocales } from '../../i18n';
import { useState, useEffect, type ReactNode } from 'react';
import {
  ModalShell, ModalBody,
  Toggle, Segmented,
  INPUT_CLS,
} from '../shared/ModalShell';

const AUTOSAVE_INTERVALS = [1, 5, 10, 30] as const;

type TabId = 'appearance' | 'shortcuts' | 'workspace' | 'behavior';

interface Props {
  onClose: () => void;
}

export function EditorPrefsModal({ onClose }: Props) {
  const t  = useT();
  const ep = t.editorPrefs;
  const [tab, setTab] = useState<TabId>('appearance');

  // Tabs definition — labels from i18n if present, fallback to English
  const tabs: { id: TabId; label: string; icon: ReactNode }[] = [
    { id: 'appearance', label: (ep as any).tabAppearance ?? 'Appearance', icon: <IconPalette /> },
    { id: 'shortcuts',  label: (ep as any).tabShortcuts  ?? 'Shortcuts',  icon: <IconCommand /> },
    { id: 'workspace',  label: (ep as any).tabWorkspace  ?? 'Workspace',  icon: <IconLayout /> },
    { id: 'behavior',   label: (ep as any).tabBehavior   ?? 'Behavior',   icon: <IconCog /> },
  ];

  return (
    <ModalShell onClose={onClose} width={900} height={800}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-700">
        <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0">
          <IconCog />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-slate-100 leading-tight">{ep.title}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {(ep as any).subtitle ?? 'Purl — your personal editor settings'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-100 transition-colors p-1 -m-1 cursor-pointer"
          aria-label="Close"
        >
          <IconX />
        </button>
      </div>

      {/* ── Body: sidebar + content ────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <nav className="w-52 shrink-0 border-r border-slate-700 py-3 flex flex-col gap-0.5">
          {tabs.map(item => {
            const active = item.id === tab;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex items-center gap-2.5 px-4 py-2 text-sm text-left transition-colors cursor-pointer border-l-2 ${
                  active
                    ? 'bg-indigo-600/10 border-indigo-500 text-indigo-200'
                    : 'border-transparent text-slate-300 hover:bg-slate-700/40 hover:text-slate-100'
                }`}
              >
                <span className={active ? 'text-indigo-300' : 'text-slate-400'}>{item.icon}</span>
                <span className="flex-1 truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <ModalBody className="flex-1 gap-6 px-6 py-5">
          {tab === 'appearance' && <AppearanceTab />}
          {tab === 'shortcuts'  && <ShortcutsTab />}
          {tab === 'workspace'  && <WorkspaceTab />}
          {tab === 'behavior'   && <BehaviorTab />}
        </ModalBody>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-700">
        <span className="text-[11px] text-slate-500 font-mono">
          {(ep as any).footerHint ?? 'Settings saved locally'}
        </span>
        <button
          onClick={onClose}
          className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium cursor-pointer transition-colors"
        >
          {t.common.confirm}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Section helpers ───────────────────────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">
      {children}
    </h3>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <SectionLabel>{title}</SectionLabel>
      {children}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  APPEARANCE TAB
// ═══════════════════════════════════════════════════════════════════════════

function AppearanceTab() {
  const t  = useT();
  const ep = t.editorPrefs;
  const { compactMode, setPrefs } = useEditorPrefsStore();
  const { locale, setLocale } = useLocaleStore();
  const locales = getLocales();

  return (
    <>
      {/* Theme — dark only for now */}
      <Section title={(ep as any).sectionTheme ?? 'Editor theme'}>
        <div className="grid grid-cols-3 gap-3">
          <ThemeCard name={(ep as any).themeDark ?? 'Dark'} active swatch={['#0f172a', '#1e293b']} />
          <ThemeCard name={(ep as any).themeMidnight ?? 'Midnight'} locked swatch={['#020617', '#0b1220']} />
          <ThemeCard name={(ep as any).themeWarm ?? 'Warm'} locked swatch={['#1c1917', '#292524']} />
        </div>
      </Section>

      {/* Density (compactMode boolean → two-option segmented) */}
      <Section title={(ep as any).sectionDensity ?? 'Density'}>
        <Segmented
          value={compactMode ? 'compact' : 'comfortable'}
          onChange={v => setPrefs({ compactMode: v === 'compact' })}
          options={[
            { value: 'compact',     label: (ep as any).densityCompact     ?? 'Compact' },
            { value: 'comfortable', label: (ep as any).densityComfortable ?? 'Comfortable' },
          ]}
        />
      </Section>

      {/* Interface language */}
      <Section title={(ep as any).sectionLanguage ?? 'Interface language'}>
        <Segmented
          value={locale}
          onChange={setLocale}
          options={locales.map(l => ({ value: l.code, label: l.code.toUpperCase() }))}
        />
      </Section>
    </>
  );
}

function ThemeCard({
  name, swatch, active, locked,
}: {
  name: string;
  swatch: [string, string];
  active?: boolean;
  locked?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border overflow-hidden transition-all ${
        active
          ? 'border-indigo-500 ring-2 ring-indigo-500/30'
          : locked
          ? 'border-slate-700 opacity-50'
          : 'border-slate-600 hover:border-slate-400 cursor-pointer'
      }`}
    >
      <div
        className="h-20 w-full"
        style={{
          background: `linear-gradient(135deg, ${swatch[0]} 0%, ${swatch[1]} 100%)`,
        }}
      />
      <div className="px-3 py-2 flex items-center justify-between bg-slate-800/60">
        <span className="text-xs text-slate-200">{name}</span>
        {active && <span className="text-[10px] text-indigo-300">●</span>}
        {locked && <span className="text-[9px] text-slate-500 uppercase tracking-wider">soon</span>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  SHORTCUTS TAB (read-only)
// ═══════════════════════════════════════════════════════════════════════════

const SHORTCUT_GROUPS: { titleKey: string; fallback: string; items: [string, string][] }[] = [
  {
    titleKey: 'shortcutsGeneral',
    fallback: 'General',
    items: [
      ['Ctrl+S',       'Save project'],
      ['Ctrl+Z',       'Undo'],
      ['Ctrl+Shift+Z', 'Redo'],
      ['Ctrl+,',       'Open preferences'],
      ['Ctrl+Shift+P', 'Project settings'],
    ],
  },
  {
    titleKey: 'shortcutsEditor',
    fallback: 'Editor',
    items: [
      ['Ctrl+F',       'Find'],
      ['Ctrl+H',       'Replace'],
      ['Ctrl+/',       'Toggle comment'],
      ['Alt+↑ / Alt+↓', 'Move line'],
    ],
  },
  {
    titleKey: 'shortcutsNavigation',
    fallback: 'Navigation',
    items: [
      ['Ctrl+1..4',    'Switch workspace tab'],
      ['Ctrl+Tab',     'Next scene'],
      ['Ctrl+Shift+Tab','Previous scene'],
      ['Esc',          'Close modal / cancel'],
    ],
  },
];

function ShortcutsTab() {
  const t  = useT();
  const ep = t.editorPrefs;

  return (
    <>
      <p className="text-xs text-slate-400 -mt-1">
        {(ep as any).shortcutsHint ?? 'Reference only — editing is not supported yet.'}
      </p>
      {SHORTCUT_GROUPS.map(group => (
        <Section key={group.titleKey} title={(ep as any)[group.titleKey] ?? group.fallback}>
          <div className="rounded-md border border-slate-700 overflow-hidden">
            {group.items.map(([combo, desc], i) => (
              <div
                key={combo}
                className={`flex items-center justify-between px-3 py-2 text-xs ${
                  i > 0 ? 'border-t border-slate-700/60' : ''
                }`}
              >
                <span className="text-slate-300">{desc}</span>
                <kbd className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900/60 border border-slate-600 text-slate-200">
                  {combo}
                </kbd>
              </div>
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  WORKSPACE TAB
// ═══════════════════════════════════════════════════════════════════════════

function WorkspaceTab() {
  const t  = useT();
  const ep = t.editorPrefs;
  const {
    panelPresets, activePanelPresetId,
    savePanelPreset, applyPanelPreset, overwritePanelPreset, deletePanelPreset,
  } = useEditorPrefsStore();

  const [newPresetName, setNewPresetName] = useState('');
  const allPresets: PanelLayoutPreset[] = [...BUILTIN_PANEL_PRESETS, ...panelPresets];
  const builtInPresets = allPresets.filter(p => p.builtIn);
  const userPresets    = allPresets.filter(p => !p.builtIn);

  const handleSavePreset = () => {
    const name = newPresetName.trim();
    if (!name) return;
    savePanelPreset(name);
    setNewPresetName('');
  };

  return (
    <>
      <div className="text-xs text-slate-400">
        {ep.activePresetLabel}{' '}
        <span className="text-slate-200 font-medium">
          {allPresets.find(p => p.id === activePanelPresetId)?.name ?? ep.customLayout}
        </span>
      </div>

      {builtInPresets.length > 0 && (
        <Section title={ep.builtInPresets}>
          <div className="flex flex-col gap-1.5">
            {builtInPresets.map(p => (
              <PresetRow
                key={p.id}
                preset={p}
                isActive={p.id === activePanelPresetId}
                ep={ep}
                onApply={applyPanelPreset}
              />
            ))}
          </div>
        </Section>
      )}

      <Section title={ep.userPresets}>
        {userPresets.length === 0 ? (
          <div className="text-xs text-slate-500 italic py-2">{ep.noPresetsSaved}</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {userPresets.map(p => (
              <PresetRow
                key={p.id}
                preset={p}
                isActive={p.id === activePanelPresetId}
                ep={ep}
                onApply={applyPanelPreset}
                onOverwrite={overwritePanelPreset}
                onDelete={deletePanelPreset}
              />
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <input
            type="text"
            value={newPresetName}
            onChange={e => setNewPresetName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSavePreset(); }}
            placeholder={ep.presetNamePlaceholder}
            className={INPUT_CLS + ' min-w-0 flex-1'}
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
    </>
  );
}

function PresetRow({ preset, isActive, ep, onApply, onOverwrite, onDelete }: {
  preset: PanelLayoutPreset;
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

// ═══════════════════════════════════════════════════════════════════════════
//  BEHAVIOR TAB
// ═══════════════════════════════════════════════════════════════════════════

function BehaviorTab() {
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

  return (
    <>
      {/* Autosave */}
      <Section title={ep.sectionAutosave}>
        <div className="flex flex-col gap-2">
          <Row label={ep.autosaveLabel}>
            <Toggle value={prefs.autosave} onChange={() => toggle('autosave')} />
          </Row>
          {prefs.autosave && (
            <Row label={ep.autosaveIntervalLabel}>
              <Segmented
                value={String(prefs.autosaveInterval)}
                options={AUTOSAVE_INTERVALS.map(n => ({ value: String(n), label: ep.intervalMinutes(n) }))}
                onChange={v => setPrefs({ autosaveInterval: parseInt(v, 10) as typeof AUTOSAVE_INTERVALS[number] })}
              />
            </Row>
          )}
          <Row label={ep.saveOnExitLabel}>
            <Toggle value={prefs.saveOnExit} onChange={() => toggle('saveOnExit')} />
          </Row>
        </div>
      </Section>

      {/* Window title bar */}
      {hasTitleBarControl && (
        <Section title={ep.titleBarStyleLabel}>
          <div className="flex flex-col gap-1">
            {(['custom', 'native'] as const).map(style => (
              <button
                key={style}
                onClick={() => {
                  if (style !== titleBarStyle && api?.setTitleBarStyle) api.setTitleBarStyle(style);
                }}
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
          <p className="text-[10px] text-slate-500 mt-1.5">{ep.titleBarStyleRestartNote}</p>
        </Section>
      )}

      {/* Confirm on delete */}
      <Section title={ep.sectionConfirms}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
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
        </div>
      </Section>

      {/* Group deletion behaviour */}
      <Section title={ep.sectionGroupDelete}>
        <p className="text-xs text-slate-400 mb-2">{ep.deleteGroupBehaviorLabel}</p>
        <div className="flex flex-col gap-1">
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
      </Section>

      {/* Export */}
      <Section title={ep.sectionExport}>
        <Row label={ep.confirmOpenFolderAfterExport}>
          <Toggle value={prefs.confirmOpenFolderAfterExport} onChange={() => toggle('confirmOpenFolderAfterExport')} />
        </Row>
      </Section>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs text-slate-300 cursor-pointer">
      <span className="flex-1 min-w-0">{label}</span>
      <span className="shrink-0">{children}</span>
    </label>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Icons (inline SVG)
// ═══════════════════════════════════════════════════════════════════════════

const Ico = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const IconX        = () => <Ico d="M6 6l12 12M18 6L6 18" />;
const IconCog      = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const IconPalette  = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16c3.3 0 6-2.7 6-6 0-4.9-4.5-8.6-10-8.6z" />
  </svg>
);
const IconCommand  = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
  </svg>
);
const IconLayout   = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 21V9" />
  </svg>
);
