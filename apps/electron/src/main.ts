/**
 * main.ts — DEEP Desktop App main process
 *
 * Strategy:
 *   dev  → load http://localhost:5173 (Vite dev server)
 *   prod → load DEEP_BACKEND_URL (Railway — no local file serving needed,
 *          the app is a real-time chat requiring internet anyway)
 *
 * Features:
 *   • Frameless window (frame: false) with custom titlebar via preload
 *   • Single instance lock — second launch focuses existing window
 *   • System tray with context menu; close button hides to tray
 *   • Auto-updater via GitHub Releases (electron-updater)
 *   • IPC: window-minimize / window-maximize / window-close
 *   • IPC: native-notify, set-badge
 */

import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  Notification,
  dialog,
  session,
  shell,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';

// ── Constants ───────────────────────────────────────────────────────────────
const isDev       = !app.isPackaged;
const BACKEND_URL = process.env.DEEP_BACKEND_URL || 'https://deep-production-ac13.up.railway.app';
const LOAD_URL    = isDev ? 'http://localhost:5173' : BACKEND_URL;

// ── Singletons ───────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// ── Single-instance lock ──────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:           1300,
    height:          820,
    minWidth:        900,
    minHeight:       600,
    frame:           false,          // Custom titlebar rendered in the web app
    titleBarStyle:   'hidden',
    backgroundColor: '#121110',      // Ember dark — prevents white flash on load
    show:            false,
    icon:            getIconPath(),
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      webSecurity:      true,
      // Allow loading the Railway URL
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.loadURL(LOAD_URL);

  // Enable DevTools in dev
  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });

  // Show only when ready — prevents white flash
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // Close → hide to tray instead of quit
  mainWindow.on('close', (e) => {
    if (!(app as any).isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // Open external links in the default browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ── Tray ─────────────────────────────────────────────────────────────────────
function createTray() {
  const icon = nativeImage.createFromPath(getIconPath());
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('DEEP');

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open DEEP',
      click: () => { mainWindow?.show(); mainWindow?.focus(); },
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => { if (!isDev) autoUpdater.checkForUpdates(); },
    },
    {
      label: 'Open in Browser',
      click: () => shell.openExternal(BACKEND_URL),
    },
    { type: 'separator' },
    {
      label: 'Quit DEEP',
      click: () => { (app as any).isQuitting = true; app.quit(); },
    },
  ]);

  tray.setContextMenu(menu);
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

// ── IPC: Window controls ─────────────────────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.hide()); // hide to tray

// ── IPC: Native features ─────────────────────────────────────────────────────
ipcMain.on('native-notify', (_e, { title, body }: { title: string; body: string }) => {
  if (!mainWindow?.isVisible() && Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
});

ipcMain.on('set-badge', (_e, count: number) => {
  if (process.platform === 'darwin') app.setBadgeCount(count);
  // Windows taskbar badge requires a separate overlay icon approach
});

// ── Auto-updater (production only) ───────────────────────────────────────────
function setupUpdater() {
  if (isDev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', () => {
    dialog.showMessageBox(mainWindow!, {
      type:    'info',
      title:   'Update Available',
      message: 'A new version of DEEP is downloading in the background…',
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow!, {
      type:    'info',
      title:   'Ready to Update',
      message: 'DEEP will restart to apply the update.',
      buttons: ['Restart Now', 'Later'],
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getIconPath() {
  return isDev
    ? path.join(__dirname, '../assets/icon.png')
    : path.join(process.resourcesPath, 'icon.png');
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Security: Prevent navigation to unexpected origins
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['*://*/*'] },
    (details, callback) => {
      // Only allow navigation to our backend URL or localhost/devtools
      const url = new URL(details.url);
      const allowed =
        url.hostname === 'localhost' ||
        url.hostname === 'deep-production-ac13.up.railway.app' ||
        url.hostname.endsWith('.cloudinary.com') ||
        url.hostname.endsWith('.livekit.cloud') ||
        details.url.startsWith('devtools://') ||
        details.url.startsWith('chrome-extension://');

      callback({ cancel: !allowed });
    }
  );

  createWindow();
  createTray();
  setupUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else mainWindow?.show();
});

// Allow closing via isQuitting flag
(app as any).isQuitting = false;
