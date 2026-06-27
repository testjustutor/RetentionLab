/**
 * root/models/AIAuditResultsModel.js
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class AIAuditResultsModel {
  static upsert(result) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO ai_audit_results (meeting_id, session_id, category_id, indicator_id, ai_score, ai_max_score, ai_raw_response, oqi_score, evidence_quote, talk_ratio, scored_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE ai_score=VALUES(ai_score), ai_max_score=VALUES(ai_max_score), ai_raw_response=VALUES(ai_raw_response), oqi_score=VALUES(oqi_score), evidence_quote=VALUES(evidence_quote), talk_ratio=VALUES(talk_ratio), scored_at=CURRENT_TIMESTAMP`;
      const params = [result.meeting_id, result.session_id, result.category_id, result.indicator_id, result.ai_score || 0, result.ai_max_score || 0, result.ai_raw_response || null, result.oqi_score || 0, result.evidence_quote || null, result.talk_ratio || null];
      db.run(sql, params, function(err) {
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
