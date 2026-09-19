/*
 * Editor model for the Settings tab.
 *
 * `proxies.json` stores routes as an object keyed by environment name, which is the wrong
 * shape for a form: keys are editable, can collide and have to keep their order while the
 * user types. The editor therefore works on a list-of-pairs copy and converts back only on
 * save. Everything here is pure so the rules the runtime enforces after the write can be
 * checked before it — see `buildRuntimeState` in `src/runtime/proxyRuntime.js`.
 */

export const DEFAULT_PORT = 12345;

// Editor rows need a key that survives reordering and renaming; the index does not, and
// neither does the route name (it is the very thing being edited).
let uid = 0;
function nextId(prefix) {
  uid += 1;
  return `${prefix}-${uid}`;
}

export function toEditorProxy(proxy) {
  return {
    id: nextId('proxy'),
    name: proxy?.name || '',
    path: proxy?.path || '',
    routes: Object.entries(proxy?.routes || {}).map(([key, value]) => ({
      id: nextId('route'),
      key,
      destination: value?.destination || '',
    })),
  };
}

export function toEditorState(raw) {
  return {
    port: raw?.port || DEFAULT_PORT,
    proxies: (raw?.proxies || []).map(toEditorProxy),
  };
}

export function emptyProxy() {
  return { id: nextId('proxy'), name: '', path: '/', routes: [emptyRoute()] };
}

export function emptyRoute() {
  return { id: nextId('route'), key: '', destination: 'http://' };
}

export function toProxiesConfig(state) {
  return {
    port: Number(state.port),
    proxies: state.proxies.map((proxy) => ({
      name: proxy.name,
      path: proxy.path,
      routes: Object.fromEntries(proxy.routes.map((route) => [route.key, { destination: route.destination }])),
    })),
  };
}

/*
 * Canonical string behind the dirty check. It keeps routes as an ordered list instead of
 * reusing `toProxiesConfig`, whose object collapses duplicate keys — renaming a route onto
 * a sibling's name is an edit, even though it is an invalid one.
 */
export function fingerprint(state) {
  return JSON.stringify({
    port: state.port,
    proxies: state.proxies.map((proxy) => [
      proxy.name,
      proxy.path,
      proxy.routes.map((route) => [route.key, route.destination]),
    ]),
  });
}

const PROTOCOL = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

function destinationError(value) {
  const destination = (value || '').trim();
  if (!destination) {
    return 'Destination is required';
  }
  if (!PROTOCOL.test(destination)) {
    return 'Destination needs a protocol, e.g. http://';
  }
  // `http://` is what a freshly added route starts with, so name that case precisely
  // instead of letting the URL parser call it malformed.
  if (!destination.replace(PROTOCOL, '')) {
    return 'Destination is missing a host';
  }
  try {
    if (!new URL(destination).hostname) {
      return 'Destination is missing a host';
    }
  } catch {
    return 'Destination is not a valid URL';
  }
  return null;
}

function pathError(proxy, index, state) {
  const path = proxy.path || '';
  if (!path) {
    return 'Path is required';
  }
  if (!path.startsWith('/')) {
    return 'Path must start with "/"';
  }
  // The runtime rejects the whole file on a collision, so point at the later entry only —
  // flagging both would make it look like two separate problems.
  const first = state.proxies.findIndex((other) => other.path === path);
  if (first !== -1 && first < index) {
    return `Path already used by "${state.proxies[first].name || state.proxies[first].path}"`;
  }
  return null;
}

/**
 * Mirrors the runtime's own rules: unique non-empty path, at least one route, and a usable
 * destination per route.
 *
 * @returns {{ valid: boolean, count: number, proxies: Array<{ path: string|null, routes: string|null, routeErrors: Array<{ key: string|null, destination: string|null }> }> }}
 */
export function validateEditor(state) {
  let count = 0;
  const bump = (message) => {
    if (message) {
      count += 1;
    }
    return message;
  };

  const proxies = state.proxies.map((proxy, index) => {
    const seenKeys = new Set();
    const routeErrors = proxy.routes.map((route) => {
      const key = (route.key || '').trim();
      let keyError = null;
      if (!key) {
        keyError = 'Route name is required';
      } else if (seenKeys.has(key)) {
        keyError = 'Duplicate route name';
      } else {
        seenKeys.add(key);
      }

      return {
        key: bump(keyError),
        destination: bump(destinationError(route.destination)),
      };
    });

    return {
      path: bump(pathError(proxy, index, state)),
      routes: bump(proxy.routes.length ? null : 'Add at least one route'),
      routeErrors,
    };
  });

  return { valid: count === 0, count, proxies };
}
