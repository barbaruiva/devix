import { activeDestination, effectiveRoute, routeKeys } from './routes.js';

const proxy = {
  name: 'Users',
  path: '/users',
  activeRoute: 'staging',
  routes: {
    local: { destination: 'http://localhost:3001/users' },
    staging: { destination: 'https://staging.example.com/users' },
  },
};

describe('routeKeys', () => {
  test('lists the configured routes in declaration order', () => {
    expect(routeKeys(proxy)).toEqual(['local', 'staging']);
  });

  test('returns an empty list for a proxy without routes', () => {
    expect(routeKeys({ name: 'Broken' })).toEqual([]);
    expect(routeKeys({ routes: null })).toEqual([]);
    expect(routeKeys(undefined)).toEqual([]);
  });
});

describe('effectiveRoute', () => {
  test('keeps the active route when it exists', () => {
    expect(effectiveRoute(proxy)).toBe('staging');
  });

  test('falls back to the first route when the active one is missing', () => {
    expect(effectiveRoute({ ...proxy, activeRoute: 'gone' })).toBe('local');
    expect(effectiveRoute({ ...proxy, activeRoute: undefined })).toBe('local');
  });

  test('returns an empty string when there is nothing to fall back to', () => {
    expect(effectiveRoute({ routes: {} })).toBe('');
  });
});

describe('activeDestination', () => {
  test('resolves the destination of the active route', () => {
    expect(activeDestination(proxy)).toBe('https://staging.example.com/users');
  });

  test('follows the fallback route', () => {
    expect(activeDestination({ ...proxy, activeRoute: 'gone' })).toBe('http://localhost:3001/users');
  });

  test('returns an empty string when the route carries no destination', () => {
    expect(activeDestination({ activeRoute: 'local', routes: { local: {} } })).toBe('');
    expect(activeDestination({ routes: {} })).toBe('');
  });
});
