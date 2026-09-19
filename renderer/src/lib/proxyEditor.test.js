import {
  DEFAULT_PORT,
  fingerprint,
  toEditorState,
  toProxiesConfig,
  validateEditor,
} from './proxyEditor.js';

const raw = {
  port: 4000,
  proxies: [
    {
      name: 'Users',
      path: '/users',
      routes: {
        local: { destination: 'http://localhost:3001/users' },
        staging: { destination: 'https://staging.example.com/users' },
      },
    },
  ],
};

function state(...proxies) {
  return toEditorState({ port: 4000, proxies });
}

describe('toEditorState', () => {
  test('turns the route object into an ordered list of pairs', () => {
    const editor = toEditorState(raw);
    expect(editor.port).toBe(4000);
    expect(editor.proxies).toHaveLength(1);
    expect(editor.proxies[0].routes.map((route) => [route.key, route.destination])).toEqual([
      ['local', 'http://localhost:3001/users'],
      ['staging', 'https://staging.example.com/users'],
    ]);
  });

  test('gives every proxy and route a stable id', () => {
    const editor = toEditorState(raw);
    const ids = [editor.proxies[0].id, ...editor.proxies[0].routes.map((route) => route.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('falls back to defaults for an empty or missing config', () => {
    expect(toEditorState(null)).toEqual({ port: DEFAULT_PORT, proxies: [] });
    expect(toEditorState({ proxies: [{}] }).proxies[0]).toMatchObject({ name: '', path: '', routes: [] });
  });
});

describe('toProxiesConfig', () => {
  test('round-trips back to the proxies.json shape', () => {
    expect(toProxiesConfig(toEditorState(raw))).toEqual(raw);
  });

  test('coerces a port typed as text', () => {
    expect(toProxiesConfig({ port: '8080', proxies: [] }).port).toBe(8080);
  });
});

describe('fingerprint', () => {
  test('ignores the editor-only ids', () => {
    expect(fingerprint(toEditorState(raw))).toBe(fingerprint(toEditorState(raw)));
  });

  test('changes when a field, the order or the port changes', () => {
    const base = fingerprint(toEditorState(raw));

    const renamed = toEditorState(raw);
    renamed.proxies[0].name = 'People';
    expect(fingerprint(renamed)).not.toBe(base);

    const reordered = toEditorState(raw);
    reordered.proxies[0].routes.reverse();
    expect(fingerprint(reordered)).not.toBe(base);

    const repotted = toEditorState(raw);
    repotted.port = 4001;
    expect(fingerprint(repotted)).not.toBe(base);
  });

  test('sees a route renamed onto its sibling, which the saved shape would collapse', () => {
    const collided = toEditorState(raw);
    collided.proxies[0].routes[1].key = 'local';
    expect(fingerprint(collided)).not.toBe(fingerprint(toEditorState(raw)));
  });
});

describe('validateEditor', () => {
  test('accepts a valid config', () => {
    const result = validateEditor(toEditorState(raw));
    expect(result).toMatchObject({ valid: true, count: 0 });
    expect(result.proxies[0]).toMatchObject({ path: null, routes: null });
    expect(result.proxies[0].routeErrors).toEqual([
      { key: null, destination: null },
      { key: null, destination: null },
    ]);
  });

  test('flags the later of two proxies sharing a path', () => {
    const result = validateEditor(
      state(
        { name: 'Users', path: '/api', routes: { local: { destination: 'http://localhost:3001' } } },
        { name: 'Orders', path: '/api', routes: { local: { destination: 'http://localhost:3002' } } },
      ),
    );

    expect(result.valid).toBe(false);
    expect(result.count).toBe(1);
    expect(result.proxies[0].path).toBeNull();
    expect(result.proxies[1].path).toBe('Path already used by "Users"');
  });

  test('requires a path that starts with a slash', () => {
    const missing = validateEditor(state({ name: 'A', path: '', routes: { l: { destination: 'http://a.dev' } } }));
    expect(missing.proxies[0].path).toBe('Path is required');

    const relative = validateEditor(state({ name: 'A', path: 'api', routes: { l: { destination: 'http://a.dev' } } }));
    expect(relative.proxies[0].path).toBe('Path must start with "/"');
  });

  test('flags a proxy left without routes', () => {
    const result = validateEditor(state({ name: 'A', path: '/a', routes: {} }));
    expect(result.proxies[0].routes).toBe('Add at least one route');
  });

  test('flags empty and duplicated route names inside the same proxy', () => {
    const editor = state({
      name: 'A',
      path: '/a',
      routes: { local: { destination: 'http://a.dev' }, stage: { destination: 'http://b.dev' } },
    });
    editor.proxies[0].routes[1].key = 'local';
    editor.proxies[0].routes.push({ id: 'r3', key: '  ', destination: 'http://c.dev' });

    const result = validateEditor(editor);
    expect(result.proxies[0].routeErrors.map((error) => error.key)).toEqual([
      null,
      'Duplicate route name',
      'Route name is required',
    ]);
  });

  test('rejects destinations without a protocol or a host', () => {
    const editor = state({
      name: 'A',
      path: '/a',
      routes: {
        a: { destination: 'localhost:3001' },
        b: { destination: 'http://' },
        c: { destination: '' },
        d: { destination: 'https://ok.example.com' },
      },
    });

    const errors = validateEditor(editor).proxies[0].routeErrors.map((error) => error.destination);
    expect(errors).toEqual([
      'Destination needs a protocol, e.g. http://',
      'Destination is missing a host',
      'Destination is required',
      null,
    ]);
  });

  test('counts every problem it found', () => {
    const result = validateEditor(state({ name: 'A', path: 'a', routes: { '': { destination: 'nope' } } }));
    expect(result.count).toBe(3);
    expect(result.valid).toBe(false);
  });
});
