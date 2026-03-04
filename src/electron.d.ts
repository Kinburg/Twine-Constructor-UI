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
}

declare interface Window {
  electronAPI: ElectronAPI;
}
