const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '../logs');

// Create logs directory if missing
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Format: 2026-05-29
const currentDate = new Date().toISOString().split('T')[0];

// Custom log levels
const customLevels = {
  levels: {
    critical: 0,
    error: 1,
    warn: 2,
    info: 3
  }
};

const logger = winston.createLogger({
  levels: customLevels.levels,

  level: process.env.LOG_LEVEL || 'info',

  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),

  defaultMeta: {
    service: 'zoom-transcript-bot'
  },

  transports: [
    // Critical logs
    new winston.transports.File({
      filename: path.join(logDir, `critical-${currentDate}.log`),
      level: 'critical'
    }),

    // Error logs
    new winston.transports.File({
      filename: path.join(logDir, `error-${currentDate}.log`),
      level: 'error'
    }),

    // Warning logs
    new winston.transports.File({
      filename: path.join(logDir, `warn-${currentDate}.log`),
      level: 'warn'
    }),

    // Info logs
    new winston.transports.File({
      filename: path.join(logDir, `info-${currentDate}.log`),
      level: 'info'
    }),

    // Console logs
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

module.exports = { logger };