/*
 * Parsing of the captured request/response payloads. Headers reach the renderer as a
 * string, an array of lines or a plain object depending on where they were captured,
 * so every reader here has to accept all three shapes.
 */

import { toTitleCaseHeader } from './format.js';

export function hasInspectableData(data) {
  if (data === null || data === undefined) {
    return false;
  }

  if (typeof data === 'string') {
    return data.trim().length > 0;
  }

  if (Array.isArray(data)) {
    return data.length > 0;
  }

  if (typeof data === 'object') {
    return Object.keys(data).length > 0;
  }

  return true;
}

export function headerTooltipValue(headers) {
  if (!hasInspectableData(headers)) {
    return '';
  }

  if (typeof headers === 'string') {
    return headers;
  }

  if (Array.isArray(headers)) {
    return headers.map((line) => String(line)).join('\n');
  }

  if (typeof headers === 'object') {
    return Object.entries(headers)
      .map(([header, value]) => {
        const displayHeader = toTitleCaseHeader(header);
        if (Array.isArray(value)) {
          return `${displayHeader}: ${value.join(', ')}`;
        }
        if (value !== null && typeof value === 'object') {
          return `${displayHeader}: ${JSON.stringify(value)}`;
        }
        return `${displayHeader}: ${String(value)}`;
      })
      .join('\n');
  }

  return String(headers);
}

export function bodyTooltipValue(data) {
  if (!hasInspectableData(data)) {
    return '';
  }

  if (data === null || data === undefined) {
    return 'Not available';
  }

  if (typeof data === 'string') {
    return data || 'Not available';
  }

  try {
    return JSON.stringify(data, null, 2);
  } catch (_error) {
    return 'Not available';
  }
}

export function headerRows(headers) {
  if (!hasInspectableData(headers)) {
    return [];
  }

  const fromLine = (line) => {
    const text = String(line);
    const separator = text.indexOf(':');
    if (separator === -1) {
      return { name: toTitleCaseHeader(text.trim()), value: '' };
    }
    return {
      name: toTitleCaseHeader(text.slice(0, separator).trim()),
      value: text.slice(separator + 1).trim(),
    };
  };

  if (typeof headers === 'string') {
    return headers.split('\n').filter((line) => line.trim().length > 0).map(fromLine);
  }

  if (Array.isArray(headers)) {
    return headers.map(fromLine);
  }

  if (typeof headers === 'object') {
    return Object.entries(headers).map(([header, value]) => {
      if (Array.isArray(value)) {
        return { name: toTitleCaseHeader(header), value: value.join(', ') };
      }
      if (value !== null && typeof value === 'object') {
        return { name: toTitleCaseHeader(header), value: JSON.stringify(value) };
      }
      return { name: toTitleCaseHeader(header), value: String(value) };
    });
  }

  return [];
}

// Splits the destination into the configured base (dimmed) and the proxied suffix.
export function destinationParts(entry) {
  const fullDestination = entry.destinationPath || entry.message || '-';
  const base = entry.destinationBase;

  if (!base || typeof fullDestination !== 'string' || !fullDestination.startsWith(base)) {
    return {
      base: null,
      suffix: fullDestination,
    };
  }

  return {
    base,
    suffix: fullDestination.slice(base.length),
  };
}
