import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BlockType } from '../types';
import type { LLMProvider } from '../utils/llm';

// ── Panel layout (single-window split panels) ──────────────────────────────

export interface PanelLayout {
  previewVisible: boolean;
  graphVisible:   boolean;
  mainSizePct:    number;   // % width of main editor panel (default 60)
  previewSizePct: number;   // % height of preview in right column when both visible (default 50)
}

export interface PanelLayoutPreset {
  id:       string;
  name:     string;
  builtIn:  boolean;
  layout:   PanelLayout;
}

export const BUILTIN_PANEL_PRESETS: PanelLayoutPreset[] = [
  { id: '__bp_all',           builtIn: true, name: 'All Panels',            layout: { previewVisible: true,  graphVisible: true,  mainSizePct: 60, previewSizePct: 50 } },
  { id: '__bp_flow',          builtIn: true, name: 'Flow',                  layout: { previewVisible: false, graphVisible: true,  mainSizePct: 60, previewSizePct: 50 } },
  { id: '__bp_code_preview',  builtIn: true, name: 'Code Preview',          layout: { previewVisible: true,  graphVisible: false, mainSizePct: 60, previewSizePct: 50 } },
  { id: '__bp_constructor',   builtIn: true, name: 'Constructor',           layout: { previewVisible: false, graphVisible: false, mainSizePct: 100, previewSizePct: 50 } },
];

export interface EditorPrefs {
  // ── Autosave ──────────────────────────────────────────────────────────────
  autosave:         boolean;
  autosaveInterval: number;   // minutes: 1 | 5 | 10 | 30
  saveOnExit:       boolean;

  // ── Appearance ────────────────────────────────────────────────────────────
  compactMode: boolean;

  // ── Confirm on delete ─────────────────────────────────────────────────────
  confirmDeleteScene:     boolean;
  confirmDeleteGroup:     boolean;
  confirmDeleteVariable:  boolean;
  confirmDeleteWatcher:   boolean;
  confirmDeleteBlock:     boolean;
  confirmDeleteCharacter: boolean;

  // ── Group deletion behaviour ──────────────────────────────────────────────
  /** true = delete the group AND all scenes inside it; false = ungroup only */
  deleteGroupWithScenes: boolean;

  // ── Export ────────────────────────────────────────────────────────────────
  confirmOpenFolderAfterExport: boolean;

  // ── Add-block menu ──────────────────────────────────────────────────────
  recentBlockTypes: BlockType[];

  // ── Panel layout ──────────────────────────────────────────────────────────
  panelLayout: PanelLayout;
  panelPresets: PanelLayoutPreset[];       // user-defined presets
  activePanelPresetId: string | null;

  // ── LLM ────────────────────────────────────────────────────────────────────
  llmEnabled:          boolean;
  llmProvider:         LLMProvider;
  llmUrl:              string; // KoboldCPP URL or Gemini API Key
  llmGeminiModel:      string;
  llmGeminiModelsList: string[]; // Cache for fetched Gemini models
  llmOpenaiUrl:        string; // OpenAI-compatible endpoint URL
  llmOpenaiApiKey:     string; // OpenAI-compatible API key
  llmOpenaiModel:      string; // OpenAI-compatible model name
  llmMaxTokens:        number;
  llmTemperature:      number;
  llmSystemPrompt:     string;
  llmFilterThought:    boolean; // Filter <thought> blocks
  llmGenerationHistory: 'memory' | 'project' | 'disabled';
}

