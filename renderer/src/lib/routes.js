/*
 * Shape helpers for the Routes tab. A proxy reaches the renderer as
 * { name, path, activeRoute, routes: { [key]: { destination } } }. `buildRuntimeState`
 * already falls back to the first route when the configured one is missing, so these
 * mirror that rule instead of trusting `activeRoute` blindly — the tab still has to
 * render something sane while a hand-edited proxies.json is in flight.
 */

// Above this many routes the segmented control stops being a one-click affordance
// and turns into a cramped row, so the tab switches to a select.
export const SEGMENTED_MAX = 3;

export function routeKeys(proxy) {
  const routes = proxy?.routes;
  if (!routes || typeof routes !== 'object') {
    return [];
  }
  return Object.keys(routes);
}

export function effectiveRoute(proxy) {
  const keys = routeKeys(proxy);
  if (!keys.length) {
    return '';
  }
  return keys.includes(proxy?.activeRoute) ? proxy.activeRoute : keys[0];
}

export function activeDestination(proxy) {
  const destination = proxy?.routes?.[effectiveRoute(proxy)]?.destination;
  return typeof destination === 'string' && destination ? destination : '';
}
