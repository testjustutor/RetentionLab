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

const logger = winston.createLogger({
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

    // Error logs by date
    new winston.transports.File({
      filename: path.join(logDir, `error-${currentDate}.log`),
      level: 'error'
    }),

    // Combined logs by date
    new winston.transports.File({
      filename: path.join(logDir, `combined-${currentDate}.log`)
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