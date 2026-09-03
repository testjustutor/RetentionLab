/**
 * controllers/auditController.js
 * Audit reporting logic.
 */
const TranscriptModel = require('../../models/transcripts/transcriptModel');
const AuditReportModel = require('../../models/audit/AuditReportModel');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { logger } = require('../../utils/logger');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

// ─── Log file helpers ─────────────────────────────────────────────────────
const logsDir = path.join(__dirname, '../../logs');

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
  const files = fs.readdirSync(logsDir || path.join(__dirname, '../../logs'))
    .filter(name => name.endsWith('.log') && name !== 'python_engine.log');
  const today = new Date().toISOString().slice(0, 10);
  const todayCombined = `combined-${today}.log`;
  const combinedAvailable = files.includes(todayCombined);
  const selectedFiles = combinedAvailable ? [todayCombined] : files.filter(name => !name.startsWith('combined-'));
  const entries = [];
  const uniqueIds = new Set();
  for (const file of selectedFiles) {
    const raw = fs.readFileSync(path.join(logsDir, file), 'utf8');
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
  async getSessionByMeetingId(meetingId) {
    try {
      return await TranscriptModel.getSessionByMeetingId(meetingId);
    } catch (e) {
      throw e;
    }
  },

  async list(req) {
    try {
      const rows = await TranscriptModel.getAuditRows();
      return ok({ rows }, 'Audit data fetched');
    } catch (e) {
      return err(e.message, 500);
    }
  },

  async processAudit(req, res) {
    try {
      const { meetingId } = req.params;
      const session = await TranscriptModel.getSessionByMeetingId(meetingId);
      if (!session || !session.audio_file_name) {
        return res.status(404).json({ status: 'error', message: 'Recording not found for this meeting.' });
      }
      const videoFileName = path.basename(session.audio_file_name);
      const bridgePath = path.join(__dirname, '../../audit_bridge.py');
      logger.info(`[Engine] Initiating full audit for Meeting: ${meetingId}`);
      const meetingArg = meetingId || '';
      exec(`python3 "${bridgePath}" "${videoFileName}" ${meetingArg}`, async (error, stdout, stderr) => {
        if (error) {
          logger.error(`[Engine] Execution Error: ${stderr}`);
          return res.status(500).json({ status: 'error', message: 'AI Engine failed to process recording.' });
        }
        const output = stdout.trim();
        if (output.startsWith('SUCCESS')) {
          const [_, transcriptPath, auditPath] = output.split('|');
          const reportRaw = fs.readFileSync(auditPath, 'utf8');
          const reportData = JSON.parse(reportRaw);
          return res.json({
            status: 'success',
            data: {
              meetingId,
              oqi: reportData.oqi,
              performance: reportData.results,
              files: { transcript: path.basename(transcriptPath), report: path.basename(auditPath) },
              processedAt: new Date().toISOString()
            }
          });
        } else {
          logger.error(`[Engine] Logic Error: ${output}`);
          return res.status(500).json({ status: 'error', message: output });
        }
      });
    } catch (err) {
      logger.error(`[Controller:Audit] Internal Error: ${err.message}`);
      res.status(500).json({ status: 'error', message: err.message });
    }
  },

  async getReport(req, res) {
    try {
      const { meetingId } = req.params;
      const reportPath = path.join(__dirname, '../../storage/audits', `TRANS_${meetingId}.json`);
      if (!fs.existsSync(reportPath)) {
        return res.status(404).json({ status: 'error', message: 'Audit report not found.' });
      }
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      res.json({ status: 'success', data: report });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  },

  async getDbResults(req, res) {
    try {
      const { meetingId } = req.params;
      const results = await AuditReportModel.getAuditResultsByMeeting(meetingId);
      if (results.length === 0) {
        return res.status(404).json({ success: false, error: 'No audit results found for this meeting.', statusCode: 404 });
      }
      const grouped = {};
      for (const row of results) {
        if (!grouped[row.category_name]) {
          grouped[row.category_name] = { category_name: row.category_name, category_weight: row.category_weight, oqi_score: row.oqi_score, evidence_quote: row.evidence_quote, indicators: [] };
        }
        grouped[row.category_name].indicators.push({ indicator_name: row.indicator_name, indicator_type: row.indicator_type, indicator_value: row.indicator_value, ai_score: row.ai_score, ai_max_score: row.ai_max_score });
      }
      res.json({
        success: true,
        meeting_id: meetingId,
        oqi_score: results[0]?.oqi_score || 0,
        evidence_quote: results[0]?.evidence_quote || '',
        categories: Object.values(grouped),
        total_indicators: results.length
      });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message, statusCode: 500 });
    }
  },

  async getLogs(req, res) {
    try {
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
      res.json({ logs: filteredLogs, total: logs.length });
    } catch (err) {
      logger.error('Controller(audit): Error fetching audit logs:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  }
};

module.exports = controller;