import { create } from 'zustand';
import type { PluginBlockDef } from '../types';
import { fsApi, joinPath } from '../lib/fsApi';
import { slugifyPluginName, uniqueSlug, validatePluginDef } from '../utils/pluginUtils';

const PLUGIN_EXT = '.plugin.json';

interface PluginStoreState {
  plugins: PluginBlockDef[];
  projectDir: string | null;
  loading: boolean;
  error: string | null;

  loadFromDisk: (projectDir: string | null) => Promise<void>;
  reload: () => Promise<void>;
  savePlugin: (def: PluginBlockDef) => Promise<string | null>;   // returns error-code or null
  deletePlugin: (id: string) => Promise<void>;
  duplicatePlugin: (id: string) => Promise<void>;
  exportPlugin: (id: string) => Promise<void>;
  importPlugin: () => Promise<void>;
  getPlugin: (id: string) => PluginBlockDef | undefined;
  /** Allocate a unique id/slug from a name (does NOT create the plugin). */
  reserveSlug: (name: string) => string;
}

function pluginDir(projectDir: string): string {
  return joinPath(projectDir, 'plugins');
}

function pluginPath(projectDir: string, id: string): string {
  return joinPath(pluginDir(projectDir), `${id}${PLUGIN_EXT}`);
}

/**
 * Normalize loaded plugin JSON — ensure required fields exist.
 * Silently repair minor issues; hard-invalid files are skipped by caller.
 */
function normalizePluginDef(raw: any, fallbackId: string): PluginBlockDef | null {
  if (!raw || typeof raw !== 'object') return null;
  const def: PluginBlockDef = {
    id:          typeof raw.id === 'string' && raw.id ? raw.id : fallbackId,
    name:        typeof raw.name === 'string' ? raw.name : fallbackId,
    color:       typeof raw.color === 'string' ? raw.color : '#6366f1',
    icon:        typeof raw.icon === 'string' ? raw.icon : '🧩',
    description: typeof raw.description === 'string' ? raw.description : '',
    version:     typeof raw.version === 'string' ? raw.version : '1.0.0',
    params:      Array.isArray(raw.params) ? raw.params : [],
    blocks:      Array.isArray(raw.blocks) ? raw.blocks : [],
  };
  return def;
}

export const usePluginStore = create<PluginStoreState>((set, get) => ({
  plugins: [],
  projectDir: null,
  loading: false,
  error: null,

  loadFromDisk: async (projectDir) => {
    set({ projectDir, loading: true, error: null });
    if (!projectDir) {
      set({ plugins: [], loading: false });
      return;
    }
    try {
      const dir = pluginDir(projectDir);
      const exists = await fsApi.exists(dir);
      if (!exists) {
        set({ plugins: [], loading: false });
        return;
      }
      const entries = await fsApi.listDir(dir);
      const out: PluginBlockDef[] = [];
      for (const entry of entries) {
        if (entry.isDir) continue;
        if (!entry.name.endsWith(PLUGIN_EXT)) continue;
        const slug = entry.name.slice(0, -PLUGIN_EXT.length);
        try {
          const content = await fsApi.readFile(joinPath(dir, entry.name));
          const raw = JSON.parse(content);
          const def = normalizePluginDef(raw, slug);
          if (def) {
            def.id = slug;   // always trust filename as canonical id
            out.push(def);
          }
        } catch (e) {
          console.warn(`[pluginStore] Failed to load ${entry.name}:`, e);
        }
      }
      out.sort((a, b) => a.name.localeCompare(b.name));
      set({ plugins: out, loading: false });
    } catch (e) {
      console.error('[pluginStore] loadFromDisk failed:', e);
      set({ plugins: [], loading: false, error: String(e) });
    }
  },

  reload: async () => {
    const dir = get().projectDir;
    await get().loadFromDisk(dir);
  },

  savePlugin: async (def) => {
    const projectDir = get().projectDir;
    if (!projectDir) return 'noProjectDir';
    const err = validatePluginDef(def);
    if (err) return err;
    try {
      await fsApi.mkdir(pluginDir(projectDir));
      await fsApi.writeFile(pluginPath(projectDir, def.id), JSON.stringify(def, null, 2));
      set((s) => {
        const idx = s.plugins.findIndex((p) => p.id === def.id);
        const next = [...s.plugins];
        if (idx >= 0) next[idx] = def; else next.push(def);
        next.sort((a, b) => a.name.localeCompare(b.name));
        return { plugins: next };
      });
      return null;
    } catch (e) {
      console.error('[pluginStore] savePlugin failed:', e);
      return String(e);
    }
  },

  deletePlugin: async (id) => {
    const projectDir = get().projectDir;
    if (!projectDir) return;
    try {
      const path = pluginPath(projectDir, id);
      if (await fsApi.exists(path)) await fsApi.deleteFile(path);
      set((s) => ({ plugins: s.plugins.filter((p) => p.id !== id) }));
    } catch (e) {
      console.error('[pluginStore] deletePlugin failed:', e);
    }
  },

  duplicatePlugin: async (id) => {
    const src = get().plugins.find((p) => p.id === id);
    if (!src) return;
    const existing = new Set(get().plugins.map((p) => p.id));
    const newId = uniqueSlug(`${src.id}-copy`, existing);
    const copy: PluginBlockDef = { ...src, id: newId, name: `${src.name} (copy)` };
    await get().savePlugin(copy);
  },

  exportPlugin: async (id) => {
    const def = get().plugins.find((p) => p.id === id);
    if (!def) return;
    try {
      const result = await fsApi.saveFileDialog({
        defaultPath: `${def.id}${PLUGIN_EXT}`,
        filters: [{ name: 'Plugin Block', extensions: ['json'] }],
      });
      if (!result) return;
      await fsApi.writeFile(result, JSON.stringify(def, null, 2));
    } catch (e) {
      console.error('[pluginStore] exportPlugin failed:', e);
    }
  },

  importPlugin: async () => {
    const projectDir = get().projectDir;
    if (!projectDir) return;
    try {
      const result = await fsApi.openFileDialog({
        filters: [{ name: 'Plugin Block', extensions: ['json'] }],
      });
      if (!result) return;
      const content = await fsApi.readFile(result);
      const raw = JSON.parse(content);
      // Filename without extensions as slug hint.
      const nameGuess = (result.split(/[\\/]/).pop() || 'plugin')
        .replace(/\.plugin\.json$/i, '')
        .replace(/\.json$/i, '');
      const baseSlug = slugifyPluginName(raw.id || nameGuess);
      const existing = new Set(get().plugins.map((p) => p.id));
      const finalSlug = uniqueSlug(baseSlug, existing);
      const def = normalizePluginDef(raw, finalSlug);
      if (!def) return;
      def.id = finalSlug;
      await get().savePlugin(def);
    } catch (e) {
      console.error('[pluginStore] importPlugin failed:', e);
    }
  },

  getPlugin: (id) => get().plugins.find((p) => p.id === id),

  reserveSlug: (name) => {
    const existing = new Set(get().plugins.map((p) => p.id));
    return uniqueSlug(slugifyPluginName(name), existing);
  },
}));
