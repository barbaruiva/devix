const fs = require('fs');
const path = require('path');
const express = require('express');
const chalk = require('chalk');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { Logger } = require('./logger');

function readJson(filePath, fileLabel) {
  const resolvedPath = path.resolve(filePath);
  const raw = fs.readFileSync(resolvedPath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${fileLabel} (${resolvedPath}): ${error.message}`);
  }
}

function writeJson(filePath, data) {
  const resolvedPath = path.resolve(filePath);
  fs.writeFileSync(resolvedPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function loadRuntimeConfig(configPath) {
  const config = readJson(configPath, 'config file');
  if (!config.activeRoutes || typeof config.activeRoutes !== 'object') {
    return { activeRoutes: {} };
  }
  return config;
}

function loadProxiesConfig(proxiesPath) {
  const config = readJson(proxiesPath, 'proxies file');
  if (!Array.isArray(config.proxies)) {
    throw new Error(`Invalid proxies file (${path.resolve(proxiesPath)}): "proxies" must be an array`);
  }
  return config;
}

function buildRuntimeState(proxiesConfig, runtimeConfig) {
  const activeRoutes = runtimeConfig.activeRoutes || {};
  const usedPaths = new Set();
  const proxies = proxiesConfig.proxies.map((proxy) => {
    if (!proxy.path) {
      throw new Error(`Invalid proxy entry: missing "path" for ${proxy.name || '<unknown>'}`);
    }

    if (usedPaths.has(proxy.path)) {
      throw new Error(`Duplicate proxy path detected: ${proxy.path}`);
    }
    usedPaths.add(proxy.path);

    const availableRoutes = Object.keys(proxy.routes || {});
    if (availableRoutes.length === 0) {
      throw new Error(`Proxy ${proxy.name || proxy.path} has no routes`);
    }

    const configuredRoute = activeRoutes[proxy.path] || proxy.activeRoute;
    const activeRoute = proxy.routes[configuredRoute] ? configuredRoute : availableRoutes[0];

    return {
      ...proxy,
      activeRoute,
    };
  });

  return {
    port: proxiesConfig.port,
    proxies,
  };
}

function colorizeStatusCode(statusCode) {
  const code = Number(statusCode);
  if (!Number.isFinite(code)) {
    return chalk.red(String(statusCode));
  }

  if (code < 200) return chalk.blue(code);
  if (code < 300) return chalk.green(code);
  if (code < 400) return chalk.blue(code);
  if (code < 500) return chalk.yellow(code);
  return chalk.red(code);
}

function colorizeRoute(route) {
  switch (route) {
    case 'prod':
      return chalk.bold.red(route);
    case 'stage':
      return chalk.bold.yellow(route);
    default:
      return chalk.bold.green(route);
  }
}

function getRequestSize(req) {
  const rawSize = req.headers['content-length'];
  if (Array.isArray(rawSize)) {
    return Number.parseInt(rawSize[0], 10) || 0;
  }
  return Number.parseInt(rawSize, 10) || 0;
}

class ProxyRuntime {
  constructor() {
    this.logger = new Logger();
    this.server = null;
    this.app = null;
    this.config = null;
    this.configPath = null;
    this.proxiesPath = null;
    this.watchers = [];
    this.reloadTimer = null;
    this.isReloading = false;
    this.pendingReload = false;
    this.ignoreWatchEventsUntil = 0;
  }

  getConfig() {
    return this.config;
  }

  loadState() {
    const proxiesConfig = loadProxiesConfig(this.proxiesPath);
    const runtimeConfig = loadRuntimeConfig(this.configPath);
    return {
      proxiesConfig,
      runtimeConfig,
      runtimeState: buildRuntimeState(proxiesConfig, runtimeConfig),
    };
  }

  start(options = {}) {
    if (this.server) {
      throw new Error('Proxy runtime already started');
    }

    if (typeof options === 'string') {
      this.configPath = path.resolve(options);
      this.proxiesPath = path.resolve('./proxies.json');
    } else {
      this.configPath = path.resolve(options.configPath || './config.json');
      this.proxiesPath = path.resolve(options.proxiesPath || './proxies.json');
    }

    const state = this.loadState();
    this.config = state.runtimeState;

    const app = express();
    this.app = app;

    this.config.proxies.forEach((proxy) => {
      const routeConfig = proxy.routes[proxy.activeRoute];
      if (!routeConfig) {
        this.logger.error(
          `Invalid route configuration for proxy ${proxy.name}. Active route: ${proxy.activeRoute}`,
          `Invalid route configuration for proxy ${chalk.bold(proxy.name)}. Active route: ${proxy.activeRoute}`,
        );
        return;
      }

      this.logger.info(
        `Proxy ${proxy.name}@${proxy.activeRoute} | ${proxy.path} -> ${routeConfig.destination}`,
        `Proxy ${chalk.bold(proxy.name)}@${colorizeRoute(proxy.activeRoute)} | ${proxy.path} -> ${routeConfig.destination}`,
        { gui: false },
      );

      const middlewareConfig = {
        target: routeConfig.destination,
        changeOrigin: true,
        onProxyRes: (proxyRes, req) => {
          const proxiedPath = proxyRes.req.path === '/' ? '' : proxyRes.req.path;
          const destinationPath = `${routeConfig.destination}${proxiedPath}`;
          const statusCode = Number.parseInt(proxyRes.statusCode, 10) || 0;
          const method = req.method;
          const requestSize = getRequestSize(req);
          this.logger.info(
            `[${statusCode}] ${method.padStart(7)} ${proxy.path}${req.path || ''} -> ${destinationPath}`,
            `[${colorizeStatusCode(statusCode)}] ${method.padStart(7)} ${proxy.path}${chalk.gray(req.path || '')} -> ${routeConfig.destination}${chalk.gray(proxiedPath)}`,
            {
              kind: 'request',
              statusCode,
              method,
              proxyPath: proxy.path,
              destinationPath,
              requestSize,
            },
          );
        },
        onError: (err, req, res) => {
          const statusCode = 500;
          const method = req.method;
          const proxiedPath = req.path || '';
          const destinationPath = `${routeConfig.destination}${proxiedPath}`;
          const requestSize = getRequestSize(req);
          this.logger.error(
            `[${statusCode}] ${method.padStart(7)} ${proxy.path}${proxiedPath} -> ${destinationPath}`,
            `[${colorizeStatusCode(statusCode)}] ${method.padStart(7)} ${proxy.path}${chalk.gray(proxiedPath)} -> ${routeConfig.destination}${chalk.gray(proxiedPath)}`,
            {
              kind: 'request',
              statusCode,
              method,
              proxyPath: proxy.path,
              destinationPath,
              requestSize,
            },
          );

          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
          }
          res.end(JSON.stringify({ error: err.message || String(err) }));
        },
        pathRewrite: { [`^${proxy.path}`]: '' },
        logLevel: 'silent',
      };

      app.use(proxy.path, createProxyMiddleware(middlewareConfig));
    });

    app.use('/', (req, res) => {
      if (req.path === '/favicon.ico') {
        return;
      }
      this.logger.error(
        `[ERR] ${req.method.padStart(7)} ${req.path} -> Route not supported`,
        `[${chalk.red('ERR')}] ${req.method.padStart(7)} ${req.path} -> Route not supported`,
      );
      res.status(500).send(`Route not supported: <b>${req.path}</b>`);
    });

    this.server = app.listen(this.config.port, () => {
      const message = `Server started on port ${this.config.port} with ${this.config.proxies.length} ${this.config.proxies.length > 1 ? 'proxies' : 'proxy'}`;
      this.logger.info(
        message,
        undefined,
        {
          kind: 'lifecycle',
          statusCode: 200,
          method: 'INFO',
          proxyPath: '-',
          destinationPath: message,
          requestSize: null,
        },
      );
    });

    this.server.on('error', (error) => {
      this.logger.error(`Server failed to listen on port ${this.config.port}: ${error.message}`);
    });

    this.startWatchers();
  }

  stop() {
    this.stopWatchers();

    if (!this.server) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const server = this.server;
      this.server = null;
      this.app = null;

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        this.logger.info('Server stopped', undefined, { gui: false });
        resolve();
      });
    });
  }

  async reload() {
    if (!this.configPath || !this.proxiesPath) {
      throw new Error('Proxy runtime has not been started yet');
    }

    await this.stop();
    this.start({
      configPath: this.configPath,
      proxiesPath: this.proxiesPath,
    });
  }

  setActiveRoute(proxyKey, routeKey) {
    if (!this.configPath || !this.proxiesPath) {
      throw new Error('Proxy runtime has not been started yet');
    }

    const { proxiesConfig, runtimeConfig, runtimeState } = this.loadState();
    const proxy = runtimeState.proxies.find((entry) => entry.name === proxyKey || entry.path === proxyKey);

    if (!proxy) {
      throw new Error(`Proxy not found: ${proxyKey}`);
    }

    if (!proxy.routes[routeKey]) {
      throw new Error(`Route not found for proxy ${proxy.name}: ${routeKey}`);
    }

    const nextRuntimeConfig = {
      ...runtimeConfig,
      activeRoutes: {
        ...(runtimeConfig.activeRoutes || {}),
        [proxy.path]: routeKey,
      },
    };

    this.ignoreWatchEventsUntil = Date.now() + 500;
    writeJson(this.configPath, nextRuntimeConfig);

    this.config = buildRuntimeState(proxiesConfig, nextRuntimeConfig);
    const updatedProxy = this.config.proxies.find((entry) => entry.path === proxy.path);
    return updatedProxy;
  }

  startWatchers() {
    this.stopWatchers();

    const watchTargets = [this.configPath, this.proxiesPath];
    watchTargets.forEach((filePath) => {
      const watcher = fs.watch(filePath, () => {
        if (Date.now() < this.ignoreWatchEventsUntil) {
          return;
        }
        this.scheduleReload(`Detected file change in ${path.basename(filePath)}`);
      });
      this.watchers.push(watcher);
    });
  }

  stopWatchers() {
    this.watchers.forEach((watcher) => watcher.close());
    this.watchers = [];
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }
  }

  scheduleReload(reason) {
    if (!this.server) {
      return;
    }

    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
    }

    this.reloadTimer = setTimeout(() => {
      this.reloadTimer = null;
      this.reloadFromFileChange(reason);
    }, 200);
  }

  async reloadFromFileChange(reason) {
    if (this.isReloading) {
      this.pendingReload = true;
      return;
    }

    this.isReloading = true;
    try {
      await this.reload();
      this.logger.info(reason, undefined, { gui: false });
    } catch (error) {
      this.logger.error(`Failed to reload after file change: ${error.message}`);
    } finally {
      this.isReloading = false;
      if (this.pendingReload) {
        this.pendingReload = false;
        this.scheduleReload('Reloading pending file changes');
      }
    }
  }
}

module.exports = {
  ProxyRuntime,
  readJson,
  writeJson,
  buildRuntimeState,
};
