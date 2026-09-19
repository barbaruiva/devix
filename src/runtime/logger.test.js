const { Logger } = require('./logger');

describe('Logger', () => {
  test('info emits entry to subscribers with correct level', () => {
    const logger = new Logger();
    const entries = [];
    logger.subscribe((e) => entries.push(e));
    logger.info('hello');
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe('info');
    expect(entries[0].message).toBe('hello');
  });

  test('error emits entry to subscribers with correct level', () => {
    const logger = new Logger();
    const entries = [];
    logger.subscribe((e) => entries.push(e));
    logger.error('oops');
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe('error');
    expect(entries[0].message).toBe('oops');
  });

  test('entry includes ISO timestamp', () => {
    const logger = new Logger();
    const entries = [];
    logger.subscribe((e) => entries.push(e));
    logger.info('ts test');
    expect(entries[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(new Date(entries[0].timestamp).toISOString()).toBe(entries[0].timestamp);
  });

  test('extra data fields are spread into entry', () => {
    const logger = new Logger();
    const entries = [];
    logger.subscribe((e) => entries.push(e));
    logger.info('msg', undefined, { statusCode: 200, method: 'GET' });
    expect(entries[0].statusCode).toBe(200);
    expect(entries[0].method).toBe('GET');
  });

  test('gui: false suppresses emission to subscribers', () => {
    const logger = new Logger();
    const entries = [];
    logger.subscribe((e) => entries.push(e));
    logger.info('hidden', undefined, { gui: false });
    expect(entries).toHaveLength(0);
  });

  test('subscribe returns working unsubscribe function', () => {
    const logger = new Logger();
    const entries = [];
    const unsub = logger.subscribe((e) => entries.push(e));
    logger.info('first');
    unsub();
    logger.info('second');
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe('first');
  });

  test('multiple subscribers each receive entries', () => {
    const logger = new Logger();
    const a = [];
    const b = [];
    logger.subscribe((e) => a.push(e));
    logger.subscribe((e) => b.push(e));
    logger.info('shared');
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  test('unsubscribing one does not affect others', () => {
    const logger = new Logger();
    const a = [];
    const b = [];
    const unsubA = logger.subscribe((e) => a.push(e));
    logger.subscribe((e) => b.push(e));
    logger.info('before');
    unsubA();
    logger.info('after');
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(2);
  });
});
