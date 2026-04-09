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

  writeFileBinary: (filePath: string, bytes: number[]): Promise<void> =>
    ipcRenderer.invoke('fs:writeFileBinary', filePath, bytes),

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
});
