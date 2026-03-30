import {app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, screen, shell} from 'electron';
import {fileURLToPath} from 'node:url';
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

// Prevent GPU compositor crashes (STATUS_FATAL_APP_EXIT / 0xC000041D) on Windows.
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-gpu-process-crash-limit');

if (process.argv.includes('--disable-gpu')) {
  app.disableHardwareAcceleration();
}

let isQuitting = false;
app.on('before-quit', () => { isQuitting = true; });

app.on('child-process-gone', (_event, details) => {
  if (!isQuitting && details.type === 'GPU' && details.reason !== 'clean-exit') {
    app.relaunch({ args: process.argv.slice(1).concat(['--disable-gpu']) });
  }
});

// Projects stored in ~/Documents/Purl/Projects/
const PROJECTS_DIR = path.join(app.getPath('documents'), 'Purl', 'Projects');

// ─── App config (title bar style + window layout) ───────────────────────────

type TitleBarStyle = 'custom' | 'native';

interface WindowBoundsRel {
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  isMaximized: boolean;
}

interface WindowLayoutSet {
  main?: WindowBoundsRel;
}

interface AppConfig {
  titleBarStyle: TitleBarStyle;
  windowLayout?: WindowLayoutSet;
}

let appConfig: AppConfig = { titleBarStyle: 'custom' };
let appConfigPath = '';

async function loadAppConfig(): Promise<void> {
  appConfigPath = path.join(app.getPath('userData'), 'purl-config.json');
  try {
    const raw = await fs.readFile(appConfigPath, 'utf-8');
    appConfig = { titleBarStyle: 'custom', ...JSON.parse(raw) };
  } catch { /* first run — defaults apply */ }
}

async function saveAppConfig(patch: Partial<AppConfig>): Promise<void> {
  appConfig = { ...appConfig, ...patch };
  await fs.writeFile(appConfigPath, JSON.stringify(appConfig, null, 2), 'utf-8');
}

// ─── Window bounds ↔ relative conversion ────────────────────────────────────

interface MinSize { minWidth: number; minHeight: number }

function boundsToRel(bounds: Electron.Rectangle, isMaximized: boolean): WindowBoundsRel {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  return {
    xPct: bounds.x / sw,
    yPct: bounds.y / sh,
    widthPct: bounds.width / sw,
    heightPct: bounds.height / sh,
    isMaximized,
  };
}

function relToBounds(rel: WindowBoundsRel, min: MinSize): Electron.Rectangle & { isMaximized: boolean } {
  const workArea = screen.getPrimaryDisplay().workArea;
  const sw = workArea.width;
  const sh = workArea.height;

  const w = Math.max(Math.round(rel.widthPct * sw), min.minWidth);
  const h = Math.max(Math.round(rel.heightPct * sh), min.minHeight);

  let x = Math.round(rel.xPct * sw) + workArea.x;
  let y = Math.round(rel.yPct * sh) + workArea.y;

  if (x + w > workArea.x + sw) x = workArea.x + sw - w;
  if (y + h > workArea.y + sh) y = workArea.y + sh - h;
  if (x < workArea.x) x = workArea.x;
  if (y < workArea.y) y = workArea.y;

  return { x, y, width: w, height: h, isMaximized: rel.isMaximized };
}

// ─── Debounced window bounds tracking ────────────────────────────────────────

const SAVE_DEBOUNCE_MS = 500;
const boundsTimers = new Map<string, ReturnType<typeof setTimeout>>();

function trackWindowBounds(bw: BrowserWindow, key: 'main') {
  const save = () => {
    if (bw.isDestroyed() || bw.isMinimized()) return;
    const isMax = bw.isMaximized();
    if (isMax) {
      const current = appConfig.windowLayout?.[key];
      if (current) {
        appConfig.windowLayout = {
          ...appConfig.windowLayout,
          [key]: { ...current, isMaximized: true },
        };
      }
    } else {
      appConfig.windowLayout = {
        ...appConfig.windowLayout,
        [key]: boundsToRel(bw.getBounds(), false),
      };
    }
    saveAppConfig({});
  };

  const debouncedSave = () => {
    const existing = boundsTimers.get(key);
    if (existing) clearTimeout(existing);
    boundsTimers.set(key, setTimeout(save, SAVE_DEBOUNCE_MS));
  };

  bw.on('move', debouncedSave);
  bw.on('resize', debouncedSave);
}

let win: BrowserWindow | null;
let splashWin: BrowserWindow | null = null;
let splashStart = 0;

// ─── Splash window ────────────────────────────────────────────────────────────

