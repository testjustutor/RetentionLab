/**
 * controllers/super_admin/monitoring/auditController.js
 * Audit log access for the Super Admin monitoring page.
 * Reads log files / returns recent audit entries — no SQL in controller.
 *
 * FIX: this controller used to do its own minimal log read (no level/date/
 * search filters, no user attribution, no dedup, included the noisy
 * python_engine.log, and returned only { logs } with no total count) while
 * controllers/audit/auditController.js's getLogs — serving the equivalent
 * top-level /api/audit/ page — already had all of that. Per user decision,
 * ported the full filtering/attribution/dedup logic from that top-level
 * getLogs() so the super_admin monitoring page gets the same level/from/to/
 * search query params, a `user` column extracted from each log line, same-day
 * dedup by (timestamp|level|module|description), python_engine.log excluded,
 * and a { logs, total } response shape. Route (GET /api/super_admin/monitoring/audit)
 * and its `limit` query param are unchanged; `limit` now caps the filtered
 * result set (previously capped the unfiltered one) which matches how a
 * "recent N entries" limit is expected to behave once filters exist.
 */
const fs = require('fs');
const path = require('path');

// ─── Log file helpers (ported from controllers/audit/auditController.js) ──
const logsDir = path.join(__dirname, '..', '..', '..', 'logs');

function parseJsonLogLines(content) {
  return content.split(/\r?\n/).filter(line => line.trim()).map(line => { try { return JSON.parse(line); } catch (err) { return null; } }).filter(Boolean);
}

function extractModule(message, service) {
  if (service) return service;
  if (!message) return 'SYSTEM';
  const moduleMatch = message.match(/^\s*\(?([^\)]+)\)?\s*[:\-]/);
  return moduleMatch ? moduleMatch[1] : 'SYSTEM';
}

function extractUser(message, entry) {
  if (entry.user) return entry.user;
  if (!message) return '';
  const emailMatch = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (emailMatch) return emailMatch[0];
  if (message.toLowerCase().includes('system')) return 'system';
  return '';
}

function normalizeLogEntry(entry) {
  const timestamp = entry.timestamp || entry.time || new Date().toISOString();
  const level = entry.level ? entry.level.toString().toUpperCase() : 'INFO';
  const description = entry.message || '';
  const module = extractModule(description, entry.service);
  const user = extractUser(description, entry);
  return { timestamp, level, module, description, user };
}

function parseLogTimestamp(timestamp) {
  if (!timestamp) return null;
  const normalized = timestamp.toString().trim().replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function loadLogFiles() {
  if (!fs.existsSync(logsDir)) return [];
  const files = fs.readdirSync(logsDir)
    .filter(name => name.endsWith('.log') && name !== 'python_engine.log');
  const today = new Date().toISOString().slice(0, 10);
  const todayCombined = `combined-${today}.log`;
  const combinedAvailable = files.includes(todayCombined);
  const selectedFiles = combinedAvailable ? [todayCombined] : files.filter(name => !name.startsWith('combined-'));
  const entries = [];
  const uniqueIds = new Set();
  for (const file of selectedFiles) {
    let raw;
    try { raw = fs.readFileSync(path.join(logsDir, file), 'utf8'); } catch (e) { continue; }
    const parsedLines = parseJsonLogLines(raw);
    for (const line of parsedLines) {
      const normalized = normalizeLogEntry(line);
      const uniqueKey = `${normalized.timestamp}|${normalized.level}|${normalized.module}|${normalized.description}`;
      if (uniqueIds.has(uniqueKey)) continue;
      uniqueIds.add(uniqueKey);
      entries.push(normalized);
    }
  }
  entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return entries;
}

function parseDateFilter(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const controller = {
  /**
   * GET /api/super_admin/monitoring/audit
   * Return the most recent audit log entries (from the app's log directory),
   * with the same level/date/search filtering and user attribution as
   * GET /api/audit/ (controllers/audit/auditController.js's getLogs).
   */
  async list(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const levelFilter = (req.query.level || 'ALL').toUpperCase();
      const searchTerm = (req.query.search || '').trim().toLowerCase();
      const fromDate = parseDateFilter(req.query.from);
      let toDate = parseDateFilter(req.query.to);
      if (toDate) toDate = new Date(toDate.setHours(23, 59, 59, 999));

      const logs = loadLogFiles();
      const filteredLogs = logs.filter(log => {
        if (levelFilter !== 'ALL' && log.level !== levelFilter) return false;
        const timestamp = parseLogTimestamp(log.timestamp);
        if (fromDate && timestamp && timestamp < fromDate) return false;
        if (toDate && timestamp && timestamp > toDate) return false;
        if (!searchTerm) return true;
        return [log.timestamp, log.level, log.module, log.description, log.user].some(value => value && value.toString().toLowerCase().includes(searchTerm));
      });

      res.json({ logs: filteredLogs.slice(0, limit), total: filteredLogs.length });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
};

module.exports = controller;
