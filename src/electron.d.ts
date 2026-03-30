interface ElectronAPI {
  // Title bar style (resolved synchronously at preload time)
  titleBarStyle: 'custom' | 'native';

  // Paths
  getProjectsDir(): Promise<string>;

  // Filesystem
  readFile(filePath: string): Promise<string>;
  readFileBinary(filePath: string): Promise<number[]>;
  writeFile(filePath: string, content: string): Promise<void>;
  copyFile(src: string, dest: string): Promise<void>;
  mkdir(dirPath: string): Promise<void>;
  exists(filePath: string): Promise<boolean>;
  renameDir(oldPath: string, newPath: string): Promise<void>;
  listDir(dirPath: string): Promise<{ name: string; isDir: boolean }[]>;
  deleteFile(filePath: string): Promise<void>;
  deleteDir(dirPath: string): Promise<void>;
  stat(filePath: string): Promise<{ size: number; mtimeMs: number }>;

  // Dialogs
  openFileDialog(options?: {
    filters?: { name: string; extensions: string[] }[];
    title?: string;
  }): Promise<string | null>;

  openFilesDialog(options?: {
    filters?: { name: string; extensions: string[] }[];
    title?: string;
  }): Promise<string[]>;

  openFolderDialog(): Promise<string | null>;

  saveFileDialog(options?: {
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
    title?: string;
    buttonLabel?: string;
  }): Promise<string | null>;

  // Shell
  openPath(filePath: string): Promise<void>;

  // Code preview window
  /** Open preview if closed, close if open. Returns new open state. */
  togglePreview(): Promise<boolean>;
  /** Send twee code to the preview window (no-op if closed). */
  updatePreview(code: string): Promise<void>;
  /** Called inside the preview window to receive code updates. */
  onPreviewCode(callback: (code: string) => void): void;
  /** Called in the main window when the user closes the preview window. */
  onPreviewClosed(callback: () => void): void;
  /** Preview window: signals renderer is ready, requests initial code. */
  previewReady?(): Promise<void>;

  // Scene graph window
  toggleGraph(): Promise<boolean>;
  updateGraph(data: unknown): Promise<void>;
  onGraphProject(callback: (data: unknown) => void): void;
  graphMove(sceneId: string, x: number, y: number): Promise<void>;
  onGraphMove(callback: (sceneId: string, x: number, y: number) => void): void;
  graphNavigate(sceneId: string): Promise<void>;
  onGraphNavigate(callback: (sceneId: string) => void): void;
  onGraphClosed(callback: () => void): void;
  graphReady?(): Promise<void>;

  // Window controls (custom title bar)
  minimizeWindow(): Promise<void>;
  maximizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;
  isWindowMaximized(): Promise<boolean>;
  onWindowMaximized(callback: (maximized: boolean) => void): void;

  // App config
  getTitleBarStyle(): Promise<'custom' | 'native'>;
  setTitleBarStyle(style: 'custom' | 'native'): Promise<void>;

  // Close confirmation
  onCloseRequested(callback: () => void): void;
  confirmClose(): void;
  cancelClose(): void;

  // Window layout / workspace presets
  getOpenWindows(): Promise<{ previewOpen: boolean; graphOpen: boolean }>;
  getWindowLayout(): Promise<{
    workspacePresets: WorkspacePresetInfo[];
    activePresetId: string | null;
  }>;
  saveWorkspacePreset(name: string): Promise<WorkspacePresetInfo>;
  overwriteWorkspacePreset(id: string): Promise<void>;
  deleteWorkspacePreset(id: string): Promise<void>;
  renameWorkspacePreset(id: string, name: string): Promise<void>;
  applyWorkspacePreset(id: string): Promise<void>;
  onWindowsOpenState(callback: (state: { previewOpen: boolean; graphOpen: boolean }) => void): void;
}

interface WorkspacePresetInfo {
  id: string;
  name: string;
  builtIn: boolean;
}

declare interface Window {
  electronAPI?: ElectronAPI;
}