function createSplashWindow() {
  splashWin = new BrowserWindow({
    width: 704,
    height: 384,
    frame: false,
    backgroundColor: '#0f172a',
    resizable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  splashWin.loadFile(path.join(process.env.VITE_PUBLIC!, 'splash.html'));
}

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  const iconPath = path.join(process.env.VITE_PUBLIC!, 'Icon.ico');
  const frameless = appConfig.titleBarStyle === 'custom';
  const MIN = { minWidth: 900, minHeight: 600 };
  const saved = appConfig.windowLayout?.main;
  const restored = saved ? relToBounds(saved, MIN) : null;

  win = new BrowserWindow({
    width: restored?.width ?? 1400,
    height: restored?.height ?? 900,
    ...(restored ? { x: restored.x, y: restored.y } : {}),
    minWidth: MIN.minWidth,
    minHeight: MIN.minHeight,
    title: 'Purl',
    show: false,
    frame: !frameless,
    backgroundColor: '#0f172a',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Maximize by default on first run, or restore saved state
  if (restored?.isMaximized !== false) win.maximize();
  trackWindowBounds(win, 'main');

  if (frameless) {
    win.on('maximize',   () => win?.webContents.send('window:maximized', true));
    win.on('unmaximize', () => win?.webContents.send('window:maximized', false));
  }

  // Intercept close to allow renderer to confirm / save first
  let closeConfirmed = false;
  win.on('close', (e) => {
    if (win && !win.isDestroyed()) {
      appConfig.windowLayout = {
        ...appConfig.windowLayout,
        main: boundsToRel(win.getBounds(), win.isMaximized()),
      };
      saveAppConfig({});
    }
    if (!closeConfirmed) {
      e.preventDefault();
      win?.webContents.send('app:close-requested');
    }
  });

  ipcMain.removeAllListeners('app:close-confirm');
  ipcMain.removeAllListeners('app:close-cancel');

  ipcMain.on('app:close-confirm', () => {
    closeConfirmed = true;
    win?.close();
  });
  ipcMain.on('app:close-cancel', () => { /* do nothing — close already prevented */ });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }

  win.on('closed', () => {
    win = null;
  });

  win.once('ready-to-show', () => {
    const elapsed = Date.now() - splashStart;
    const delay = Math.max(0, 2000 - elapsed);
    setTimeout(() => {
      win?.show();
      if (splashWin && !splashWin.isDestroyed()) {
        splashWin.hide();
        setTimeout(() => {
          if (splashWin && !splashWin.isDestroyed()) {
            splashWin.destroy();
            splashWin = null;
          }
        }, 1000);
      }
    }, delay);
  });
}

// ─── Custom protocol for local asset display ──────────────────────────────────

app.whenReady().then(async () => {
  await loadAppConfig();

  if (appConfig.titleBarStyle === 'custom') {
    Menu.setApplicationMenu(null);
  }

  protocol.handle('localfile', (request) => {
    const filePath = decodeURIComponent(request.url.replace('localfile://', ''));
    return net.fetch('file://' + filePath);
  });

  fs.mkdir(PROJECTS_DIR, { recursive: true }).catch(() => {});

  splashStart = Date.now();
  createSplashWindow();
  createWindow();
});

// ─── IPC: filesystem ─────────────────────────────────────────────────────────

ipcMain.handle('fs:getProjectsDir', () => PROJECTS_DIR);

ipcMain.handle('fs:readFile', async (_e, filePath: string) => {
  return fs.readFile(filePath, 'utf-8');
});

ipcMain.handle('fs:readFileBinary', async (_e, filePath: string) => {
  const buf = await fs.readFile(filePath);
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

ipcMain.handle('fs:deleteFile', async (_e, filePath: string) => {
  await fs.unlink(filePath);
});

ipcMain.handle('fs:deleteDir', async (_e, dirPath: string) => {
  await fs.rm(dirPath, { recursive: true, force: true });
});

ipcMain.handle('fs:stat', async (_e, filePath: string) => {
  const st = await fs.stat(filePath);
  return { size: st.size, mtimeMs: st.mtimeMs };
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

// ─── IPC: window controls ─────────────────────────────────────────────────────

ipcMain.handle('window:minimize',    (e) => { BrowserWindow.fromWebContents(e.sender)?.minimize(); });
ipcMain.handle('window:maximize',    (e) => {
  const bw = BrowserWindow.fromWebContents(e.sender);
  if (!bw) return;
  if (bw.isMaximized()) bw.unmaximize(); else bw.maximize();
});
ipcMain.handle('window:close',       (e) => { BrowserWindow.fromWebContents(e.sender)?.close(); });
ipcMain.handle('window:isMaximized', (e) => BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false);

// ─── IPC: app config ──────────────────────────────────────────────────────────

ipcMain.handle('config:getTitleBarStyle', () => appConfig.titleBarStyle);
ipcMain.on('config:getTitleBarStyleSync', (e) => { e.returnValue = appConfig.titleBarStyle; });

ipcMain.handle('config:setTitleBarStyle', async (_e, style: TitleBarStyle) => {
  await saveAppConfig({ titleBarStyle: style });
  app.relaunch();
  app.exit(0);
});

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && win === null) {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
