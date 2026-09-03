/**
 * models/session-quality/SessionQualityReportModel.js
 * Data access for the session quality dashboard/report endpoints.
 * All SQL lives here; controllers only call these methods.
 */
const { db } = require('../../database/db');

class SessionQualityReportModel {
  /**
   * Get dashboard sessions with filters. Only shows data for instructors
   * created by the logged-in admin user.
   * @param {number} adminUserId
   * @param {object} filters { instructorId, meetingId, fromDate, toDate, subject, studentGrade, curriculum, location }
   * @returns {Promise<Array>} session snapshot rows
   */
  static getDashboardSessions(adminUserId, filters) {
    let query = `
      SELECT
        s.id,
        s.session_id,
        s.student_grade,
        s.curriculum,
        s.location,
        s.subject,
        s.topics_covered,
        s.session_objective_status,
        s.overall_score_pct,
        s.overall_rating,
        s.student_engagement,
        s.learning_impact,
        s.parent_shareability,
        s.executive_summary,
        s.created_at,
        s.updated_at,
        m.external_meeting_id,
        m.title,
        m.scheduled_start_time,
        m.scheduled_end_time,
        m.platform,
        CONCAT('SES-', LPAD(s.session_id, 6, '0')) as session_ref,
        CONCAT(teacher.first_name, ' ', teacher.last_name) as instructor_name,
        sm.student_name as student_name
      FROM session_snapshot s
      LEFT JOIN meeting_sessions ms ON s.session_id = ms.id
      LEFT JOIN meetings m ON ms.meeting_id = m.external_meeting_id
      LEFT JOIN session_metadata sm ON m.external_meeting_id = sm.meeting_id
      LEFT JOIN users teacher ON sm.teacher_user_id = teacher.id
      WHERE teacher.created_by = ?
    `;
    const params = [adminUserId];

    if (filters.instructorId) {
      query += ' AND sm.teacher_user_id = ?';
      params.push(filters.instructorId);
    }
    if (filters.meetingId) {
      query += ' AND m.external_meeting_id = ?';
      params.push(filters.meetingId);
    }
    if (filters.fromDate) {
      query += ' AND m.scheduled_start_time >= ?';
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      query += ' AND m.scheduled_start_time <= ?';
      params.push(filters.toDate + ' 23:59:59');
    }
    if (filters.subject) {
      query += ' AND sm.subject = ?';
      params.push(filters.subject);
    }
    if (filters.studentGrade) {
      query += ' AND sm.student_grade = ?';
      params.push(filters.studentGrade);
    }
    if (filters.curriculum) {
      query += ' AND sm.curriculum = ?';
      params.push(filters.curriculum);
    }
    if (filters.location) {
      query += ' AND sm.location = ?';
      params.push(filters.location);
    }
    query += ' ORDER BY m.scheduled_start_time DESC';

    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
    });
  }

  /**
   * Get distinct filter option values for a given field.
   * @param {string} field - one of subject, student_grade, curriculum, location
   * @returns {Promise<Array>} [{ value, label }]
   */
  static getFilterOptions(field) {
    const query = `
      SELECT DISTINCT ${field} as value, ${field} as label
      FROM session_snapshot
      WHERE ${field} IS NOT NULL AND ${field} != ''
      ORDER BY ${field}
    `;
    return new Promise((resolve, reject) => {
      db.all(query, [], (err, rows) => (err ? reject(err) : resolve(rows || [])));
    });
  }

  /**
   * Find a meeting session by its internal id.
   * @param {number} internalSessionId
   * @returns {Promise<object|null>} { id, meeting_id, start_time, end_time }
   */
  static findSessionById(internalSessionId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT ms.id, ms.meeting_id, ms.start_time, ms.end_time FROM meeting_sessions ms WHERE ms.id = ?',
        [internalSessionId],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });
  }

  /**
   * Find a meeting by its real meeting_id.
   * @param {string} realMeetingId
   * @returns {Promise<object|null>} meeting row
   */
  static findMeetingByRealId(realMeetingId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM meetings WHERE meeting_id = ?', [realMeetingId], (err, row) => {
        err ? reject(err) : resolve(row);
      });
    });
  }
}

module.exports = SessionQualityReportModel;

