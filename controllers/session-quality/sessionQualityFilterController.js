/**
 * Session Quality Filter Controller
 * Provides cascading filter options for the session quality report pages.
 */

const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

/**
 * Get all instructors/teachers.
 * Only returns active instructors with connected calendar, created by the logged-in admin user.
 * Returns [{user_id, name}]
 */
async function getInstructors(req) {
  try {
    const loggedInUserId = req.user?.id;
    
    const query = `
      SELECT DISTINCT u.id as user_id, u.first_name, u.last_name, u.email
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN calendar_integrations ci ON ci.user_id = u.id
      WHERE r.role_name = 'instructor'
        AND u.status = 'active'
        AND u.created_by = ?
        AND ci.id IS NOT NULL
      ORDER BY u.first_name, u.last_name
    `;
    const rows = await new Promise((resolve, reject) => {
      db.all(query, [loggedInUserId], (err, rows) => err ? reject(err) : resolve(rows || []));
    });

    const instructors = rows.map(r => ({
      value: r.user_id,
      label: `${r.first_name || ''} ${r.last_name || ''} (${r.email})`.trim() || r.email
    }));

    return { statusCode: 200, success: true, data: { options: instructors } };
  } catch (error) {
    logger.error('Error fetching instructors:', error);
    return { statusCode: 500, success: false, error: 'Failed to fetch instructors' };
  }
}

/**
 * Get boards/curricula, optionally filtered by instructor.
 * Only returns curricula for instructors created by the logged-in admin user.
 */
async function getBoards(req) {
  try {
    const loggedInUserId = req.user?.id;
    const instructorId = req.body?.instructor_id;
    let query = `
      SELECT DISTINCT sm.curriculum as value, sm.curriculum as label
      FROM session_metadata sm
      JOIN users u ON u.id = sm.teacher_user_id
      WHERE sm.curriculum IS NOT NULL AND sm.curriculum != ''
        AND u.created_by = ?
    `;
    const params = [loggedInUserId];
    if (instructorId) {
      query += ' AND sm.teacher_user_id = ?';
      params.push(instructorId);
    }
    query += ' ORDER BY sm.curriculum';

    const rows = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });

    return { statusCode: 200, success: true, data: { options: rows } };
  } catch (error) {
    logger.error('Error fetching boards:', error);
    return { statusCode: 500, success: false, error: 'Failed to fetch boards' };
  }
}

/**
 * Get classes/grades, optionally filtered by instructor and/or board.
 * Only returns grades for instructors created by the logged-in admin user.
 */
async function getClasses(req) {
  try {
    const loggedInUserId = req.user?.id;
    const instructorId = req.body?.instructor_id;
    const board = req.body?.board;
    let query = `
      SELECT DISTINCT sm.student_grade as value, sm.student_grade as label
      FROM session_metadata sm
      JOIN users u ON u.id = sm.teacher_user_id
      WHERE sm.student_grade IS NOT NULL AND sm.student_grade != ''
        AND u.created_by = ?
    `;
    const params = [loggedInUserId];
    if (instructorId) {
      query += ' AND sm.teacher_user_id = ?';
      params.push(instructorId);
    }
    if (board) {
      query += ' AND sm.curriculum = ?';
      params.push(board);
    }
    query += ' ORDER BY sm.student_grade';

    const rows = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });

    return { statusCode: 200, success: true, data: { options: rows } };
  } catch (error) {
    logger.error('Error fetching classes:', error);
    return { statusCode: 500, success: false, error: 'Failed to fetch classes' };
  }
}

/**
 * Get subjects, optionally filtered by instructor, board, and/or class.
 * Only returns subjects for instructors created by the logged-in admin user.
 */
