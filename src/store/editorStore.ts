import { create } from 'zustand';
import type { Block } from '../types';

/**
 * Ephemeral (non-persisted) editor state — clipboard and other session-only data.
 */
interface EditorState {
  /** Block copied to clipboard; null when clipboard is empty. */
  clipboardBlock: Block | null;
  copyToClipboard: (block: Block) => void;
  clearClipboard: () => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  clipboardBlock: null,
  copyToClipboard: (block) => set({ clipboardBlock: block }),
  clearClipboard: () => set({ clipboardBlock: null }),
}));
