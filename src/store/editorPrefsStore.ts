import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface EditorPrefs {
  // ── Autosave ──────────────────────────────────────────────────────────────
  autosave:         boolean;
  autosaveInterval: number;   // minutes: 1 | 5 | 10 | 30

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
}

const DEFAULTS: EditorPrefs = {
  autosave:         false,
  autosaveInterval: 5,

  compactMode: false,

  confirmDeleteScene:     true,
  confirmDeleteGroup:     true,
  confirmDeleteVariable:  true,
  confirmDeleteWatcher:   true,
  confirmDeleteBlock:     false,
  confirmDeleteCharacter: true,

  deleteGroupWithScenes: false,

  confirmOpenFolderAfterExport: true,
};

interface EditorPrefsState extends EditorPrefs {
  setPrefs: (patch: Partial<EditorPrefs>) => void;
}

export const useEditorPrefsStore = create<EditorPrefsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setPrefs: (patch) => set(patch),
    }),
    { name: 'purl-editor-prefs' },
  ),
);
