import { create } from 'zustand';
import type { GenerationHistoryEntry } from '../types';

const MAX_ENTRIES_PER_BLOCK = 10;

interface GenerationHistoryState {
  /** blockId → list of generation entries */
  history: Record<string, GenerationHistoryEntry[]>;
  /** blockId → current navigation index (-1 = not navigating, i.e. live text) */
  currentIndex: Record<string, number>;

  addEntry: (blockId: string, entry: GenerationHistoryEntry) => void;
  getEntries: (blockId: string) => GenerationHistoryEntry[];
  getIndex: (blockId: string) => number;
  navigate: (blockId: string, direction: -1 | 1) => GenerationHistoryEntry | null;
  resetIndex: (blockId: string) => void;
}

export const useGenerationHistoryStore = create<GenerationHistoryState>()((set, get) => ({
  history: {},
  currentIndex: {},

  addEntry: (blockId, entry) => set(s => {
    const existing = s.history[blockId] ?? [];
    const updated = [...existing, entry].slice(-MAX_ENTRIES_PER_BLOCK);
    return {
      history: { ...s.history, [blockId]: updated },
      currentIndex: { ...s.currentIndex, [blockId]: updated.length - 1 },
    };
  }),

  getEntries: (blockId) => get().history[blockId] ?? [],

  getIndex: (blockId) => get().currentIndex[blockId] ?? -1,

  navigate: (blockId, direction) => {
    const entries = get().history[blockId] ?? [];
    if (entries.length === 0) return null;

    const current = get().currentIndex[blockId] ?? entries.length - 1;
    const next = current + direction;
    if (next < 0 || next >= entries.length) return null;

    set(s => ({
      currentIndex: { ...s.currentIndex, [blockId]: next },
    }));

    return entries[next];
  },

  resetIndex: (blockId) => set(s => {
    const entries = s.history[blockId] ?? [];
    return {
      currentIndex: { ...s.currentIndex, [blockId]: entries.length - 1 },
    };
  }),
}));
