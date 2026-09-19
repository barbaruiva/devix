import { describeSize, formatTime, formatTimestamp, toTitleCaseHeader } from './format.js';

describe('formatTimestamp', () => {
  test('renders a dash for a missing timestamp', () => {
    expect(formatTimestamp(null)).toBe('-');
    expect(formatTimestamp('')).toBe('-');
  });

  test('returns the raw value when it is not a parseable date', () => {
    expect(formatTimestamp('not-a-date')).toBe('not-a-date');
  });

  test('formats a valid timestamp', () => {
    const iso = '2024-03-05T10:20:30.000Z';
    expect(formatTimestamp(iso)).toBe(new Date(iso).toLocaleString());
  });
});

describe('formatTime', () => {
  test('renders a dash for a missing timestamp', () => {
    expect(formatTime(undefined)).toBe('-');
  });

  test('formats only the time part', () => {
    const iso = '2024-03-05T10:20:30.000Z';
    expect(formatTime(iso)).toBe(new Date(iso).toLocaleTimeString());
  });
});

describe('toTitleCaseHeader', () => {
  test('title-cases each dash-separated segment', () => {
    expect(toTitleCaseHeader('content-TYPE')).toBe('Content-Type');
    expect(toTitleCaseHeader('x-request-id')).toBe('X-Request-Id');
  });

  test('drops empty segments', () => {
    expect(toTitleCaseHeader('--host--')).toBe('Host');
  });
});

describe('describeSize', () => {
  test('reports bytes below 1 KB', () => {
    expect(describeSize('abc')).toBe('3 B');
  });

  test('reports kilobytes above the threshold', () => {
    expect(describeSize('x'.repeat(2048))).toBe('2.0 KB');
  });

  test('counts bytes, not characters', () => {
    expect(describeSize('é')).toBe('2 B');
  });
});
