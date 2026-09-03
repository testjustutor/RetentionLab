/**
 * root/models/SessionSnapshotModel.js
 *
 * Single-row-per-session snapshot card (session_snapshot table).
 * This is the high-level summary for the metadata endpoint.
 * overall_score_pct is looked up from session_rubric_summary if available,
 * but can also be stored directly here for convenience.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class SessionSnapshotModel {
  static upsert(data) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_snapshot 
        (session_id, student_grade, curriculum, location, subject, topics_covered,
         session_objective_status, overall_score_pct, overall_rating, student_engagement,
         learning_impact, parent_shareability, executive_summary,
         created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
        ON DUPLICATE KEY UPDATE 
        student_grade=VALUES(student_grade), 
        curriculum=VALUES(curriculum), 
        location=VALUES(location), 
        subject=VALUES(subject), 
        topics_covered=VALUES(topics_covered), 
        session_objective_status=VALUES(session_objective_status), 
        overall_score_pct=VALUES(overall_score_pct), 
        overall_rating=VALUES(overall_rating), 
        student_engagement=VALUES(student_engagement), 
        learning_impact=VALUES(learning_impact), 
        parent_shareability=VALUES(parent_shareability), 
        executive_summary=VALUES(executive_summary), 
        updated_at=CURRENT_TIMESTAMP`;
      
      const params = [
        data.session_id,
        data.student_grade || '',
        data.curriculum || '',
        data.location || '',
        data.subject || '',
        JSON.stringify(data.topics_covered || []),
        data.session_objective_status || '',
        data.overall_score_pct || null,
        data.overall_rating || '',
        data.student_engagement || '',
        data.learning_impact || '',
        data.parent_shareability || '',
        data.executive_summary || ''
      ];
      
      db.run(sql, params, function(err) {
        if (err) { 
          logger.error('[SessionSnapshotModel] upsert error', err); 
          return reject(err); 
        }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  static findBySessionId(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM session_snapshot WHERE session_id = ? LIMIT 1`;
      
      db.get(sql, [sessionId], (err, row) => {
        if (err) { 
          logger.error('[SessionSnapshotModel] findBySessionId error', err); 
          return reject(err); 
        }
        if (row) {
          try {
            row.topics_covered = typeof row.topics_covered === 'string' 
              ? JSON.parse(row.topics_covered) : row.topics_covered;
          } catch (e) {
            logger.warn('[SessionSnapshotModel] JSON parse warning', e);
          }
        }
        resolve(row || null);
      });
    });
  }

  /**
   * Get snapshot by meeting_id via join to meeting_sessions
   */
  static findByMeetingId(meetingId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT ss.* FROM session_snapshot ss
                   JOIN meeting_sessions ms ON ss.session_id = ms.id
                   WHERE ms.meeting_id = ? LIMIT 1`;
      
      db.get(sql, [meetingId], (err, row) => {
        if (err) { 
          logger.error('[SessionSnapshotModel] findByMeetingId error', err); 
          return reject(err); 
        }
        if (row) {
          try {
            row.topics_covered = typeof row.topics_covered === 'string' 
              ? JSON.parse(row.topics_covered) : row.topics_covered;
          } catch (e) {
            logger.warn('[SessionSnapshotModel] JSON parse warning', e);
          }
        }
        resolve(row || null);
      });
    });
  }

  static deleteBySession(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM session_snapshot WHERE session_id = ?`;
      
      db.run(sql, [sessionId], function(err) {
        if (err) { 
          logger.error('[SessionSnapshotModel] deleteBySession error', err); 
          return reject(err); 
        }
        resolve({ changes: this.changes });
      });
    });
  }
}

module.exports = SessionSnapshotModel;