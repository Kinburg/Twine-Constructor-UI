import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, Menu, screen } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

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
// Some GPU drivers fail during DirectComposition overlay detection, crashing the
// GPU subprocess and taking the main process down with it.
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-gpu-process-crash-limit');

if (process.argv.includes('--disable-gpu')) {
  app.disableHardwareAcceleration();
}

let isQuitting = false;
app.on('before-quit', () => { isQuitting = true; });

// When the GPU process crashes (e.g. during child-window resource cleanup on Windows),
// do NOT quit — the sandbox flags isolate the crash so the main process survives.
// Schedule a relaunch with --disable-gpu so the *next* exit uses software rendering.
// Calling app.quit() here was causing the whole app to close whenever a child window
// was closed on machines with certain GPU drivers.
app.on('child-process-gone', (_event, details) => {
  if (!isQuitting && details.type === 'GPU' && details.reason !== 'clean-exit') {
    app.relaunch({ args: process.argv.slice(1).concat(['--disable-gpu']) });
    // intentionally no app.quit() — let the app keep running
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
  preview?: WindowBoundsRel;
  graph?: WindowBoundsRel;
  previewOpen?: boolean;
  graphOpen?: boolean;
}

interface WorkspacePreset {
  id: string;
  name: string;
  layout: WindowLayoutSet;
}

interface AppConfig {
  titleBarStyle: TitleBarStyle;
  windowLayout?: WindowLayoutSet;
  workspacePresets?: WorkspacePreset[];
  activePresetId?: string | null;
}

let appConfig: AppConfig = { titleBarStyle: 'custom' };
let appConfigPath = '';

// ─── Built-in workspace presets (not editable/deletable) ─────────────────────

const BUILTIN_PRESETS: (WorkspacePreset & { builtIn: true })[] = [
  {
    id: '__builtin_all_windows', builtIn: true,
    name: 'All Windows',
    layout: {
      previewOpen: true, graphOpen: true,
      main:    { xPct: 0, yPct: 0, widthPct: 0.5, heightPct: 1, isMaximized: false },
      preview: { xPct: 0.5, yPct: 0, widthPct: 0.5, heightPct: 0.5, isMaximized: false },
      graph:   { xPct: 0.5, yPct: 0.5, widthPct: 0.5, heightPct: 0.5, isMaximized: false },
    },
  },
  {
    id: '__builtin_flow', builtIn: true,
    name: 'Flow',
    layout: {
      previewOpen: false, graphOpen: true,
      main:  { xPct: 0, yPct: 0, widthPct: 0.5, heightPct: 1, isMaximized: false },
      graph: { xPct: 0.5, yPct: 0, widthPct: 0.5, heightPct: 1, isMaximized: false },
    },
  },
  {
    id: '__builtin_flow_horizont', builtIn: true,
    name: 'Flow Horizont',
    layout: {
      previewOpen: false, graphOpen: true,
      main:  { xPct: 0, yPct: 0, widthPct: 1, heightPct: 0.5, isMaximized: false },
      graph: { xPct: 0, yPct: 0.5, widthPct: 1, heightPct: 0.5, isMaximized: false },
    },
  },
  {
    id: '__builtin_code_preview', builtIn: true,
    name: 'Code Preview',
    layout: {
      previewOpen: true, graphOpen: false,
      main:    { xPct: 0, yPct: 0, widthPct: 0.5, heightPct: 1, isMaximized: false },
      preview: { xPct: 0.5, yPct: 0, widthPct: 0.5, heightPct: 1, isMaximized: false },
    },
  },
  {
    id: '__builtin_code_preview_horizont', builtIn: true,
    name: 'Code Preview Horizont',
    layout: {
      previewOpen: true, graphOpen: false,
      main:    { xPct: 0, yPct: 0, widthPct: 1, heightPct: 0.5, isMaximized: false },
      preview: { xPct: 0, yPct: 0.5, widthPct: 1, heightPct: 0.5, isMaximized: false },
    },
  },
  {
    id: '__builtin_constructor', builtIn: true,
    name: 'Constructor',
    layout: {
      previewOpen: false, graphOpen: false,
      main: { xPct: 0, yPct: 0, widthPct: 1, heightPct: 1, isMaximized: true },
    },
  },
];

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

  // Clamp to keep on-screen
  if (x + w > workArea.x + sw) x = workArea.x + sw - w;
  if (y + h > workArea.y + sh) y = workArea.y + sh - h;
  if (x < workArea.x) x = workArea.x;
  if (y < workArea.y) y = workArea.y;

  return { x, y, width: w, height: h, isMaximized: rel.isMaximized };
}

// ─── Debounced window bounds tracking ────────────────────────────────────────

const SAVE_DEBOUNCE_MS = 500;
const boundsTimers = new Map<string, ReturnType<typeof setTimeout>>();

function trackWindowBounds(bw: BrowserWindow, key: 'main' | 'preview' | 'graph') {
  const save = () => {
    if (bw.isDestroyed() || bw.isMinimized()) return;
    const isMax = bw.isMaximized();
    if (isMax) {
      // When maximized, only update the flag — keep pre-maximize bounds
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
    appConfig.activePresetId = null;
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
let previewWin: BrowserWindow | null = null;
let graphWin: BrowserWindow | null = null;
let splashWin: BrowserWindow | null = null;
let splashStart = 0;
let lastGraphData: unknown = null;
let lastPreviewCode: string | null = null;

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

// ─── Graph window ─────────────────────────────────────────────────────────────

function createGraphWindow(hidden = false) {
  const MIN = { minWidth: 500, minHeight: 400 };
  const saved = appConfig.windowLayout?.graph;
  const restored = saved ? relToBounds(saved, MIN) : null;

  graphWin = new BrowserWindow({
    width: restored?.width ?? 1100,
    height: restored?.height ?? 720,
    ...(restored ? { x: restored.x, y: restored.y } : {}),
    minWidth: MIN.minWidth,
    minHeight: MIN.minHeight,
    show: !hidden,
    title: 'Scene Graph — Purl',
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (restored?.isMaximized) graphWin.maximize();
  trackWindowBounds(graphWin, 'graph');

  if (VITE_DEV_SERVER_URL) {
    graphWin.loadURL(VITE_DEV_SERVER_URL + '/?mode=graph');
  } else {
    graphWin.loadFile(path.join(RENDERER_DIST, 'index.html'), { query: { mode: 'graph' } });
  }

  // Save final bounds before window is destroyed
  graphWin.on('close', () => {
    if (graphWin && !graphWin.isDestroyed()) {
      appConfig.windowLayout = {
        ...appConfig.windowLayout,
        graph: boundsToRel(graphWin.getBounds(), graphWin.isMaximized()),
      };
      saveAppConfig({});
    }
  });

  graphWin.on('closed', () => {
    graphWin = null;
    if (win && !win.isDestroyed()) {
      win.webContents.send('graph:closed');
    }
  });
}

// ─── Preview window ───────────────────────────────────────────────────────────

function createPreviewWindow(hidden = false) {
  const MIN = { minWidth: 400, minHeight: 300 };
  const saved = appConfig.windowLayout?.preview;
  const restored = saved ? relToBounds(saved, MIN) : null;

  previewWin = new BrowserWindow({
    width: restored?.width ?? 720,
    height: restored?.height ?? 640,
    ...(restored ? { x: restored.x, y: restored.y } : {}),
    minWidth: MIN.minWidth,
    minHeight: MIN.minHeight,
    show: !hidden,
    title: 'Code Preview — Purl',
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (restored?.isMaximized) previewWin.maximize();
  trackWindowBounds(previewWin, 'preview');

  if (VITE_DEV_SERVER_URL) {
    previewWin.loadURL(VITE_DEV_SERVER_URL + '/preview.html');
  } else {
    previewWin.loadFile(path.join(RENDERER_DIST, 'preview.html'));
  }

  // Save final bounds before window is destroyed
  previewWin.on('close', () => {
    if (previewWin && !previewWin.isDestroyed()) {
      appConfig.windowLayout = {
        ...appConfig.windowLayout,
        preview: boundsToRel(previewWin.getBounds(), previewWin.isMaximized()),
      };
      saveAppConfig({});
    }
  });

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

  if (restored?.isMaximized) win.maximize();
  trackWindowBounds(win, 'main');

  if (frameless) {
    // Forward maximize/unmaximize events to renderer
    win.on('maximize',   () => win?.webContents.send('window:maximized', true));
    win.on('unmaximize', () => win?.webContents.send('window:maximized', false));
  }

  // Intercept close to allow renderer to confirm / save first
  let closeConfirmed = false;
  win.on('close', (e) => {
    // Save main window bounds + child open state before quitting
    if (win && !win.isDestroyed()) {
      appConfig.windowLayout = {
        ...appConfig.windowLayout,
        main: boundsToRel(win.getBounds(), win.isMaximized()),
        previewOpen: !!(previewWin && !previewWin.isDestroyed()),
        graphOpen:   !!(graphWin && !graphWin.isDestroyed()),
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
    // Destroy child windows so they don't linger after the main window is gone
    if (previewWin && !previewWin.isDestroyed()) { previewWin.destroy(); previewWin = null; }
    if (graphWin   && !graphWin.isDestroyed())   { graphWin.destroy();   graphWin   = null; }
    win = null;
  });

  win.once('ready-to-show', () => {
    const elapsed = Date.now() - splashStart;
    const delay = Math.max(0, 2000 - elapsed);
    setTimeout(() => {
      win?.show();
      // Show child windows that were created hidden during startup
      if (previewWin && !previewWin.isDestroyed() && !previewWin.isVisible()) previewWin.show();
      if (graphWin   && !graphWin.isDestroyed()   && !graphWin.isVisible())   graphWin.show();
      // Hide splash first, then destroy after delay to avoid GPU compositor crash
      // (BrowserWindow.close() triggers GPU resource cleanup that can cause 0xC000041D)
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
// <img src="localfile:///abs/path/to/file.jpg"> works in renderer

app.whenReady().then(async () => {
  await loadAppConfig();

  if (appConfig.titleBarStyle === 'custom') {
    Menu.setApplicationMenu(null);
  }

  protocol.handle('localfile', (request) => {
    const filePath = decodeURIComponent(request.url.replace('localfile://', ''));
    return net.fetch('file://' + filePath);
  });

  // Ensure base projects dir exists
  fs.mkdir(PROJECTS_DIR, { recursive: true }).catch(() => {});

  splashStart = Date.now();
  createSplashWindow();
  createWindow();

  // Restore child windows that were open in previous session (hidden until splash ends)
  if (appConfig.windowLayout?.previewOpen) createPreviewWindow(true);
  if (appConfig.windowLayout?.graphOpen)   createGraphWindow(true);
});

// ─── IPC: preview window ─────────────────────────────────────────────────────

ipcMain.handle('preview:toggle', () => {
  if (previewWin && !previewWin.isDestroyed()) {
    previewWin.close();
    previewWin = null;
    appConfig.windowLayout = { ...appConfig.windowLayout, previewOpen: false };
    saveAppConfig({});
    return false;
  }
  createPreviewWindow();
  appConfig.windowLayout = { ...appConfig.windowLayout, previewOpen: true };
  saveAppConfig({});
  return true;
});

ipcMain.handle('preview:update', (_e, code: string) => {
  lastPreviewCode = code;
  if (previewWin && !previewWin.isDestroyed()) {
    previewWin.webContents.send('preview:code', code);
  }
});

// Preview window signals it's ready → send cached code immediately
ipcMain.handle('preview:ready', (e) => {
  if (lastPreviewCode !== null) {
    e.sender.send('preview:code', lastPreviewCode);
  }
});

// ─── IPC: graph window ───────────────────────────────────────────────────────

ipcMain.handle('graph:toggle', () => {
  if (graphWin && !graphWin.isDestroyed()) {
    appConfig.windowLayout = { ...appConfig.windowLayout, graphOpen: false };
    saveAppConfig({});
    graphWin.close();
    graphWin = null;
    return false;
  }
  createGraphWindow();
  appConfig.windowLayout = { ...appConfig.windowLayout, graphOpen: true };
  saveAppConfig({});
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

ipcMain.handle('window:minimize',    (e) => { e.sender.getOwnerBrowserWindow()?.minimize(); });
ipcMain.handle('window:maximize',    (e) => {
  const bw = e.sender.getOwnerBrowserWindow();
  if (!bw) return;
  if (bw.isMaximized()) bw.unmaximize(); else bw.maximize();
});
ipcMain.handle('window:close',       (e) => { BrowserWindow.fromWebContents(e.sender)?.close(); });
ipcMain.handle('window:isMaximized', (e) => e.sender.getOwnerBrowserWindow()?.isMaximized() ?? false);

// ─── IPC: app config ──────────────────────────────────────────────────────────

ipcMain.handle('config:getTitleBarStyle', () => appConfig.titleBarStyle);
ipcMain.on('config:getTitleBarStyleSync', (e) => { e.returnValue = appConfig.titleBarStyle; });

ipcMain.handle('config:setTitleBarStyle', async (_e, style: TitleBarStyle) => {
  await saveAppConfig({ titleBarStyle: style });
  app.relaunch();
  app.exit(0);
});

// ─── IPC: window layout / workspace presets ──────────────────────────────────

ipcMain.handle('config:getWindowLayout', () => ({
  workspacePresets: [
    ...BUILTIN_PRESETS.map(p => ({ id: p.id, name: p.name, builtIn: true })),
    ...(appConfig.workspacePresets ?? []).map(p => ({ id: p.id, name: p.name, builtIn: false })),
  ],
  activePresetId: appConfig.activePresetId ?? null,
}));

ipcMain.handle('config:getOpenWindows', () => ({
  previewOpen: !!(previewWin && !previewWin.isDestroyed()),
  graphOpen:   !!(graphWin && !graphWin.isDestroyed()),
}));

ipcMain.handle('config:saveWorkspacePreset', (_e, name: string) => {
  const layout: WindowLayoutSet = {
    previewOpen: !!(previewWin && !previewWin.isDestroyed()),
    graphOpen:   !!(graphWin && !graphWin.isDestroyed()),
  };
  if (win && !win.isDestroyed()) {
    layout.main = boundsToRel(win.getBounds(), win.isMaximized());
  }
  if (previewWin && !previewWin.isDestroyed()) {
    layout.preview = boundsToRel(previewWin.getBounds(), previewWin.isMaximized());
  }
  if (graphWin && !graphWin.isDestroyed()) {
    layout.graph = boundsToRel(graphWin.getBounds(), graphWin.isMaximized());
  }
  const preset: WorkspacePreset = { id: crypto.randomUUID(), name, layout };
  const presets = [...(appConfig.workspacePresets ?? []), preset];
  appConfig.workspacePresets = presets;
  saveAppConfig({});
  return preset;
});

ipcMain.handle('config:overwriteWorkspacePreset', (_e, id: string) => {
  const layout: WindowLayoutSet = {
    previewOpen: !!(previewWin && !previewWin.isDestroyed()),
    graphOpen:   !!(graphWin && !graphWin.isDestroyed()),
  };
  if (win && !win.isDestroyed()) {
    layout.main = boundsToRel(win.getBounds(), win.isMaximized());
  }
  if (previewWin && !previewWin.isDestroyed()) {
    layout.preview = boundsToRel(previewWin.getBounds(), previewWin.isMaximized());
  }
  if (graphWin && !graphWin.isDestroyed()) {
    layout.graph = boundsToRel(graphWin.getBounds(), graphWin.isMaximized());
  }
  appConfig.workspacePresets = (appConfig.workspacePresets ?? []).map(p =>
    p.id === id ? { ...p, layout } : p
  );
  appConfig.activePresetId = id;
  appConfig.windowLayout = layout;
  saveAppConfig({});
});

ipcMain.handle('config:deleteWorkspacePreset', (_e, id: string) => {
  appConfig.workspacePresets = (appConfig.workspacePresets ?? []).filter(p => p.id !== id);
  if (appConfig.activePresetId === id) appConfig.activePresetId = null;
  saveAppConfig({});
});

ipcMain.handle('config:renameWorkspacePreset', (_e, id: string, name: string) => {
  appConfig.workspacePresets = (appConfig.workspacePresets ?? []).map(p =>
    p.id === id ? { ...p, name } : p
  );
  saveAppConfig({});
});

ipcMain.handle('config:applyWorkspacePreset', (_e, id: string) => {
  const preset = BUILTIN_PRESETS.find(p => p.id === id)
    ?? (appConfig.workspacePresets ?? []).find(p => p.id === id);
  if (!preset) return;

  const MINS = {
    main:    { minWidth: 900, minHeight: 600 },
    preview: { minWidth: 400, minHeight: 300 },
    graph:   { minWidth: 500, minHeight: 400 },
  } as const;

  // Main window — reposition
  if (preset.layout.main && win && !win.isDestroyed()) {
    const b = relToBounds(preset.layout.main, MINS.main);
    if (b.isMaximized) { win.maximize(); }
    else { win.unmaximize(); win.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height }); }
  }

  // Preview — open/close + reposition
  if (preset.layout.previewOpen) {
    if (!previewWin || previewWin.isDestroyed()) createPreviewWindow();
    if (preset.layout.preview && previewWin && !previewWin.isDestroyed()) {
      const b = relToBounds(preset.layout.preview, MINS.preview);
      if (b.isMaximized) { previewWin.maximize(); }
      else { previewWin.unmaximize(); previewWin.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height }); }
    }
  } else if (previewWin && !previewWin.isDestroyed()) {
    previewWin.close();
    previewWin = null;
  }

  // Graph — open/close + reposition
  if (preset.layout.graphOpen) {
    if (!graphWin || graphWin.isDestroyed()) createGraphWindow();
    if (preset.layout.graph && graphWin && !graphWin.isDestroyed()) {
      const b = relToBounds(preset.layout.graph, MINS.graph);
      if (b.isMaximized) { graphWin.maximize(); }
      else { graphWin.unmaximize(); graphWin.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height }); }
    }
  } else if (graphWin && !graphWin.isDestroyed()) {
    graphWin.close();
    graphWin = null;
  }

  appConfig.activePresetId = id;
  appConfig.windowLayout = preset.layout;
  saveAppConfig({});

  // Notify renderer about open/closed state changes
  if (win && !win.isDestroyed()) {
    win.webContents.send('windows:openState', {
      previewOpen: !!(previewWin && !previewWin.isDestroyed()),
      graphOpen:   !!(graphWin && !graphWin.isDestroyed()),
    });
  }
});

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.on('window-all-closed', () => {
  // Only quit when the main window has actually been closed (win is null).
  // Child windows closing must not terminate the whole app.
  if (process.platform !== 'darwin' && win === null) {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
