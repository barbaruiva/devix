const { ProxyRuntime } = require('./src/runtime/proxyRuntime');

const runtime = new ProxyRuntime();
runtime.start({
  configPath: './config.json',
  proxiesPath: './proxies.json',
});

function shutdown(signal) {
  runtime
    .stop()
    .catch((error) => {
      console.error(`Failed to stop server on ${signal}:`, error);
    })
    .finally(() => {
      process.exit(0);
    });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
