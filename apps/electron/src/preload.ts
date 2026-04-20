/**
 * preload.ts — DEEP Desktop context bridge
 *
 * Exposes a safe window.deepAPI object to the renderer (web app).
 * The renderer MUST NOT have nodeIntegration: true — this is the
 * security boundary between the web app and the OS.
 */

import { contextBridge, ipcRenderer } from 'electron';

const deepAPI = {
  /** True iff running inside the DEEP Electron app */
  isElectron: true as const,

  /** 'win32' | 'darwin' | 'linux' */
  platform: process.platform as 'win32' | 'darwin' | 'linux',

  // ── Window controls ───────────────────────────────────────────────────────
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close:    () => ipcRenderer.send('window-close'),

  // ── Native notifications (when window is hidden) ──────────────────────────
  notify: (title: string, body: string) =>
    ipcRenderer.send('native-notify', { title, body }),

  // ── Taskbar / dock badge count ────────────────────────────────────────────
  setBadgeCount: (count: number) =>
    ipcRenderer.send('set-badge', count),
};

contextBridge.exposeInMainWorld('deepAPI', deepAPI);

// TypeScript declaration so the renderer can use window.deepAPI safely
export type DeepAPI = typeof deepAPI;
