const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildRuntimeState, readJson, writeJson } = require('./proxyRuntime');

const baseProxiesConfig = {
  port: 3000,
  proxies: [
    {
      name: 'API 1',
      path: '/api1',
      routes: {
        dev: { destination: 'http://localhost:8080' },
        stage: { destination: 'http://stage.example.com' },
      },
    },
  ],
};

describe('buildRuntimeState', () => {
  test('uses configured active route', () => {
    const state = buildRuntimeState(baseProxiesConfig, { activeRoutes: { '/api1': 'stage' } });
    expect(state.proxies[0].activeRoute).toBe('stage');
  });

  test('falls back to first route when none configured', () => {
    const state = buildRuntimeState(baseProxiesConfig, { activeRoutes: {} });
    expect(state.proxies[0].activeRoute).toBe('dev');
  });

  test('falls back to first route when configured route does not exist', () => {
    const state = buildRuntimeState(baseProxiesConfig, { activeRoutes: { '/api1': 'nonexistent' } });
    expect(state.proxies[0].activeRoute).toBe('dev');
  });

  test('sets port from proxies config', () => {
    const state = buildRuntimeState(baseProxiesConfig, {});
    expect(state.port).toBe(3000);
  });

  test('returns all proxies', () => {
    const config = {
      port: 3000,
      proxies: [
        { name: 'A', path: '/a', routes: { dev: { destination: 'http://a.com' } } },
        { name: 'B', path: '/b', routes: { dev: { destination: 'http://b.com' } } },
      ],
    };
    const state = buildRuntimeState(config, {});
    expect(state.proxies).toHaveLength(2);
  });

  test('throws on duplicate proxy paths', () => {
    const config = {
      port: 3000,
      proxies: [
        { name: 'A', path: '/api', routes: { dev: { destination: 'http://a.com' } } },
        { name: 'B', path: '/api', routes: { dev: { destination: 'http://b.com' } } },
      ],
    };
    expect(() => buildRuntimeState(config, {})).toThrow('Duplicate proxy path detected: /api');
  });

  test('throws when proxy is missing path', () => {
    const config = {
      port: 3000,
      proxies: [{ name: 'A', routes: { dev: { destination: 'http://a.com' } } }],
    };
    expect(() => buildRuntimeState(config, {})).toThrow('missing "path"');
  });

  test('throws when proxy has no routes', () => {
    const config = {
      port: 3000,
      proxies: [{ name: 'A', path: '/api', routes: {} }],
    };
    expect(() => buildRuntimeState(config, {})).toThrow('has no routes');
  });

  test('spreads extra proxy fields into result', () => {
    const config = {
      port: 3000,
      proxies: [
        { name: 'A', path: '/api', routes: { dev: { destination: 'http://a.com' } } },
      ],
    };
    const state = buildRuntimeState(config, {});
    expect(state.proxies[0].name).toBe('A');
    expect(state.proxies[0].path).toBe('/api');
  });
});

describe('readJson', () => {
  let tmpFile;

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `devix-test-${Date.now()}.json`);
  });

  afterEach(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  test('reads and parses valid JSON', () => {
    fs.writeFileSync(tmpFile, '{"key":"value","num":42}');
    expect(readJson(tmpFile, 'test')).toEqual({ key: 'value', num: 42 });
  });

  test('throws with label on invalid JSON', () => {
    fs.writeFileSync(tmpFile, '{invalid json}');
    expect(() => readJson(tmpFile, 'myfile')).toThrow('Invalid JSON in myfile');
  });
});

describe('writeJson', () => {
  let tmpFile;

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `devix-test-${Date.now()}.json`);
  });

  afterEach(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  test('writes pretty-printed JSON with trailing newline', () => {
    writeJson(tmpFile, { key: 'value' });
    expect(fs.readFileSync(tmpFile, 'utf8')).toBe('{\n  "key": "value"\n}\n');
  });

  test('written file can be re-read as valid JSON', () => {
    const data = { port: 3000, proxies: [] };
    writeJson(tmpFile, data);
    expect(readJson(tmpFile, 'test')).toEqual(data);
  });
});
