/**
 * utils/dateFormat.js
 *
 * Shared helper for writing JS Date values into MySQL DATETIME columns
 * that sit alongside CURRENT_TIMESTAMP-generated columns (created_at,
 * updated_at, etc).
 *
 * WHY THIS EXISTS:
 * `Date.prototype.toISOString()` always renders in UTC. MySQL's
 * `CURRENT_TIMESTAMP` is evaluated by the DB SERVER using its own local
 * system timezone (IST / UTC+5:30 on this deployment). Binding a
 * `.toISOString()` string (e.g. "2026-09-12T14:11:31.000Z") into a
 * DATETIME column stores the literal UTC wall-clock digits with no
 * timezone conversion - MySQL has no way to know those digits were UTC,
 * so it stores them as if they were already local time. The column then
 * reads back ~5.5 hours (the IST offset) earlier than a sibling
 * CURRENT_TIMESTAMP column on the very same row/request.
 *
 * That mismatch is not just cosmetic: any code that later re-parses the
 * stored string as an absolute instant (e.g. an expiry check like
 * `new Date(row.expires_at).getTime() < Date.now()`) reconstructs a
 * DIFFERENT instant than was originally intended, because the read-back
 * assumes local time for digits that were actually UTC.
 *
 * FIX: build the DATETIME string from the LOCAL getters
 * (getFullYear/getMonth/getDate/getHours/getMinutes/getSeconds) instead
 * of `.toISOString()`, so the value matches what CURRENT_TIMESTAMP would
 * have produced for the same instant.
 *
 * Use this for any value that is bound as a SQL parameter into a
 * DATETIME/TIMESTAMP column. Do NOT use it for values that leave the
 * app as JSON/API payloads (those should stay proper UTC ISO8601), and
 * do NOT use it for outbound calls to external APIs that require ISO8601
 * (e.g. Google Calendar) - those must keep `.toISOString()`.
 */
function toMySQLLocalDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

module.exports = { toMySQLLocalDateTime };
