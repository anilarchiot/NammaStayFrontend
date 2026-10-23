const { contextBridge, ipcRenderer } = require('electron');

function addDesktopTitlebar() {
  if (!document.body || document.getElementById('ns-desktop-titlebar')) return;

  const titlebar = document.createElement('header');
  titlebar.id = 'ns-desktop-titlebar';
  titlebar.setAttribute('aria-label', 'NammaStay application window controls');
  titlebar.innerHTML = `
    <div class="ns-desktop-brand" aria-label="NammaStay">
      <img src="assets/img/logo.png" alt="">
      <span>Namma<span>Stay</span></span>
    </div>
    <div class="ns-desktop-drag"></div>
    <div class="ns-desktop-controls">
      <button type="button" data-window-action="minimize" aria-label="Minimize window" title="Minimize">
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8"/></svg>
      </button>
      <button type="button" data-window-action="maximize" aria-label="Maximize window" title="Maximize">
        <svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="2.5" width="7" height="7" rx=".4"/></svg>
      </button>
      <button type="button" data-window-action="close" aria-label="Close NammaStay" title="Close">
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 3 6 6m0-6L3 9"/></svg>
      </button>
    </div>`;
  document.body.prepend(titlebar);

  const style = document.createElement('style');
  style.id = 'ns-desktop-titlebar-style';
  style.textContent = `
    #ns-desktop-titlebar {
      align-items:center;background:#FBF3DE;border-bottom:1px solid #E7DFC7;
      box-sizing:border-box;color:#0E1B3D;display:flex;height:38px;left:0;
      padding-left:12px;position:sticky;right:0;top:0;user-select:none;
      z-index:2147483000;-webkit-app-region:drag;
      font:600 12px Manrope,system-ui,-apple-system,"Segoe UI",sans-serif
    }
    #ns-desktop-titlebar .ns-desktop-brand{align-items:center;display:flex;flex:none;gap:7px}
    #ns-desktop-titlebar .ns-desktop-brand img{height:23px;object-fit:contain;width:23px}
    #ns-desktop-titlebar .ns-desktop-brand>span{font-size:13px;font-weight:800;letter-spacing:-.2px}
    #ns-desktop-titlebar .ns-desktop-brand>span>span{color:#1C9A6C}
    #ns-desktop-titlebar .ns-desktop-drag{align-self:stretch;flex:1}
    #ns-desktop-titlebar .ns-desktop-controls{align-self:stretch;display:flex;-webkit-app-region:no-drag}
    #ns-desktop-titlebar .ns-desktop-controls button{
      align-items:center;background:transparent;border:0;color:#0E1B3D;cursor:pointer;
      display:flex;justify-content:center;padding:0;width:46px
    }
    #ns-desktop-titlebar .ns-desktop-controls button:hover{background:#E7DFC7}
    #ns-desktop-titlebar .ns-desktop-controls button[data-window-action=close]:hover{background:#C42B1C;color:#fff}
    #ns-desktop-titlebar svg{fill:none;height:12px;stroke:currentColor;stroke-linecap:round;stroke-width:1.2;width:12px}
    #ns-desktop-titlebar button:focus-visible{outline:2px solid #1C9A6C;outline-offset:-3px}
    body.ns-desktop-window{margin-top:0!important}
  `;
  document.head.append(style);
  document.body.classList.add('ns-desktop-window');

  titlebar.querySelectorAll('[data-window-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.windowAction;
      if (action === 'minimize') window.NS_DESKTOP.windowControls.minimize();
      if (action === 'maximize') window.NS_DESKTOP.windowControls.toggleMaximize();
      if (action === 'close') window.NS_DESKTOP.windowControls.close();
    });
  });
  titlebar.addEventListener('dblclick', (event) => {
    if (event.target.closest('.ns-desktop-controls')) return;
    window.NS_DESKTOP.windowControls.toggleMaximize();
  });
}

contextBridge.exposeInMainWorld('NS_DESKTOP', Object.freeze({
  platform: process.platform,
  windowControls: Object.freeze({
    minimize: () => ipcRenderer.invoke('desktop-window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('desktop-window:toggle-maximize'),
    close: () => ipcRenderer.invoke('desktop-window:close'),
  }),
  localStore: Object.freeze({
    get: (namespace, key) => ipcRenderer.invoke('local-store:get', namespace, key),
    set: (namespace, key, value) => ipcRenderer.invoke('local-store:set', namespace, key, value),
    delete: (namespace, key) => ipcRenderer.invoke('local-store:delete', namespace, key),
    list: (namespace) => ipcRenderer.invoke('local-store:list', namespace),
  }),
}));

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addDesktopTitlebar, { once: true });
} else {
  addDesktopTitlebar();
}
