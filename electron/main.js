const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, dialog, ipcMain, Menu, Tray, nativeImage } = require('electron');
const { ProxyRuntime } = require('../src/runtime/proxyRuntime');

const runtime = new ProxyRuntime();
const configPath = path.resolve(__dirname, '..', 'config.json');
const proxiesPath = path.resolve(__dirname, '..', 'proxies.json');
const logsBuffer = [];
const MAX_LOGS = 1000;
const trayIconPath = path.join(__dirname, 'assets', 'tray-icon.png');
let tray = null;
let mainWindow = null;

function appendLog(entry) {
  logsBuffer.push(entry);
  if (logsBuffer.length > MAX_LOGS) {
    logsBuffer.shift();
  }

  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('logs:entry', entry);
  }
}

runtime.logger.subscribe(appendLog);

function broadcastStatus(status) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('status:updated', status);
  }
}

runtime.onStatusChange(broadcastStatus);

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'renderer', 'index.html'));
  }

  mainWindow.on('close', (event) => {
    if (app.isQuitting) {
      return;
    }
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function showMainWindow() {
  createWindow();
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  if (process.platform === 'linux') {
    // Best-effort raise for Linux WMs/Wayland/XWayland focus restrictions.
    try {
      app.focus({ steal: true });
    } catch (_error) {
      // no-op
    }
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  mainWindow.show();
  mainWindow.moveTop();
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.focus();
  mainWindow.focusOnWebView();
  mainWindow.setAlwaysOnTop(false);

  if (process.platform === 'linux') {
    mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: true });
  }
}

function notifyConfigUpdated() {
  const config = runtime.getConfig();
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('config:updated', config);
  }
}

async function updateRouteFromTray(proxyPath, routeKey) {
  try {
    runtime.setActiveRoute(proxyPath, routeKey);
    await runtime.reload();
    refreshTrayMenu();
    notifyConfigUpdated();
  } catch (error) {
    runtime.logger.error(`Failed to update route from tray for ${proxyPath}: ${error.message}`);
  }
}

function buildProxyMenuItem(proxy) {
  const routeItems = Object.keys(proxy.routes || {}).map((routeKey) => ({
    label: routeKey,
    type: 'checkbox',
    checked: routeKey === proxy.activeRoute,
    click: () => {
      updateRouteFromTray(proxy.path, routeKey);
    },
  }));

  return {
    label: `${proxy.name} (${proxy.path}) - ${proxy.activeRoute}`,
    submenu: routeItems,
  };
}

function refreshTrayMenu() {
  if (!tray) {
    return;
  }

  const config = runtime.getConfig();
  const proxyItems = (config?.proxies || []).map(buildProxyMenuItem);
  const menuTemplate = [
    { label: `Devix v${app.getVersion()}`, enabled: false },
    { type: 'separator' },
    ...proxyItems,
    { type: 'separator' },
    {
      label: 'Show Window',
      click: () => {
        showMainWindow();
      },
    },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ];

  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate));
}

function createTray() {
  if (tray) {
    return;
  }

  const icon = nativeImage.createFromPath(trayIconPath);
  tray = new Tray(icon);
  tray.setToolTip('Devix');
  refreshTrayMenu();

  tray.on('click', () => {
    showMainWindow();
  });

  tray.on('right-click', () => {
    refreshTrayMenu();
    tray.popUpContextMenu();
  });
}

ipcMain.handle('config:get', async () => runtime.getConfig());

ipcMain.handle('status:get', async () => runtime.getStatus());

ipcMain.handle('proxy:set-active-route', async (_, payload) => {
  const { proxyKey, routeKey } = payload || {};

  if (!proxyKey || !routeKey) {
    return { success: false, error: 'Missing proxyKey or routeKey' };
  }

  try {
    const updatedProxy = runtime.setActiveRoute(proxyKey, routeKey);
    await runtime.reload();
    refreshTrayMenu();
    notifyConfigUpdated();

    return {
      success: true,
      updatedProxy,
      config: runtime.getConfig(),
    };
  } catch (error) {
    runtime.logger.error(`Failed to update route for ${proxyKey}: ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('logs:subscribe', async () => logsBuffer);

ipcMain.handle('proxies:get', async () => {
  return JSON.parse(fs.readFileSync(proxiesPath, 'utf8'));
});

ipcMain.handle('proxies:save', async (_, config) => {
  try {
    await runtime.updateProxiesConfig(config);
    refreshTrayMenu();
    notifyConfigUpdated();
    return { success: true, config: runtime.getConfig() };
  } catch (error) {
    runtime.logger.error(`Failed to save proxies: ${error.message}`);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  try {
    runtime.start({ configPath, proxiesPath });
  } catch (error) {
    dialog.showErrorBox('Failed to start proxy runtime', error.message || String(error));
    app.quit();
    return;
  }

  createTray();
  showMainWindow();

  app.on('activate', () => {
    showMainWindow();
  });
});

app.on('window-all-closed', () => {
  // Keep app alive in tray when all windows are closed.
});

app.on('before-quit', async (event) => {
  if (app.isQuitting) {
    return;
  }

  app.isQuitting = true;
  event.preventDefault();

  try {
    await runtime.stop();
  } catch (error) {
    console.error('Failed to stop proxy runtime:', error);
  } finally {
    if (tray) {
      tray.destroy();
      tray = null;
    }
    app.quit();
  }
});
