import { create } from 'zustand';
import type { Block } from '../types';

/**
 * Ephemeral (non-persisted) editor state — clipboard, search query, and other session-only data.
 */
interface EditorState {
  /** Block copied to clipboard; null when clipboard is empty. */
  clipboardBlock: Block | null;
  copyToClipboard: (block: Block) => void;
  clearClipboard: () => void;

  /** Current search query string (empty = no search active). */
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  clipboardBlock: null,
  copyToClipboard: (block) => set({ clipboardBlock: block }),
  clearClipboard: () => set({ clipboardBlock: null }),

  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
}));
