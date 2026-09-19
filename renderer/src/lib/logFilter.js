/*
 * Log filtering for the Logs tab toolbar. Pure functions over the log buffer —
 * no Vue, no IPC — so the matching rules can be unit tested on their own.
 */

export const STATUS_BUCKETS = [
  { id: '2xx', min: 200, max: 299 },
  { id: '3xx', min: 300, max: 399 },
  { id: '4xx', min: 400, max: 499 },
  { id: '5xx', min: 500, max: 599 },
];

// Methods we want in a stable, familiar order; anything else is appended alphabetically.
const METHOD_ORDER = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export function statusBucketOf(entry) {
  const code = Number.parseInt(entry?.statusCode, 10);
  if (!Number.isFinite(code)) {
    return null;
  }
  const bucket = STATUS_BUCKETS.find((range) => code >= range.min && code <= range.max);
  return bucket ? bucket.id : null;
}

export function methodsInLogs(logs) {
  const seen = new Set();
  logs.forEach((entry) => {
    if (entry?.method) {
      seen.add(String(entry.method).toUpperCase());
    }
  });

  return [...seen].sort((a, b) => {
    const rankA = METHOD_ORDER.indexOf(a);
    const rankB = METHOD_ORDER.indexOf(b);
    if (rankA === -1 && rankB === -1) return a.localeCompare(b);
    if (rankA === -1) return 1;
    if (rankB === -1) return -1;
    return rankA - rankB;
  });
}

// Everything a search term is allowed to match: method, proxy path, destination
// and — for the runtime lines that carry no request — the message itself.
export function searchHaystack(entry) {
  return [entry?.method, entry?.proxyPath, entry?.destinationPath, entry?.message, entry?.statusCode]
    .filter((part) => part !== null && part !== undefined && part !== '')
    .join(' ')
    .toLowerCase();
}

export function hasActiveFilter({ search = '', statuses = [], methods = [] } = {}) {
  return search.trim().length > 0 || statuses.length > 0 || methods.length > 0;
}

/**
 * Always returns a fresh array, even when nothing is filtered out: the Logs tab
 * watches this result by identity to detect new entries, and the main-process ring
 * buffer means a plain length comparison would miss arrivals once it is full.
 */
export function filterLogs(logs, { search = '', statuses = [], methods = [] } = {}) {
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const statusSet = new Set(statuses);
  const methodSet = new Set(methods);

  if (!terms.length && !statusSet.size && !methodSet.size) {
    return logs.slice();
  }

  return logs.filter((entry) => {
    if (statusSet.size && !statusSet.has(statusBucketOf(entry))) {
      return false;
    }
    if (methodSet.size && !methodSet.has(String(entry?.method || '').toUpperCase())) {
      return false;
    }
    if (terms.length) {
      const haystack = searchHaystack(entry);
      return terms.every((term) => haystack.includes(term));
    }
    return true;
  });
}

/**
 * How many entries were appended to `next` after the last entry of `prev`.
 * Returns 0 when the two lists do not share that anchor — which is what happens
 * when the filters change rather than when traffic arrives.
 */
export function countAppended(next, prev) {
  if (!prev.length || !next.length) {
    return 0;
  }

  const anchorId = prev[prev.length - 1]._id;
  for (let index = next.length - 1; index >= 0; index -= 1) {
    if (next[index]._id === anchorId) {
      return next.length - 1 - index;
    }
  }

  return 0;
}
