import { HIGHLIGHT_LIMIT, escapeHtml, highlightJson, isJsonText } from './highlight.js';

describe('escapeHtml', () => {
  test('escapes the characters that could open a tag', () => {
    expect(escapeHtml('<b>a & b</b>')).toBe('&lt;b&gt;a &amp; b&lt;/b&gt;');
  });

  test('handles nullish input', () => {
    expect(escapeHtml(null)).toBe('');
  });
});

describe('isJsonText', () => {
  test('accepts objects and arrays only', () => {
    expect(isJsonText('{"a":1}')).toBe(true);
    expect(isJsonText('  [1, 2] ')).toBe(true);
    expect(isJsonText('plain text')).toBe(false);
    expect(isJsonText('42')).toBe(false);
    expect(isJsonText('{ broken')).toBe(false);
    expect(isJsonText('')).toBe(false);
  });
});

describe('highlightJson', () => {
  test('marks keys apart from string values', () => {
    expect(highlightJson('{"name": "devix"}')).toBe(
      '{<span class="tok-key">"name"</span>: <span class="tok-string">"devix"</span>}',
    );
  });

  test('marks numbers, booleans and null', () => {
    expect(highlightJson('[1, -2.5e3, true, false, null]')).toBe(
      '[<span class="tok-number">1</span>, <span class="tok-number">-2.5e3</span>, ' +
        '<span class="tok-boolean">true</span>, <span class="tok-boolean">false</span>, ' +
        '<span class="tok-null">null</span>]',
    );
  });

  test('does not tokenize inside string values', () => {
    expect(highlightJson('["true 42"]')).toBe('[<span class="tok-string">"true 42"</span>]');
  });

  test('escapes markup before highlighting', () => {
    expect(highlightJson('{"html": "<script>"}')).toBe(
      '{<span class="tok-key">"html"</span>: <span class="tok-string">"&lt;script&gt;"</span>}',
    );
  });

  test('returns escaped plain text for non-JSON bodies', () => {
    expect(highlightJson('a < b & c')).toBe('a &lt; b &amp; c');
  });

  test('skips highlighting past the size limit', () => {
    const big = `{"a": "${'x'.repeat(HIGHLIGHT_LIMIT)}"}`;
    expect(highlightJson(big)).toBe(escapeHtml(big));
  });
});
