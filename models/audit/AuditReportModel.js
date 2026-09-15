/**
 * models/audit/AuditReportModel.js
 * Model for AI audit results and reporting
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class AuditReportModel {
  /**
   * Get audit results for a specific meeting with rubric details
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<Array>} Array of audit results with category and indicator details
   *
   * NOTE: ai_audit_results now only stores status_code (1=Met, 2=Not Met,
   * 3=N/A) + is_gate + ai_evidence + reason. Category/indicator display
   * names/weights resolve via the canonical rubric_categories /
   * rubric_indicators tables.
   */
  static async getAuditResultsByMeeting(meetingId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT
          aar.id,
          aar.meeting_id,
          aar.session_id,
          aar.category_id,
          aar.indicator_id,
          aar.status_code,
          aar.is_gate,
          aar.ai_evidence,
          aar.reason,
          aar.scored_at,
          rc.name AS category_name,
          rc.weight AS category_weight,
          ri.name AS indicator_name,
          ri.type AS indicator_type,
          ri.value AS indicator_value
        FROM ai_audit_results aar
        JOIN rubric_categories rc ON aar.category_id = rc.id
        JOIN rubric_indicators ri ON aar.indicator_id = ri.id
        WHERE aar.meeting_id = ?
        ORDER BY rc.name, ri.name
      `;

      db.all(sql, [meetingId], (err, rows) => {
        if (err) {
          logger.error('Model(AuditReportModel): Error fetching audit results:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }
}

module.exports = AuditReportModel;