const DEFAULTS: EditorPrefs = {
  autosave:         false,
  autosaveInterval: 5,
  saveOnExit:       false,

  compactMode: false,

  confirmDeleteScene:     true,
  confirmDeleteGroup:     true,
  confirmDeleteVariable:  true,
  confirmDeleteWatcher:   true,
  confirmDeleteBlock:     false,
  confirmDeleteCharacter: true,

  deleteGroupWithScenes: false,

  confirmOpenFolderAfterExport: true,

  recentBlockTypes: [],

  panelLayout: { previewVisible: false, graphVisible: false, mainSizePct: 100, previewSizePct: 50 },
  panelPresets: [],
  activePanelPresetId: null,

  llmEnabled:          false,
  llmProvider:         'koboldcpp',
  llmUrl:              'http://localhost:5001/api/v1/generate',
  llmGeminiModel:      'models/gemini-1.5-flash',
  llmGeminiModelsList: ['models/gemini-1.5-flash', 'models/gemini-1.5-pro', 'models/gemini-1.0-pro'],
  llmOpenaiUrl:        'https://api.openai.com/v1/chat/completions',
  llmOpenaiApiKey:     '',
  llmOpenaiModel:      'gpt-4o-mini',
  llmMaxTokens:        200,
  llmTemperature:      0.7,
  llmSystemPrompt:     'You are a professional storyteller. Write a continuation of the story based on the context provided. Maintain the tone and style of the existing text.',
  llmFilterThought:    true,
  llmGenerationHistory: 'memory',
};

const MAX_RECENT = 5;

interface EditorPrefsState extends EditorPrefs {
  setPrefs: (patch: Partial<EditorPrefs>) => void;
  trackRecentBlock: (type: BlockType) => void;
  // Panel layout actions
  setPanelLayout: (patch: Partial<PanelLayout>) => void;
  togglePreviewPanel: () => void;
  toggleGraphPanel: () => void;
  savePanelPreset: (name: string) => void;
  applyPanelPreset: (id: string) => void;
  overwritePanelPreset: (id: string) => void;
  deletePanelPreset: (id: string) => void;
}

export const useEditorPrefsStore = create<EditorPrefsState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      setPrefs: (patch) => set(patch),
      trackRecentBlock: (type) => set((s) => ({
        recentBlockTypes: [type, ...s.recentBlockTypes.filter((t) => t !== type)].slice(0, MAX_RECENT),
      })),

      // ── Panel layout actions ───────────────────────────────────────────────
      setPanelLayout: (patch) => set((s) => ({
        panelLayout: { ...s.panelLayout, ...patch },
        activePanelPresetId: null,
      })),

      togglePreviewPanel: () => set((s) => {
        const visible = !s.panelLayout.previewVisible;
        const anyRight = visible || s.panelLayout.graphVisible;
        // When opening and main is 100% (no panels were open), set to 60%
        const mainPct = !anyRight ? 100
          : s.panelLayout.mainSizePct >= 100 ? 60
          : s.panelLayout.mainSizePct;
        return {
          panelLayout: { ...s.panelLayout, previewVisible: visible, mainSizePct: mainPct },
          activePanelPresetId: null,
        };
      }),

      toggleGraphPanel: () => set((s) => {
        const visible = !s.panelLayout.graphVisible;
        const anyRight = s.panelLayout.previewVisible || visible;
        const mainPct = !anyRight ? 100
          : s.panelLayout.mainSizePct >= 100 ? 60
          : s.panelLayout.mainSizePct;
        return {
          panelLayout: { ...s.panelLayout, graphVisible: visible, mainSizePct: mainPct },
          activePanelPresetId: null,
        };
      }),

      savePanelPreset: (name) => set((s) => ({
        panelPresets: [
          ...s.panelPresets,
          { id: crypto.randomUUID(), name, builtIn: false, layout: { ...s.panelLayout } },
        ],
      })),

      applyPanelPreset: (id) => {
        const all = [...BUILTIN_PANEL_PRESETS, ...get().panelPresets];
        const preset = all.find(p => p.id === id);
        if (!preset) return;
        set({ panelLayout: { ...preset.layout }, activePanelPresetId: id });
      },

      overwritePanelPreset: (id) => set((s) => ({
        panelPresets: s.panelPresets.map(p =>
          p.id === id ? { ...p, layout: { ...s.panelLayout } } : p,
        ),
        activePanelPresetId: id,
      })),

      deletePanelPreset: (id) => set((s) => ({
        panelPresets: s.panelPresets.filter(p => p.id !== id),
        activePanelPresetId: s.activePanelPresetId === id ? null : s.activePanelPresetId,
      })),
    }),
    { name: 'purl-editor-prefs' },
  ),
);
