import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Paths
  getProjectsDir: (): Promise<string> =>
    ipcRenderer.invoke('fs:getProjectsDir'),

  // Filesystem
  readFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('fs:readFile', filePath),

  readFileBinary: (filePath: string): Promise<number[]> =>
    ipcRenderer.invoke('fs:readFileBinary', filePath),

  writeFile: (filePath: string, content: string): Promise<void> =>
    ipcRenderer.invoke('fs:writeFile', filePath, content),

  copyFile: (src: string, dest: string): Promise<void> =>
    ipcRenderer.invoke('fs:copyFile', src, dest),

  mkdir: (dirPath: string): Promise<void> =>
    ipcRenderer.invoke('fs:mkdir', dirPath),

  exists: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('fs:exists', filePath),

  renameDir: (oldPath: string, newPath: string): Promise<void> =>
    ipcRenderer.invoke('fs:rename', oldPath, newPath),

  listDir: (dirPath: string): Promise<{ name: string; isDir: boolean }[]> =>
    ipcRenderer.invoke('fs:listDir', dirPath),

  // Dialogs
  openFileDialog: (options?: Electron.OpenDialogOptions): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openFile', options),

  openFilesDialog: (options?: Electron.OpenDialogOptions): Promise<string[]> =>
    ipcRenderer.invoke('dialog:openFiles', options),

  openFolderDialog: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openFolder'),

  saveFileDialog: (options?: Electron.SaveDialogOptions): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveFile', options),

  // Shell
  openPath: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('shell:openPath', filePath),

  // Code preview window
  togglePreview: (): Promise<boolean> =>
    ipcRenderer.invoke('preview:toggle'),

  updatePreview: (code: string): Promise<void> =>
    ipcRenderer.invoke('preview:update', code),

  onPreviewCode: (callback: (code: string) => void): void => {
    ipcRenderer.on('preview:code', (_e, code: string) => callback(code));
  },

  onPreviewClosed: (callback: () => void): void => {
    ipcRenderer.on('preview:closed', callback);
  },
});
