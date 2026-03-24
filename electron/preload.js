const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('proxyApi', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setActiveRoute: (proxyKey, routeKey) => ipcRenderer.invoke('proxy:set-active-route', { proxyKey, routeKey }),
  getLogHistory: () => ipcRenderer.invoke('logs:subscribe'),
  onConfigUpdated: (callback) => {
    const handler = (_, config) => callback(config);
    ipcRenderer.on('config:updated', handler);
    return () => {
      ipcRenderer.removeListener('config:updated', handler);
    };
  },
  onLogEntry: (callback) => {
    const handler = (_, entry) => callback(entry);
    ipcRenderer.on('logs:entry', handler);
    return () => {
      ipcRenderer.removeListener('logs:entry', handler);
    };
  },
});
