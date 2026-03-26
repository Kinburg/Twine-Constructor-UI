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

  deleteFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('fs:deleteFile', filePath),

  deleteDir: (dirPath: string): Promise<void> =>
    ipcRenderer.invoke('fs:deleteDir', dirPath),

  stat: (filePath: string): Promise<{ size: number; mtimeMs: number }> =>
    ipcRenderer.invoke('fs:stat', filePath),

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

  // Scene graph window
  toggleGraph: (): Promise<boolean> =>
    ipcRenderer.invoke('graph:toggle'),

  /** Main window → graph window: push full graph data */
  updateGraph: (data: unknown): Promise<void> =>
    ipcRenderer.invoke('graph:update', data),

  /** Graph window: receive graph data from main window */
  onGraphProject: (callback: (data: unknown) => void): void => {
    ipcRenderer.on('graph:project', (_e, data: unknown) => callback(data));
  },

  /** Graph window → main window: node dragged to new position */
  graphMove: (sceneId: string, x: number, y: number): Promise<void> =>
    ipcRenderer.invoke('graph:move', sceneId, x, y),

  /** Main window: receive position update relayed from graph */
  onGraphMove: (callback: (sceneId: string, x: number, y: number) => void): void => {
    ipcRenderer.on('graph:move', (_e, sceneId: string, x: number, y: number) => callback(sceneId, x, y));
  },

  /** Graph window → main window: user clicked a scene node */
  graphNavigate: (sceneId: string): Promise<void> =>
    ipcRenderer.invoke('graph:navigate', sceneId),

  /** Main window: receive navigation request relayed from graph */
  onGraphNavigate: (callback: (sceneId: string) => void): void => {
    ipcRenderer.on('graph:navigate', (_e, sceneId: string) => callback(sceneId));
  },

  /** Main window: graph window was closed by the user */
  onGraphClosed: (callback: () => void): void => {
    ipcRenderer.on('graph:closed', callback);
  },

  /** Graph window: signals renderer is mounted, requests initial data */
  graphReady: (): Promise<void> =>
    ipcRenderer.invoke('graph:ready'),
});