async function getSubjects(req) {
  try {
    const loggedInUserId = req.user?.id;
    const instructorId = req.body?.instructor_id;
    const board = req.body?.board;
    const grade = req.body?.grade;
    let query = `
      SELECT DISTINCT sm.subject as value, sm.subject as label
      FROM session_metadata sm
      JOIN users u ON u.id = sm.teacher_user_id
      WHERE sm.subject IS NOT NULL AND sm.subject != ''
        AND u.created_by = ?
    `;
    const params = [loggedInUserId];
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

    const rows = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });

    return { statusCode: 200, success: true, data: { options: rows } };
  } catch (error) {
    logger.error('Error fetching subjects:', error);
    return { statusCode: 500, success: false, error: 'Failed to fetch subjects' };
  }
}

/**
 * Get meetings list, optionally filtered by instructor.
 * Only returns meetings for instructors created by the logged-in admin user.
 * Uses internal meeting ID (not the real meeting_id) to avoid exposing sensitive data.
 */
async function getMeetings(req) {
  try {
    const loggedInUserId = req.user?.id;
    const instructorId = req.body?.instructor_id;

    let query = `
      SELECT m.id as internal_id, m.title, m.start_time
      FROM meetings m
      JOIN users u ON m.calendar_account = u.email
      JOIN roles r ON r.id = u.role_id
      WHERE u.created_by = ?
        AND r.role_name = 'instructor'
    `;
    const params = [loggedInUserId];
    
    if (instructorId) {
      query += ' AND u.id = ?';
      params.push(instructorId);
    }
    query += ' ORDER BY m.start_time DESC LIMIT 100';

    const rows = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });

    const meetings = rows.map(r => ({
      value: r.internal_id,
      label: `${r.title || 'Untitled'} - ${r.start_time ? new Date(r.start_time).toLocaleDateString() : 'No date'}`
    }));

    return { statusCode: 200, success: true, data: { options: meetings } };
  } catch (error) {
    logger.error('Error fetching meetings:', error);
    return { statusCode: 500, success: false, error: 'Failed to fetch meetings' };
  }
}

/**
 * Get sessions list for a specific meeting.
 * Only returns sessions for meetings belonging to instructors created by the logged-in admin user.
 * Uses internal session ID (not the real session_id) to avoid exposing sensitive data.
 */
async function getSessions(req) {
  try {
    const loggedInUserId = req.user?.id;
    const meetingInternalId = req.body?.meeting_internal_id;
    const meetingId = req.body?.meeting_id;

    // Support both internal ID (preferred) and legacy meeting_id
    const lookupId = meetingInternalId || meetingId;

    if (!lookupId) {
      return { statusCode: 400, success: false, error: 'Meeting identifier is required' };
    }

    let query = `
      SELECT ms.id as internal_id, ms.start_time
      FROM meeting_sessions ms
      JOIN meetings m ON ms.meeting_id = m.meeting_id
      JOIN users u ON m.calendar_account = u.email
      JOIN roles r ON r.id = u.role_id
    `;
    const params = [];
    
    // If numeric, it's an internal ID; otherwise it's a real meeting_id
    if (/^\d+$/.test(lookupId)) {
      query += ' WHERE m.id = ?';
      params.push(parseInt(lookupId, 10));
    } else {
      query += ' WHERE m.meeting_id = ?';
      params.push(lookupId);
    }
    
    query += ' AND u.created_by = ? AND r.role_name = \'instructor\'';
    params.push(loggedInUserId);
    query += ' ORDER BY ms.start_time DESC';

    const rows = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });

    const sessions = rows.map(r => ({
      value: r.internal_id,
      label: `Sess ${r.internal_id} - ${r.start_time ? new Date(r.start_time).toLocaleDateString() : 'No date'}`
    }));

    return { statusCode: 200, success: true, data: { options: sessions } };
  } catch (error) {
    logger.error('Error fetching sessions:', error);
    return { statusCode: 500, success: false, error: 'Failed to fetch sessions' };
  }
}

module.exports = {
  getInstructors,
  getBoards,
  getClasses,
  getSubjects,
  getMeetings,
  getSessions
};
