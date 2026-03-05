import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, '..');

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

// Projects stored in ~/Documents/TwineConstructor/Projects/
const PROJECTS_DIR = path.join(app.getPath('documents'), 'TwineConstructor', 'Projects');

let win: BrowserWindow | null;

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'TwineConstructor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

// ─── Custom protocol for local asset display ──────────────────────────────────
// <img src="localfile:///abs/path/to/file.jpg"> works in renderer

app.whenReady().then(() => {
  protocol.handle('localfile', (request) => {
    const filePath = decodeURIComponent(request.url.replace('localfile://', ''));
    return net.fetch('file://' + filePath);
  });

  // Ensure base projects dir exists
  fs.mkdir(PROJECTS_DIR, { recursive: true }).catch(() => {});

  createWindow();
});

// ─── IPC: filesystem ─────────────────────────────────────────────────────────

ipcMain.handle('fs:getProjectsDir', () => PROJECTS_DIR);

ipcMain.handle('fs:readFile', async (_e, filePath: string) => {
  return fs.readFile(filePath, 'utf-8');
});

ipcMain.handle('fs:readFileBinary', async (_e, filePath: string) => {
  const buf = await fs.readFile(filePath);
  // Return as regular array so it survives IPC serialization
  return Array.from(buf);
});

ipcMain.handle('fs:writeFile', async (_e, filePath: string, content: string) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
});

ipcMain.handle('fs:copyFile', async (_e, src: string, dest: string) => {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
});

ipcMain.handle('fs:mkdir', async (_e, dirPath: string) => {
  await fs.mkdir(dirPath, { recursive: true });
});

ipcMain.handle('fs:exists', async (_e, filePath: string) => {
  try { await fs.access(filePath); return true; } catch { return false; }
});

ipcMain.handle('fs:rename', async (_e, oldPath: string, newPath: string) => {
  await fs.rename(oldPath, newPath);
});

ipcMain.handle('fs:listDir', async (_e, dirPath: string) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map(e => ({ name: e.name, isDir: e.isDirectory() }));
  } catch { return []; }
});

// ─── IPC: dialogs ─────────────────────────────────────────────────────────────

ipcMain.handle('dialog:openFile', async (_e, options: Electron.OpenDialogOptions) => {
  if (!win) return null;
  const result = await dialog.showOpenDialog(win, { properties: ['openFile'], ...options });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:openFiles', async (_e, options: Electron.OpenDialogOptions) => {
  if (!win) return [];
  const result = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], ...options });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('dialog:openFolder', async () => {
  if (!win) return null;
  const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:saveFile', async (_e, options: Electron.SaveDialogOptions) => {
  if (!win) return null;
  const result = await dialog.showSaveDialog(win, options);
  return result.canceled ? null : result.filePath ?? null;
});

// ─── IPC: shell ───────────────────────────────────────────────────────────────

ipcMain.handle('shell:openPath', async (_e, filePath: string) => {
  await shell.openPath(filePath);
});

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
