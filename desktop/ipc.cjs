const { BrowserWindow, ipcMain } = require('electron');
const { ORIGIN, VALID_KEY } = require('./config.cjs');

/** Rejects IPC calls that do not originate from the app's own local origin. */
function assertTrustedSender(event) {
  const senderUrl = event.senderFrame?.url || event.sender?.getURL?.() || '';
  const senderOrigin = senderUrl ? new URL(senderUrl).origin : '';
  if (senderOrigin !== ORIGIN) {
    throw new Error('Local data requests are only accepted from the NammaStay desktop app.');
  }
}

function registerLocalStoreHandlers(localStore) {
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
}

function registerWindowHandlers() {
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

function registerIpcHandlers(localStore) {
  registerLocalStoreHandlers(localStore);
  registerWindowHandlers();
}

module.exports = { registerIpcHandlers };
