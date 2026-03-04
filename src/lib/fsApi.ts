/**
 * Thin wrapper over window.electronAPI (IPC calls to the main process).
 * Always use this instead of calling window.electronAPI directly.
 */
const api = () => window.electronAPI;

export const fsApi = {
  getProjectsDir: ()                              => api().getProjectsDir(),
  readFile:       (p: string)                     => api().readFile(p),
  readFileBinary: (p: string)                     => api().readFileBinary(p),
  writeFile:      (p: string, content: string)    => api().writeFile(p, content),
  copyFile:       (src: string, dest: string)     => api().copyFile(src, dest),
  mkdir:          (p: string)                     => api().mkdir(p),
  exists:         (p: string)                     => api().exists(p),
  renameDir:      (old: string, next: string)     => api().renameDir(old, next),
  listDir:        (p: string)                     => api().listDir(p),
  openFileDialog: (opts?: Parameters<ElectronAPI['openFileDialog']>[0]) =>
    api().openFileDialog(opts),
  openFilesDialog: (opts?: Parameters<ElectronAPI['openFilesDialog']>[0]) =>
    api().openFilesDialog(opts),
  openFolderDialog: ()                            => api().openFolderDialog(),
  saveFileDialog: (opts?: Parameters<ElectronAPI['saveFileDialog']>[0]) =>
    api().saveFileDialog(opts),
  openPath:       (p: string)                     => api().openPath(p),
};

// ─── Path helpers (no Node.js — pure string manipulation) ────────────────────

export function joinPath(...parts: string[]): string {
  return parts
    .map((p, i) => i === 0 ? p.replace(/[/\\]+$/, '') : p.replace(/^[/\\]+/, ''))
    .join('/');
}

/** Converts an absolute file path to a localfile:// URL for display in <img>/<video> */
export function toLocalFileUrl(absPath: string): string {
  // On Windows paths start with drive letter: C:\... → localfile:///C:/...
  const normalized = absPath.replace(/\\/g, '/');
  return `localfile://${normalized.startsWith('/') ? '' : '/'}${normalized}`;
}

/** Sanitizes a string for use as a folder/file name */
export function safeName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || 'project';
}
