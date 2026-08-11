/**
 * models/scores/ScoresModel.js
 * Data access for score and session-endpoint queries.
 * All SQL lives here; controllers only call these methods.
 */
const { db } = require('../../database/db');

class ScoresModel {
  /**
   * Get the email for a user by id.
   * @param {number} userId
   * @returns {Promise<object|null>} { email }
   */
  static findEmailByUserId(userId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT email FROM users WHERE id = ?', [userId], (err, row) => err ? reject(err) : resolve(row));
    });
  }

  /**
   * Get sessions for a given instructor (matched by calendar account email).
   * @param {string} email
   * @returns {Promise<Array>} [{ session_id, meeting_id, meeting_title, start_time, end_time, transcript_file_name }]
   */
  static getSessionsByInstructorEmail(email) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT DISTINCT ms.id as session_id, ms.meeting_id, m.title as meeting_title,
                ms.start_time, ms.end_time, ms.transcript_file_name
         FROM meeting_sessions ms
         JOIN meetings m ON m.id = ms.meeting_id
         WHERE LOWER(m.calendar_account) = LOWER(?)
         AND ms.start_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)
         ORDER BY ms.start_time DESC
         LIMIT 50`,
        [email],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      );
    });
  }

  /**
   * Get filtered scores with the requested filters, plus a total count for pagination.
   * @param {object} opts { from_date, to_date, instructor_id, session_id, reviewer_id, search, page, per_page }
   * @returns {Promise<{ rows: Array, totalCount: number }>}
   */
  static getFilteredScores(opts = {}) {
    return (async () => {
      const { from_date, to_date, instructor_id, session_id, reviewer_id, search } = opts;
      const page = parseInt(opts.page) || 1;
      const per_page = parseInt(opts.per_page) || 50;

      let sql = `
        SELECT ms.*, m.title as meeting_title, m.scheduled_start_time as meeting_date,
               CONCAT(u.first_name, ' ', u.last_name) as reviewer_name,
               u.id as reviewer_id,
               i.name as indicator_name, i.category_id,
               c.name as category_name, c.weight as category_weight
        FROM meeting_session_scores ms
        JOIN meeting_sessions msess ON msess.id = ms.session_id
        JOIN meetings m ON m.id = msess.meeting_id
        JOIN users u ON u.id = ms.reviewer_id
        JOIN rubric_indicators i ON i.indicator_id = ms.indicator_id
        JOIN rubric_categories c ON c.category_id = i.category_id
        WHERE 1=1
      `;
      const params = [];

      // Filter by date range
      if (from_date) {
        sql += ' AND ms.created_at >= ?';
        params.push(from_date + ' 00:00:00');
      }

      if (to_date) {
        sql += ' AND ms.created_at <= ?';
        params.push(to_date + ' 23:59:59');
      }

      // Filter by instructor (via meeting calendar_account)
      if (instructor_id) {
        const instructor = await ScoresModel.findEmailByUserId(instructor_id);
        if (instructor) {
          sql += ' AND LOWER(m.calendar_account) = LOWER(?)';
          params.push(instructor.email);
        }
      }

      // Filter by session
      if (session_id) {
        sql += ' AND ms.session_id = ?';
        params.push(parseInt(session_id));
      }

      // Filter by reviewer
      if (reviewer_id) {
        sql += ' AND ms.reviewer_id = ?';
        params.push(parseInt(reviewer_id));
      }

      // Search filter
      if (search) {
        sql += ' AND (m.title LIKE ? OR i.name LIKE ? OR c.name LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      // Get total count
      const countSql = sql.replace(
        'SELECT ms.*, m.title as meeting_title, m.scheduled_start_time as meeting_date, CONCAT(u.first_name, \' \', u.last_name) as reviewer_name, u.id as reviewer_id, i.name as indicator_name, i.category_id, c.name as category_name, c.weight as category_weight',
        'SELECT COUNT(*) as total'
      );
      const countRow = await new Promise((resolve, reject) => {
        db.get(countSql, params, (err, row) => err ? reject(err) : resolve(row || { total: 0 }));
      });
      const totalCount = countRow.total;

      // Add pagination
      const offset = (page - 1) * per_page;
      sql += ' ORDER BY c.name ASC, i.name ASC, ms.created_at DESC LIMIT ? OFFSET ?';
      params.push(per_page, offset);

      const rows = await new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
      });

      return { rows, totalCount };
    })();
  }
}

module.exports = ScoresModel;
