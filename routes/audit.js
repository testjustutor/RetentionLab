/**
 * root/routes/audit.js
 */
const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { logger } = require('../utils/logger');
const TranscriptModel = require('../models/transcriptModel');

/**
 * @route   POST /api/audit/process/:meetingId
 * @desc    Triggers the Python Engine (Media -> AI -> Rubric)
 * @access  Protected
 */
router.post('/process/:meetingId', async (req, res) => {
    try {
        const { meetingId } = req.params;

        // 1. Fetch meeting metadata
        const session = await TranscriptModel.getSessionByMeetingId(meetingId);
        if (!session || !session.audio_file_name) {
            return res.status(404).json({ 
                status: 'error', 
                message: 'Recording not found for this meeting.' 
            });
        }

        // We pass only the filename; the Python Engine handles the root pathing
        const videoFileName = path.basename(session.audio_file_name);
        const bridgePath = path.join(__dirname, '../audit_bridge.py');

        logger.info(`[Engine] Initiating full audit for Meeting: ${meetingId}`);

        // 2. Execute Python Bridge
        // Command: python3 audit_bridge.py "filename.mp4" [meeting_id]
        const meetingArg = meetingId || '';
        exec(`python3 "${bridgePath}" "${videoFileName}" ${meetingArg}`, async (error, stdout, stderr) => {
            if (error) {
                logger.error(`[Engine] Execution Error: ${stderr}`);
                return res.status(500).json({ 
                    status: 'error', 
                    message: 'AI Engine failed to process recording.' 
                });
            }

            const output = stdout.trim();
            
            // Check if Python returned the SUCCESS signal
            if (output.startsWith('SUCCESS')) {
                const [_, transcriptPath, auditPath] = output.split('|');

                // 3. Read the generated JSON Audit Report
                const reportRaw = fs.readFileSync(auditPath, 'utf8');
                const reportData = JSON.parse(reportRaw);

                // 4. Return the OQI and the Audit findings
                return res.json({
                    status: 'success',
                    data: {
                        meetingId,
                        oqi: reportData.oqi,
                        performance: reportData.results,
                        files: {
                            transcript: path.basename(transcriptPath),
                            report: path.basename(auditPath)
                        },
                        processedAt: new Date().toISOString()
                    }
                });
            } else {
                logger.error(`[Engine] Logic Error: ${output}`);
                return res.status(500).json({ status: 'error', message: output });
            }
        });

    } catch (err) {
        logger.error(`[Route:Audit] Internal Error: ${err.message}`);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * @route   GET /api/audit/db-results/:meetingId
 * @desc    Retrieves per-indicator AI audit results from the database
 */
router.get('/db-results/:meetingId', async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { db } = require('../database/db');

        let sql = 'SELECT aar.id, aar.meeting_id, aar.session_id, aar.category_id, aar.indicator_id, aar.ai_score, aar.ai_max_score, aar.ai_raw_response, aar.oqi_score, aar.evidence_quote, aar.talk_ratio, rc.category_name, rc.category_weight, ri.indicator_name, ri.indicator_type, ri.indicator_value FROM ai_audit_results aar JOIN rubric_categories rc ON aar.category_id = rc.id JOIN rubric_indicators ri  ON aar.indicator_id = ri.id WHERE aar.meeting_id = ? ORDER BY rc.category_name, ri.indicator_name';

        const params = [meetingId];

        const results = await new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });

        if (results.length === 0) {
            return res.status(404).json({ 
                status: 'error', 
                message: 'No audit results found for this meeting.' 
            });
        }

        // Group by category for cleaner response
        const grouped = {};
        for (const row of results) {
            if (!grouped[row.category_name]) {
                grouped[row.category_name] = {
                    category_name: row.category_name,
                    category_weight: row.category_weight,
                    oqi_score: row.oqi_score,
                    evidence_quote: row.evidence_quote,
                    indicators: []
                };
            }
            grouped[row.category_name].indicators.push({
                indicator_name: row.indicator_name,
                indicator_type: row.indicator_type,
                indicator_value: row.indicator_value,
                ai_score: row.ai_score,
                ai_max_score: row.ai_max_score
            });
        }

        res.json({
            status: 'success',
            data: {
                meeting_id: meetingId,
                oqi_score: results[0]?.oqi_score || 0,
                evidence_quote: results[0]?.evidence_quote || '',
                categories: Object.values(grouped),
                total_indicators: results.length
            }
        });
    } catch (err) {
        logger.error('Route(audit): Error fetching DB audit results:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * @route   GET /api/audit/report/:meetingId
 * @desc    Retrieves an existing audit report from storage
 */
router.get('/report/:meetingId', async (req, res) => {
    try {
        const { meetingId } = req.params;
        const reportPath = path.join(__dirname, '../storage/audits', `TRANS_${meetingId}.json`);

        if (!fs.existsSync(reportPath)) {
            return res.status(404).json({ status: 'error', message: 'Audit report not found.' });
        }

        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        res.json({ status: 'success', data: report });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});


const logsDir = path.join(__dirname, '../logs');

function parseJsonLogLines(content) {
  return content
    .split(/\r?\n/)
    .filter(line => line.trim())
    .map(line => {
      try {
        return JSON.parse(line);
      } catch (err) {
        return null;
      }
    })
    .filter(Boolean);
}

function extractModule(message, service) {
  if (service) return service;
  if (!message) return 'SYSTEM';

  const moduleMatch = message.match(/^\s*\(?([^\)]+)\)?\s*[:\-]/);
  if (moduleMatch) return moduleMatch[1];

  return 'SYSTEM';
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

  return {
    timestamp,
    level,
    module,
    description,
    user
  };
}

function parseLogTimestamp(timestamp) {
  if (!timestamp) return null;
  const normalized = timestamp.toString().trim().replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function loadLogFiles() {
  const files = fs.readdirSync(logsDir || path.join(__dirname, '../logs'))
    .filter(name => name.endsWith('.log') && name !== 'python_engine.log');

  const today = new Date().toISOString().slice(0, 10);
  const todayCombined = `combined-${today}.log`;
  const combinedAvailable = files.includes(todayCombined);

  const selectedFiles = combinedAvailable
    ? [todayCombined]
    : files.filter(name => !name.startsWith('combined-'));

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

// GET /api/audit
router.get('/', async (req, res) => {
  try {
    const levelFilter = (req.query.level || 'ALL').toUpperCase();
    const searchTerm = (req.query.search || '').trim().toLowerCase();
    const fromDate = parseDateFilter(req.query.from);
    let toDate = parseDateFilter(req.query.to);
    if (toDate) {
      toDate = new Date(toDate.setHours(23, 59, 59, 999));
    }

    const logs = loadLogFiles();

    const filteredLogs = logs.filter(log => {
      if (levelFilter !== 'ALL' && log.level !== levelFilter) {
        return false;
      }

      const timestamp = parseLogTimestamp(log.timestamp);
      if (fromDate && timestamp && timestamp < fromDate) {
        return false;
      }
      if (toDate && timestamp && timestamp > toDate) {
        return false;
      }

      if (!searchTerm) return true;

      return [log.timestamp, log.level, log.module, log.description, log.user]
        .some(value => value && value.toString().toLowerCase().includes(searchTerm));
    });

    res.json({ logs: filteredLogs, total: logs.length });
  } catch (err) {
    logger.error('Route(audit): Error fetching audit logs:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;