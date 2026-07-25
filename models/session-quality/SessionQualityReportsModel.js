/**
 * root/models/SessionQualityReportsModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class SessionQualityReportsModel {
  static upsert(report) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_quality_reports (meeting_id, overall_score, max_possible_score, percentage_score, overall_rating, student_engagement, learning_impact, parent_shareability, confidence_level, confidence_reason, executive_summary, generated_by, generated_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE overall_score=VALUES(overall_score), max_possible_score=VALUES(max_possible_score), percentage_score=VALUES(percentage_score), overall_rating=VALUES(overall_rating), student_engagement=VALUES(student_engagement), learning_impact=VALUES(learning_impact), parent_shareability=VALUES(parent_shareability), confidence_level=VALUES(confidence_level), confidence_reason=VALUES(confidence_reason), executive_summary=VALUES(executive_summary), generated_by=VALUES(generated_by), updated_at=CURRENT_TIMESTAMP`;
      const params = [report.meeting_id, report.overall_score || 0, report.max_possible_score || 0, report.percentage_score || 0, report.overall_rating || null, report.student_engagement || null, report.learning_impact || null, report.parent_shareability || null, report.confidence_level || null, report.confidence_reason || null, report.executive_summary || null, report.generated_by || 'AI'];
      db.run(sql, params, function(err) {
        if (err) { logger.error('[SessionQualityReportsModel] upsert error', err); return reject(err); }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  static getByMeeting(meetingId) {
    return new Promise((resolve, reject) => db.get('SELECT * FROM session_quality_reports WHERE meeting_id = ? LIMIT 1', [meetingId], (err, row) => err ? reject(err) : resolve(row || null)));
  }
}

module.exports = SessionQualityReportsModel;
