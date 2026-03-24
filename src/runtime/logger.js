const { EventEmitter } = require('events');

class Logger {
  constructor() {
    this.emitter = new EventEmitter();
  }

  emit(level, message, terminalMessage, data = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...data,
    };

    if (data.gui !== false) {
      this.emitter.emit('log', entry);
    }

    const output = terminalMessage || message;
    if (level === 'error') {
      console.error(output);
      return;
    }
    console.log(output);
  }

  info(message, terminalMessage, data = {}) {
    this.emit('info', message, terminalMessage, data);
  }

  error(message, terminalMessage, data = {}) {
    this.emit('error', message, terminalMessage, data);
  }

  subscribe(listener) {
    this.emitter.on('log', listener);
    return () => this.emitter.off('log', listener);
  }
}

module.exports = {
  Logger,
};
