/**
 * models/session-quality/SessionQualityFilterModel.js
 * Data access for session quality filter (cascading dropdown) options.
 * All SQL lives here; controllers only call these methods.
 */
const { db } = require('../../database/db');

class SessionQualityFilterModel {
  /**
   * Get active instructors (with connected calendar) created by the given admin user.
   * @param {number} createdByUserId
   * @returns {Promise<Array>} [{ user_id, first_name, last_name, email }]
   */
  static getInstructors(createdByUserId) {
    const query = `
      SELECT DISTINCT u.id as user_id, u.first_name, u.last_name, u.email
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN calendar_connections cc ON cc.user_id = u.id
      WHERE r.role_name = 'instructor'
        AND u.status = 'active'
        AND u.created_by = ?
        AND cc.id IS NOT NULL
      ORDER BY u.first_name, u.last_name
    `;
    return new Promise((resolve, reject) => {
      db.all(query, [createdByUserId], (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }

  /**
   * Get distinct curricula (boards), optionally filtered by instructor.
   * @param {number} createdByUserId
   * @param {number} [instructorId]
   * @returns {Promise<Array>} [{ value, label }]
   */
  static getBoards(createdByUserId, instructorId) {
    let query = `
      SELECT DISTINCT sm.curriculum as value, sm.curriculum as label
      FROM session_metadata sm
      JOIN users u ON u.id = sm.teacher_user_id
      WHERE sm.curriculum IS NOT NULL AND sm.curriculum != ''
        AND u.created_by = ?
    `;
    const params = [createdByUserId];
    if (instructorId) {
      query += ' AND sm.teacher_user_id = ?';
      params.push(instructorId);
    }
    query += ' ORDER BY sm.curriculum';
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }

  /**
   * Get distinct student grades (classes), optionally filtered by instructor and/or board.
   * @param {number} createdByUserId
   * @param {number} [instructorId]
   * @param {string} [board]
   * @returns {Promise<Array>} [{ value, label }]
   */
  static getClasses(createdByUserId, instructorId, board) {
    let query = `
      SELECT DISTINCT sm.student_grade as value, sm.student_grade as label
      FROM session_metadata sm
      JOIN users u ON u.id = sm.teacher_user_id
      WHERE sm.student_grade IS NOT NULL AND sm.student_grade != ''
        AND u.created_by = ?
    `;
    const params = [createdByUserId];
    if (instructorId) {
      query += ' AND sm.teacher_user_id = ?';
      params.push(instructorId);
    }
    if (board) {
      query += ' AND sm.curriculum = ?';
      params.push(board);
    }
    query += ' ORDER BY sm.student_grade';
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }

  /**
   * Get distinct subjects, optionally filtered by instructor, board, and/or class.
   * @param {number} createdByUserId
   * @param {number} [instructorId]
   * @param {string} [board]
   * @param {string} [grade]
   * @returns {Promise<Array>} [{ value, label }]
   */
  static getSubjects(createdByUserId, instructorId, board, grade) {
    let query = `
      SELECT DISTINCT sm.subject as value, sm.subject as label
      FROM session_metadata sm
      JOIN users u ON u.id = sm.teacher_user_id
      WHERE sm.subject IS NOT NULL AND sm.subject != ''
        AND u.created_by = ?
    `;
    const params = [createdByUserId];
    if (instructorId) {
      query += ' AND sm.teacher_user_id = ?';
      params.push(instructorId);
    }
    if (board) {
      query += ' AND sm.curriculum = ?';
      params.push(board);
    }
    if (grade) {
      query += ' AND sm.student_grade = ?';
      params.push(grade);
    }
    query += ' ORDER BY sm.subject';
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }

  /**
   * Get meetings for instructors created by the given admin user, optionally filtered by instructor.
   * Uses internal meeting ID (not the real meeting_id) to avoid exposing sensitive data.
   * @param {number} createdByUserId
   * @param {number} [instructorId]
   * @returns {Promise<Array>} [{ internal_id, title, scheduled_start_time }]
   */
  static getMeetings(createdByUserId, instructorId) {
    let query = `
      SELECT m.id as internal_id, m.title, m.scheduled_start_time
      FROM meetings m
      JOIN users u ON m.calendar_account = u.email
      JOIN roles r ON r.id = u.role_id
      WHERE u.created_by = ?
        AND r.role_name = 'instructor'
    `;
    const params = [createdByUserId];
    if (instructorId) {
      query += ' AND u.id = ?';
      params.push(instructorId);
    }
    query += ' ORDER BY m.scheduled_start_time DESC LIMIT 100';
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }

  /**
   * Get sessions for a meeting, using internal meeting id (numeric) or legacy real meeting_id.
   * Uses internal session ID (not the real session_id) to avoid exposing sensitive data.
   * @param {number} createdByUserId
   * @param {string|number} lookupId - internal meeting id (numeric) or external meeting id
   * @returns {Promise<Array>} [{ internal_id, start_time }]
   */
  static getSessions(createdByUserId, lookupId) {
    let query = `
      SELECT ms.id as internal_id, ms.start_time
      FROM meeting_sessions ms
      JOIN meetings m ON ms.meeting_id = m.external_meeting_id
      JOIN users u ON m.calendar_account = u.email
      JOIN roles r ON r.id = u.role_id
    `;
    const params = [];
    // If numeric, it's an internal ID; otherwise it's a real meeting_id
    if (/^\d+$/.test(lookupId)) {
      query += ' WHERE m.id = ?';
      params.push(parseInt(lookupId, 10));
    } else {
      query += ' WHERE m.external_meeting_id = ?';
      params.push(lookupId);
    }
    query += ' AND u.created_by = ? AND r.role_name = \'instructor\'';
    params.push(createdByUserId);
    query += ' ORDER BY ms.start_time DESC';
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }
}
module.exports = SessionQualityFilterModel;

