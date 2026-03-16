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

// Required for correct taskbar grouping and icon on Windows 10/11
app.setAppUserModelId('com.purlapp.app');

// Projects stored in ~/Documents/Purl/Projects/
const PROJECTS_DIR = path.join(app.getPath('documents'), 'Purl', 'Projects');

let win: BrowserWindow | null;
let previewWin: BrowserWindow | null = null;
let graphWin: BrowserWindow | null = null;
let splashWin: BrowserWindow | null = null;
let splashStart = 0;
let lastGraphData: unknown = null;

// ─── Splash window ────────────────────────────────────────────────────────────

function createSplashWindow() {
  splashWin = new BrowserWindow({
    width: 704,
    height: 384,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  splashWin.loadFile(path.join(process.env.VITE_PUBLIC!, 'splash.html'));
}

// ─── Graph window ─────────────────────────────────────────────────────────────

function createGraphWindow() {
  graphWin = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 500,
    minHeight: 400,
    title: 'Scene Graph — Purl',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    graphWin.loadURL(VITE_DEV_SERVER_URL + '/?mode=graph');
  } else {
    graphWin.loadFile(path.join(RENDERER_DIST, 'index.html'), { query: { mode: 'graph' } });
  }

  graphWin.on('closed', () => {
    graphWin = null;
    if (win && !win.isDestroyed()) {
      win.webContents.send('graph:closed');
    }
  });
}

// ─── Preview window ───────────────────────────────────────────────────────────

function createPreviewWindow() {
  previewWin = new BrowserWindow({
    width: 720,
    height: 640,
    minWidth: 400,
    minHeight: 300,
    title: 'Code Preview — Purl',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    previewWin.loadURL(VITE_DEV_SERVER_URL + '/preview.html');
  } else {
    previewWin.loadFile(path.join(RENDERER_DIST, 'preview.html'));
  }

  previewWin.on('closed', () => {
    previewWin = null;
    if (win && !win.isDestroyed()) {
      win.webContents.send('preview:closed');
    }
  });
}

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  const iconPath = path.join(process.env.VITE_PUBLIC!, 'Icon.ico');

  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Purl',
    show: false,
    icon: iconPath,
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

  win.once('ready-to-show', () => {
    const elapsed = Date.now() - splashStart;
    const delay = Math.max(0, 2000 - elapsed);
    setTimeout(() => {
      if (splashWin && !splashWin.isDestroyed()) {
        splashWin.close();
        splashWin = null;
      }
      win?.show();
    }, delay);
  });
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

  splashStart = Date.now();
  createSplashWindow();
  createWindow();
});

// ─── IPC: preview window ─────────────────────────────────────────────────────

ipcMain.handle('preview:toggle', () => {
  if (previewWin && !previewWin.isDestroyed()) {
    previewWin.close();
    previewWin = null;
    return false;
  }
  createPreviewWindow();
  return true;
});

ipcMain.handle('preview:update', (_e, code: string) => {
  if (previewWin && !previewWin.isDestroyed()) {
    previewWin.webContents.send('preview:code', code);
  }
});

// ─── IPC: graph window ───────────────────────────────────────────────────────

ipcMain.handle('graph:toggle', () => {
  if (graphWin && !graphWin.isDestroyed()) {
    graphWin.close();
    graphWin = null;
    return false;
  }
  createGraphWindow();
  return true;
});

// Main window pushes project snapshot → cache + relay to graph window
ipcMain.handle('graph:update', (_e, data: unknown) => {
  lastGraphData = data;
  if (graphWin && !graphWin.isDestroyed()) {
    graphWin.webContents.send('graph:project', data);
  }
});

// Graph window signals it's ready → send cached data immediately
ipcMain.handle('graph:ready', (e) => {
  if (lastGraphData !== null) {
    e.sender.send('graph:project', lastGraphData);
  }
});

// Graph window sends node position after drag → relay to main window
ipcMain.handle('graph:move', (_e, sceneId: string, x: number, y: number) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('graph:move', sceneId, x, y);
  }
});

// Graph window requests navigation → relay to main window
ipcMain.handle('graph:navigate', (_e, sceneId: string) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('graph:navigate', sceneId);
    win.focus();
  }
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
