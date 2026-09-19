/*
 * Pure formatting helpers shared by the log views. No Vue, no IPC — safe to unit test.
 */

export function formatTimestamp(timestamp) {
  if (!timestamp) {
    return '-';
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleString();
}

export function formatTime(timestamp) {
  if (!timestamp) {
    return '-';
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleTimeString();
}

export function toTitleCaseHeader(headerName) {
  return String(headerName)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('-');
}

export function describeSize(text) {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}
