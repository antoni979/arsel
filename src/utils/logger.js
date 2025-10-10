// src/utils/logger.js

/**
 * Sistema de logging condicional para desarrollo/producción
 *
 * En producción: Solo errores críticos
 * En desarrollo: Logs completos con contexto
 */

const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// En producción solo mostramos errores, en desarrollo todo
const currentLogLevel = isDevelopment ? LOG_LEVELS.DEBUG : LOG_LEVELS.ERROR;

class Logger {
  constructor(context = 'App') {
    this.context = context;
  }

  _log(level, levelName, message, ...args) {
    if (level < currentLogLevel) return;

    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = `[${timestamp}] [${this.context}]`;

    switch (level) {
      case LOG_LEVELS.DEBUG:
        console.log(`${prefix} 🔍`, message, ...args);
        break;
      case LOG_LEVELS.INFO:
        console.log(`${prefix} ℹ️`, message, ...args);
        break;
      case LOG_LEVELS.WARN:
        console.warn(`${prefix} ⚠️`, message, ...args);
        break;
      case LOG_LEVELS.ERROR:
        console.error(`${prefix} ❌`, message, ...args);
        break;
    }
  }

  debug(message, ...args) {
    this._log(LOG_LEVELS.DEBUG, 'DEBUG', message, ...args);
  }

  info(message, ...args) {
    this._log(LOG_LEVELS.INFO, 'INFO', message, ...args);
  }

  warn(message, ...args) {
    this._log(LOG_LEVELS.WARN, 'WARN', message, ...args);
  }

  error(message, ...args) {
    this._log(LOG_LEVELS.ERROR, 'ERROR', message, ...args);
  }

  // Helper para crear loggers con contexto específico
  static create(context) {
    return new Logger(context);
  }
}

// Logger por defecto
export const logger = new Logger('App');

// Factory para crear loggers con contexto
export const createLogger = (context) => new Logger(context);

// Export para usar en console.log existentes sin cambiar mucho código
export default logger;
