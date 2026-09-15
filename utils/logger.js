const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '../logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const currentDate = new Date().toISOString().split('T')[0];

const customLevels = {
  levels: {
    critical: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4
  }
};

const logger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.LOG_LEVEL || 'debug',

  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),

  defaultMeta: {
    service: 'zoom-transcript-bot'
  },

  transports: [
    new winston.transports.File({ filename: path.join(logDir, `critical-${currentDate}.log`), level: 'critical' }),
    new winston.transports.File({ filename: path.join(logDir, `error-${currentDate}.log`), level: 'error' }),
    new winston.transports.File({ filename: path.join(logDir, `warn-${currentDate}.log`), level: 'warn' }),
    new winston.transports.File({ filename: path.join(logDir, `info-${currentDate}.log`), level: 'info' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// ─────────────────────────────────────────────
// CONSECUTIVE-DUPLICATE COLLAPSE
//
// Wraps each level method (info/warn/error/critical/debug) rather than
// hooking into `format`, because a format function can only reshape ONE
// entry — it can't emit a separate "repeated N times" summary line for
// the streak that just ended. This wrapper can: it calls straight through
// to the real winston method (`raw[level]`, captured before wrapping, so
// there's no re-entrancy) for both the flush summary and the new line.
//
// KEY FIX vs the earlier version: the "repeated N times" note is attached
// to the OLD message that was actually repeating, emitted as its OWN log
// line the moment a DIFFERENT message shows up — never stapled onto the
// new/unrelated message's text. State is also keyed by level, so an info
// line can never inherit a warn line's repeat count or vice versa.
// ─────────────────────────────────────────────
const LEVELS = ['critical', 'error', 'warn', 'info', 'debug'];
const raw = {};
LEVELS.forEach(l => { raw[l] = logger[l].bind(logger); });

let last = null; // { level, signature, args } of the most recent call, any level
let repeatCount = 0;
let flushTimer = null;

function signatureOf(args) {
  try {
    return args.map(a => (a instanceof Error ? (a.stack || a.message) : String(a))).join('\u0000');
  } catch (e) {
    return JSON.stringify(args);
  }
}

function flushPending() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (repeatCount > 0 && last) {
    const [firstMsg, ...rest] = last.args;
    raw[last.level](`${firstMsg}  [previous line repeated ${repeatCount} more time(s)]`, ...rest);
  }
  repeatCount = 0;
}

LEVELS.forEach(level => {
  logger[level] = (...args) => {
    const signature = signatureOf(args);

    if (last && last.level === level && last.signature === signature) {
      repeatCount++;
      // Safety net: if the repeats just stop forever (no distinct message
      // ever follows), don't lose the count silently — flush it after a
      // few seconds of no new activity for this key.
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(flushPending, 5000);
      return logger;
    }

    // Different content (or different level) — close out whatever was
    // repeating before, using ITS OWN text, then log this new line as-is.
    flushPending();
    last = { level, signature, args };
    return raw[level](...args);
  };
});

process.on('exit', flushPending);

module.exports = { logger };