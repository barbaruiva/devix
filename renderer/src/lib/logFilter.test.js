import {
  countAppended,
  filterLogs,
  hasActiveFilter,
  methodsInLogs,
  searchHaystack,
  statusBucketOf,
} from './logFilter.js';

const entry = (overrides) => ({
  _id: 'log-1',
  method: 'GET',
  statusCode: 200,
  proxyPath: '/api',
  destinationPath: 'http://localhost:3001/users',
  ...overrides,
});

describe('statusBucketOf', () => {
  test('maps a status code to its range', () => {
    expect(statusBucketOf(entry({ statusCode: 204 }))).toBe('2xx');
    expect(statusBucketOf(entry({ statusCode: 302 }))).toBe('3xx');
    expect(statusBucketOf(entry({ statusCode: 404 }))).toBe('4xx');
    expect(statusBucketOf(entry({ statusCode: 500 }))).toBe('5xx');
  });

  test('returns null for entries that carry no status', () => {
    expect(statusBucketOf({ message: 'Server started' })).toBeNull();
    expect(statusBucketOf(entry({ statusCode: 0 }))).toBeNull();
  });
});

describe('methodsInLogs', () => {
  test('deduplicates, uppercases and keeps the familiar order', () => {
    const logs = [
      entry({ method: 'delete' }),
      entry({ method: 'GET' }),
      entry({ method: 'POST' }),
      entry({ method: 'GET' }),
      { message: 'Server started' },
    ];
    expect(methodsInLogs(logs)).toEqual(['GET', 'POST', 'DELETE']);
  });

  test('appends unknown methods alphabetically', () => {
    expect(methodsInLogs([entry({ method: 'TRACE' }), entry({ method: 'PURGE' }), entry({})])).toEqual([
      'GET',
      'PURGE',
      'TRACE',
    ]);
  });
});

describe('searchHaystack', () => {
  test('joins the searchable fields in lower case', () => {
    expect(searchHaystack(entry())).toBe('get /api http://localhost:3001/users 200');
  });

  test('falls back to the message of a non-request line', () => {
    expect(searchHaystack({ message: 'Route not supported' })).toBe('route not supported');
  });
});

describe('filterLogs', () => {
  const logs = [
    entry({ _id: 'a', method: 'GET', statusCode: 200, destinationPath: 'http://localhost:3001/users' }),
    entry({ _id: 'b', method: 'POST', statusCode: 404, destinationPath: 'http://localhost:3001/orders' }),
    entry({ _id: 'c', method: 'POST', statusCode: 500, proxyPath: '/billing', destinationPath: 'http://api/pay' }),
    { _id: 'd', message: 'Server started' },
  ];

  test('returns a copy when nothing is filtered', () => {
    const result = filterLogs(logs, {});
    expect(result).toEqual(logs);
    expect(result).not.toBe(logs);
  });

  test('matches a search term against any searchable field', () => {
    expect(filterLogs(logs, { search: 'orders' }).map((item) => item._id)).toEqual(['b']);
    expect(filterLogs(logs, { search: 'POST' }).map((item) => item._id)).toEqual(['b', 'c']);
    expect(filterLogs(logs, { search: 'started' }).map((item) => item._id)).toEqual(['d']);
  });

  test('requires every whitespace-separated term to match', () => {
    expect(filterLogs(logs, { search: 'post pay' }).map((item) => item._id)).toEqual(['c']);
    expect(filterLogs(logs, { search: 'post users' })).toEqual([]);
  });

  test('filters by status range and by method', () => {
    expect(filterLogs(logs, { statuses: ['4xx', '5xx'] }).map((item) => item._id)).toEqual(['b', 'c']);
    expect(filterLogs(logs, { methods: ['GET'] }).map((item) => item._id)).toEqual(['a']);
  });

  test('drops status-less lines once a status filter is active', () => {
    expect(filterLogs(logs, { statuses: ['2xx'] }).map((item) => item._id)).toEqual(['a']);
  });

  test('combines every criterion', () => {
    expect(filterLogs(logs, { search: 'localhost', methods: ['POST'], statuses: ['4xx'] }).map((i) => i._id)).toEqual([
      'b',
    ]);
  });
});

describe('hasActiveFilter', () => {
  test('ignores a blank search term', () => {
    expect(hasActiveFilter({ search: '   ' })).toBe(false);
    expect(hasActiveFilter({ search: 'a' })).toBe(true);
    expect(hasActiveFilter({ statuses: ['2xx'] })).toBe(true);
    expect(hasActiveFilter({ methods: ['GET'] })).toBe(true);
    expect(hasActiveFilter()).toBe(false);
  });
});

describe('countAppended', () => {
  const list = (...ids) => ids.map((id) => ({ _id: id }));

  test('counts the entries added after the previous tail', () => {
    expect(countAppended(list('a', 'b', 'c'), list('a'))).toBe(2);
  });

  test('still counts when the head was dropped by the ring buffer', () => {
    expect(countAppended(list('b', 'c', 'd'), list('a', 'b'))).toBe(2);
  });

  test('returns zero when the lists share no anchor — a filter change, not traffic', () => {
    expect(countAppended(list('x', 'y'), list('a', 'b'))).toBe(0);
    expect(countAppended(list('a'), [])).toBe(0);
    expect(countAppended([], list('a'))).toBe(0);
  });
});
