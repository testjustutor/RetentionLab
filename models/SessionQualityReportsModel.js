/**
 * root/models/SessionQualityReportsModel.js
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class SessionQualityReportsModel {
  static upsert(report) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_quality_reports (meeting_id, overall_score, max_possible_score, percentage_score, overall_rating, student_engagement, learning_impact, parent_shareability, confidence_level, confidence_reason, executive_summary, generated_by, generated_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(meeting_id) DO UPDATE SET overall_score=excluded.overall_score, max_possible_score=excluded.max_possible_score, percentage_score=excluded.percentage_score, overall_rating=excluded.overall_rating, student_engagement=excluded.student_engagement, learning_impact=excluded.learning_impact, parent_shareability=excluded.parent_shareability, confidence_level=excluded.confidence_level, confidence_reason=excluded.confidence_reason, executive_summary=excluded.executive_summary, generated_by=excluded.generated_by, updated_at=CURRENT_TIMESTAMP`;
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
