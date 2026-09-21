'use strict';

const { createLogger, format, transports } = require('winston');
const { combine, timestamp, colorize, printf, errors } = format;
const path = require('path');
const { config } = require('../config');

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const logger = createLogger({
  level: config.logLevel,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        errors({ stack: true }),
        timestamp({ format: 'HH:mm:ss' }),
        logFormat
      ),
    }),
    new transports.File({
      filename: path.join('logs', 'app.log'),
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 3,
    }),
    new transports.File({
      filename: path.join('logs', 'errors.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
    }),
  ],
});

module.exports = logger;
