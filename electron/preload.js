const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('proxyApi', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  getStatus: () => ipcRenderer.invoke('status:get'),
  onStatusUpdated: (callback) => {
    const handler = (_, status) => callback(status);
    ipcRenderer.on('status:updated', handler);
    return () => {
      ipcRenderer.removeListener('status:updated', handler);
    };
  },
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
  getProxiesConfig: () => ipcRenderer.invoke('proxies:get'),
  saveProxiesConfig: (config) => ipcRenderer.invoke('proxies:save', config),
});
