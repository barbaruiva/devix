/*
 * Minimal JSON syntax highlighter for the detail panel's body view.
 * Regex-based on purpose: no new dependency, and the input is already a
 * pretty-printed string produced by `bodyTooltipValue`.
 *
 * Every function here returns HTML that is escaped first and marked up second,
 * so the result is safe to hand to `v-html`.
 */

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

// Bodies are capped at 256 KB by the runtime; wrapping that many tokens in spans
// would cost more than the highlight is worth, so past this size we render plain.
export const HIGHLIGHT_LIMIT = 60000;

const JSON_TOKEN =
  /("(?:\\.|[^"\\])*")(\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>]/g, (char) => HTML_ESCAPES[char]);
}

export function isJsonText(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed || !/^[[{]/.test(trimmed)) {
    return false;
  }
  try {
    JSON.parse(trimmed);
    return true;
  } catch (_error) {
    return false;
  }
}

export function highlightJson(text) {
  const source = String(text ?? '');
  if (source.length > HIGHLIGHT_LIMIT || !isJsonText(source)) {
    return escapeHtml(source);
  }

  // Escaping first is safe for the tokenizer: it never introduces a quote or a
  // backslash, so string boundaries stay exactly where they were.
  return escapeHtml(source).replace(JSON_TOKEN, (match, quoted, colon) => {
    if (quoted !== undefined) {
      return colon
        ? `<span class="tok-key">${quoted}</span>${colon}`
        : `<span class="tok-string">${quoted}</span>`;
    }
    if (match === 'true' || match === 'false') {
      return `<span class="tok-boolean">${match}</span>`;
    }
    if (match === 'null') {
      return `<span class="tok-null">${match}</span>`;
    }
    return `<span class="tok-number">${match}</span>`;
  });
}
