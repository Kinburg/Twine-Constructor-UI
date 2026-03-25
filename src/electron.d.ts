interface ElectronAPI {
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
}

declare interface Window {
  electronAPI?: ElectronAPI;
}
