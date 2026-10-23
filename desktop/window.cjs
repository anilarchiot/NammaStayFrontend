const { BrowserWindow, shell } = require('electron');
const { ORIGIN, PRELOAD_PATH } = require('./config.cjs');

function openExternal(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') shell.openExternal(parsed.href);
  } catch {
    // Ignore malformed navigation requests.
  }
}

async function createMainWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 640,
    frame: false,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: PRELOAD_PATH,
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
  return window;
}

module.exports = { createMainWindow };
