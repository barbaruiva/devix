import {
  bodyTooltipValue,
  destinationParts,
  hasInspectableData,
  headerRows,
  headerTooltipValue,
} from './inspect.js';

describe('hasInspectableData', () => {
  test('rejects nullish and empty values', () => {
    expect(hasInspectableData(null)).toBe(false);
    expect(hasInspectableData(undefined)).toBe(false);
    expect(hasInspectableData('   ')).toBe(false);
    expect(hasInspectableData([])).toBe(false);
    expect(hasInspectableData({})).toBe(false);
  });

  test('accepts non-empty values of every shape', () => {
    expect(hasInspectableData('a')).toBe(true);
    expect(hasInspectableData(['a'])).toBe(true);
    expect(hasInspectableData({ a: 1 })).toBe(true);
    expect(hasInspectableData(0)).toBe(true);
  });
});

describe('headerRows', () => {
  test('parses a raw header string', () => {
    expect(headerRows('content-type: application/json\nx-id: 7')).toEqual([
      { name: 'Content-Type', value: 'application/json' },
      { name: 'X-Id', value: '7' },
    ]);
  });

  test('parses an array of header lines', () => {
    expect(headerRows(['accept: */*'])).toEqual([{ name: 'Accept', value: '*/*' }]);
  });

  test('handles a line without a separator', () => {
    expect(headerRows(['weird'])).toEqual([{ name: 'Weird', value: '' }]);
  });

  test('joins array values and serializes object values', () => {
    expect(headerRows({ 'set-cookie': ['a=1', 'b=2'], meta: { k: 1 } })).toEqual([
      { name: 'Set-Cookie', value: 'a=1, b=2' },
      { name: 'Meta', value: '{"k":1}' },
    ]);
  });

  test('returns nothing for empty input', () => {
    expect(headerRows(null)).toEqual([]);
    expect(headerRows('')).toEqual([]);
  });
});

describe('headerTooltipValue', () => {
  test('renders one line per header', () => {
    expect(headerTooltipValue({ 'content-type': 'text/plain', 'x-a': ['1', '2'] })).toBe(
      'Content-Type: text/plain\nX-A: 1, 2',
    );
  });

  test('passes a raw string through and empties nullish input', () => {
    expect(headerTooltipValue('raw: value')).toBe('raw: value');
    expect(headerTooltipValue(undefined)).toBe('');
  });
});

describe('bodyTooltipValue', () => {
  test('pretty-prints JSON bodies', () => {
    expect(bodyTooltipValue({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  test('returns non-JSON bodies verbatim', () => {
    expect(bodyTooltipValue('plain text')).toBe('plain text');
  });

  test('returns an empty string when there is nothing to show', () => {
    expect(bodyTooltipValue('')).toBe('');
    expect(bodyTooltipValue({})).toBe('');
  });

  test('survives a circular body', () => {
    const circular = { name: 'loop' };
    circular.self = circular;
    expect(bodyTooltipValue(circular)).toBe('Not available');
  });
});

describe('destinationParts', () => {
  test('splits the configured base from the proxied suffix', () => {
    expect(
      destinationParts({ destinationPath: 'http://localhost:3001/users/1', destinationBase: 'http://localhost:3001' }),
    ).toEqual({ base: 'http://localhost:3001', suffix: '/users/1' });
  });

  test('keeps the whole value when the base does not match', () => {
    expect(destinationParts({ destinationPath: 'http://other/users', destinationBase: 'http://localhost:3001' })).toEqual({
      base: null,
      suffix: 'http://other/users',
    });
  });

  test('falls back to the log message, then to a dash', () => {
    expect(destinationParts({ message: 'Route not supported' })).toEqual({
      base: null,
      suffix: 'Route not supported',
    });
    expect(destinationParts({})).toEqual({ base: null, suffix: '-' });
  });
});
