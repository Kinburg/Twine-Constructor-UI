import { contextBridge, ipcRenderer } from 'electron';

const titleBarStyle = ipcRenderer.sendSync('config:getTitleBarStyleSync') as 'custom' | 'native';

contextBridge.exposeInMainWorld('electronAPI', {
  titleBarStyle,
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

  /** Preview window: signals renderer is ready, requests initial code */
  previewReady: (): Promise<void> =>
    ipcRenderer.invoke('preview:ready'),

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

  // Window controls (custom title bar)
  minimizeWindow:    (): Promise<void>    => ipcRenderer.invoke('window:minimize'),
  maximizeWindow:    (): Promise<void>    => ipcRenderer.invoke('window:maximize'),
  closeWindow:       (): Promise<void>    => ipcRenderer.invoke('window:close'),
  isWindowMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),

  onWindowMaximized: (callback: (maximized: boolean) => void): void => {
    ipcRenderer.on('window:maximized', (_e, maximized: boolean) => callback(maximized));
  },

  // App config
  getTitleBarStyle: (): Promise<'custom' | 'native'> =>
    ipcRenderer.invoke('config:getTitleBarStyle'),

  setTitleBarStyle: (style: 'custom' | 'native'): Promise<void> =>
    ipcRenderer.invoke('config:setTitleBarStyle', style),

  // Close confirmation
  onCloseRequested: (callback: () => void): void => {
    ipcRenderer.on('app:close-requested', callback);
  },
  confirmClose: (): void => { ipcRenderer.send('app:close-confirm'); },
  cancelClose:  (): void => { ipcRenderer.send('app:close-cancel');  },

  // Window layout / workspace presets
  getOpenWindows: (): Promise<{ previewOpen: boolean; graphOpen: boolean }> =>
    ipcRenderer.invoke('config:getOpenWindows'),

  getWindowLayout: (): Promise<{
    workspacePresets: { id: string; name: string; builtIn: boolean }[];
    activePresetId: string | null;
  }> => ipcRenderer.invoke('config:getWindowLayout'),

  saveWorkspacePreset: (name: string): Promise<{ id: string; name: string; builtIn: boolean }> =>
    ipcRenderer.invoke('config:saveWorkspacePreset', name),

  overwriteWorkspacePreset: (id: string): Promise<void> =>
    ipcRenderer.invoke('config:overwriteWorkspacePreset', id),

  deleteWorkspacePreset: (id: string): Promise<void> =>
    ipcRenderer.invoke('config:deleteWorkspacePreset', id),

  renameWorkspacePreset: (id: string, name: string): Promise<void> =>
    ipcRenderer.invoke('config:renameWorkspacePreset', id, name),

  applyWorkspacePreset: (id: string): Promise<void> =>
    ipcRenderer.invoke('config:applyWorkspacePreset', id),

  onWindowsOpenState: (callback: (state: { previewOpen: boolean; graphOpen: boolean }) => void): void => {
    ipcRenderer.on('windows:openState', (_e, state: { previewOpen: boolean; graphOpen: boolean }) => callback(state));
  },
});
