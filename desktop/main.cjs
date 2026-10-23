const { app, dialog, Menu, safeStorage } = require('electron');
const { createLocalServer } = require('../scripts/local-server.cjs');
const { HOST, PORT, ROOT } = require('./config.cjs');
const { registerIpcHandlers } = require('./ipc.cjs');
const { createLocalStore } = require('./local-store.cjs');
const { createMainWindow } = require('./window.cjs');

let localStore;
let server;

async function start() {
  server = await createLocalServer(ROOT, { port: PORT, host: HOST });
  localStore = await createLocalStore({ directory: app.getPath('userData'), safeStorage });
  registerIpcHandlers(localStore);
  await createMainWindow();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  Menu.setApplicationMenu(null);
  app.whenReady().then(start).catch((error) => {
    dialog.showErrorBox('NammaStay could not start', error.message);
    app.quit();
  });

  app.on('before-quit', () => {
    if (localStore) localStore.close();
    if (server) server.close();
  });

  app.on('window-all-closed', () => app.quit());
}
