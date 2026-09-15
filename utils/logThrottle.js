/**
 * utils/logThrottle.js
 *
 * Reusable log-THROTTLING helper built on top of the existing Winston
 * logger (utils/logger.js) — no new logging library, no change to log
 * levels or transports. It solves exactly one problem: a piece of code
 * that runs frequently (a poller, a scheduler tick, a hot endpoint) and
 * logs the same *kind* of line every time, flooding the log file even
 * though nothing new is actually happening.
 *
 * IMPORTANT: this throttles LOG OUTPUT only. It never touches business
 * logic, timers, or how often the surrounding code actually runs — the
 * caller's real work (DB queries, token checks, etc.) executes exactly as
 * often as it always did; only the corresponding logger.info/warn/etc.
 * call is skipped when it would be a duplicate within the throttle window.
 *
 * USAGE
 *   const { logThrottled } = require('./logThrottle'); // adjust relative path
 *   logThrottled('info', 'calendar-users:fetched-integrations', `Model(CalendarUsersModel): Fetched ${rows.length} calendar integrations`);
 *
 * - level:   one of this app's winston levels ('critical' | 'error' |
 *            'warn' | 'info' | 'debug') — the SAME level the original
 *            logger.<level>(...) call used. Nothing about level/format
 *            changes; this is a thin pre-check in front of that same call.
 * - key:     a STABLE identifier for "this kind of log line", chosen by
 *            the caller. Do NOT bake dynamic values (counts, ids, emails)
 *            into the key — put those in `message` instead. Two calls with
 *            the same key inside the same throttle window collapse into
 *            one log line (the first one); a different key is tracked
 *            completely independently.
 * - message: the exact message string to log (unchanged from the original
 *            call) — this is what actually gets written when the call is
 *            not throttled.
 * - ...args: forwarded as-is to logger[level](message, ...args), same as
 *            calling the logger directly (e.g. an Error object as a 2nd
 *            arg) — supports the existing call style used elsewhere in
 *            this codebase.
 *
 * BEHAVIOR
 *   - The first call for a given key always logs immediately.
 *   - Any further call for that same key within `windowMs` (default 60s)
 *     is suppressed — the underlying condition may still be true, it's
 *     just not re-logged every single tick.
 *   - Once `windowMs` has elapsed since the last time that key actually
 *     logged, the next call logs again (and restarts the window) — so if
 *     the condition is still occurring, it reappears in the log exactly
 *     once per window, never silently disappears forever.
 *
 * MEMORY SAFETY (long-running process)
 *   Only ONE map entry per distinct `key` is ever stored (not per call),
 *   so as long as callers use stable keys (as intended) this map stays as
 *   small as the number of distinct throttled log sites in the codebase —
 *   a handful, for the life of the process. As a defensive backstop against
 *   a future caller accidentally passing a high-cardinality key (e.g. one
 *   that embeds a user id), stale entries are pruned automatically on a
 *   cheap, amortized schedule (every PRUNE_EVERY_N_CALLS calls, entries
 *   untouched for longer than MAX_ENTRY_AGE_MS are dropped) — no extra
 *   timers are created, so this can't itself keep the process alive.
 */
const { logger } = require('./logger');

const DEFAULT_WINDOW_MS = 60 * 1000; // "at most once every 60 seconds"

// Backstop only — see MEMORY SAFETY above. Comfortably larger than any
// sane windowMs so it never interferes with normal throttling.
const MAX_ENTRY_AGE_MS = 30 * 60 * 1000; // 30 minutes
const PRUNE_EVERY_N_CALLS = 200;

// key -> timestamp (ms) this key last actually WROTE a log line.
const lastLoggedAt = new Map();

let callsSinceLastPrune = 0;

function pruneStaleEntries() {
  const now = Date.now();
  for (const [key, ts] of lastLoggedAt) {
    if (now - ts > MAX_ENTRY_AGE_MS) lastLoggedAt.delete(key);
  }
}

/**
 * Core implementation shared by logThrottled/logThrottledWithWindow.
 * Returns true if it actually logged, false if suppressed as a duplicate.
 */
function throttledLog(level, key, windowMs, message, args) {
  if (typeof logger[level] !== 'function') {
    // Defensive: an unknown level should never silently swallow a log -
    // fall back to info rather than throw, and say why.
    logger.warn(`logThrottle: unknown log level "${level}" for key "${key}" - falling back to info`);
    level = 'info';
  }

  const now = Date.now();
  const last = lastLoggedAt.get(key);

  callsSinceLastPrune++;
  if (callsSinceLastPrune >= PRUNE_EVERY_N_CALLS) {
    callsSinceLastPrune = 0;
    pruneStaleEntries();
  }

  if (last !== undefined && now - last < windowMs) {
    return false; // duplicate within the throttle window - suppressed
  }

  lastLoggedAt.set(key, now);
  logger[level](message, ...args);
  return true;
}

/**
 * Log at most once every 60 seconds (default) for a given key.
 * logThrottled(level, key, message, ...args)
 */
function logThrottled(level, key, message, ...args) {
  return throttledLog(level, key, DEFAULT_WINDOW_MS, message, args);
}

/**
 * Same as logThrottled but with an explicit window instead of the 60s
 * default - for the rare case a call site needs a different cadence.
 * logThrottledWithWindow(level, key, windowMs, message, ...args)
 */
function logThrottledWithWindow(level, key, windowMs, message, ...args) {
  return throttledLog(level, key, windowMs, message, args);
}

/**
 * Test/ops helper: clears all throttle state (e.g. between unit tests).
 * Never called from production code paths.
 */
function _resetLogThrottleState() {
  lastLoggedAt.clear();
  callsSinceLastPrune = 0;
}

module.exports = {
  logThrottled,
  logThrottledWithWindow,
  _resetLogThrottleState,
};
