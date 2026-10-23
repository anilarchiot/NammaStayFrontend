const path = require('node:path');
const { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, shell } = require('electron');
const { createLocalServer } = require('../local-server.cjs');
const { createLocalStore } = require('./local-store.cjs');

const ROOT = path.resolve(__dirname, '../..');
const HOST = '127.0.0.1';
const PORT = 4174;
const ORIGIN = `http://${HOST}:${PORT}`;
const VALID_KEY = /^[\w.-]{1,100}$/;
let localStore;
let server;

function assertTrustedSender(event) {
  const senderUrl = event.senderFrame?.url || event.sender?.getURL?.() || '';
  const senderOrigin = senderUrl ? new URL(senderUrl).origin : '';
  if (senderOrigin !== ORIGIN) {
    throw new Error('Local data requests are only accepted from the NammaStay desktop app.');
  }
}

function registerLocalStoreIpc() {
  ipcMain.handle('local-store:get', (event, namespace, key) => {
    assertTrustedSender(event);
    return localStore.get(namespace, key);
  });
  ipcMain.handle('local-store:set', (event, namespace, key, value) => {
    assertTrustedSender(event);
    localStore.set(namespace, key, value);
  });
  ipcMain.handle('local-store:delete', (event, namespace, key) => {
    assertTrustedSender(event);
    return localStore.delete(namespace, key);
  });
  ipcMain.handle('local-store:list', (event, namespace) => {
    assertTrustedSender(event);
    if (typeof namespace !== 'string' || !VALID_KEY.test(namespace)) throw new TypeError('Invalid local data namespace.');
    return localStore.list(namespace);
  });
  ipcMain.handle('desktop-window:minimize', (event) => {
    assertTrustedSender(event);
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.handle('desktop-window:toggle-maximize', (event) => {
    assertTrustedSender(event);
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) throw new Error('The application window is unavailable.');
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
    return window.isMaximized();
  });
  ipcMain.handle('desktop-window:close', (event) => {
    assertTrustedSender(event);
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
}

function openExternal(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') shell.openExternal(parsed.href);
  } catch {
    // Ignore malformed navigation requests.
  }
}

async function createWindow() {
  server = await createLocalServer(ROOT, { port: PORT, host: HOST });
  localStore = await createLocalStore({ directory: app.getPath('userData'), safeStorage });
  registerLocalStoreIpc();

  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 640,
    frame: false,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.once('ready-to-show', () => {
    window.maximize();
    window.show();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== ORIGIN) {
      event.preventDefault();
      openExternal(url);
    }
  });
  await window.loadURL(`${ORIGIN}/`);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  Menu.setApplicationMenu(null);
  app.whenReady().then(createWindow).catch((error) => {
    dialog.showErrorBox('NammaStay could not start', error.message);
    app.quit();
  });

  app.on('before-quit', () => {
    if (localStore) localStore.close();
    if (server) server.close();
  });

  app.on('window-all-closed', () => app.quit());
}
