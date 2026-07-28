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
          aar.ai_score, 
          aar.ai_max_score, 
          aar.ai_raw_response, 
          aar.oqi_score, 
          aar.evidence_quote, 
          aar.talk_ratio,
          rc.category_name, 
          rc.category_weight,
          ri.indicator_name, 
          ri.indicator_type, 
          ri.indicator_value
        FROM ai_audit_results aar
        JOIN rubric_categories rc ON aar.category_id = rc.id
        JOIN rubric_indicators ri ON aar.indicator_id = ri.id
        WHERE aar.meeting_id = ?
        ORDER BY rc.category_name, ri.indicator_name
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