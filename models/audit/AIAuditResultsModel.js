/**
 * root/models/AIAuditResultsModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class AIAuditResultsModel {
  static upsert(result) {
    return new Promise((resolve, reject) => {
      // ai_audit_results now stores status_code (1=Met, 2=Not Met, 3=N/A)
      // instead of ai_score/ai_max_score — derive a status code from the
      // caller's status_code when present, else from ai_score for back-compat.
      let statusCode = result.status_code;
      if (statusCode === undefined || statusCode === null) {
        const score = Number(result.ai_score);
        statusCode = Number.isFinite(score) ? (score >= 1 ? 1 : 2) : 3;
      }
      const sql = `INSERT INTO ai_audit_results
        (meeting_id, session_id, category_id, indicator_id, status_code, is_gate,
         ai_evidence, reason, scored_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
         status_code=VALUES(status_code), is_gate=VALUES(is_gate),
         ai_evidence=VALUES(ai_evidence), reason=VALUES(reason),
         scored_at=CURRENT_TIMESTAMP`;
      const params = [
        result.meeting_id, result.session_id, result.category_id, result.indicator_id,
        statusCode, result.is_gate || 0,
        result.ai_evidence || result.evidence_quote || null, result.reason || null
      ];
      db.run(sql, params, function (err) {
        if (err) {
          logger.error('[AIAuditResultsModel] upsert error', err);
          return reject(err);
        }
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  static getByMeeting(meetingId) {
    return new Promise((resolve, reject) => db.all('SELECT * FROM ai_audit_results WHERE meeting_id = ? ORDER BY scored_at DESC', [meetingId], (err, rows) => err ? reject(err) : resolve(rows || [])));
  }
}

module.exports = AIAuditResultsModel;
