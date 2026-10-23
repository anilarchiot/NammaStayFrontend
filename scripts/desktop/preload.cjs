const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('NS_DESKTOP', Object.freeze({
  platform: process.platform,
  localStore: Object.freeze({
    get: (namespace, key) => ipcRenderer.invoke('local-store:get', namespace, key),
    set: (namespace, key, value) => ipcRenderer.invoke('local-store:set', namespace, key, value),
    delete: (namespace, key) => ipcRenderer.invoke('local-store:delete', namespace, key),
    list: (namespace) => ipcRenderer.invoke('local-store:list', namespace),
  }),
}));
