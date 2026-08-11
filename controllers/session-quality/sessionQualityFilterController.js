/**
 * Session Quality Filter Controller
 * Provides cascading filter options for the session quality report pages.
 */

const { logger } = require('../../utils/logger');
const SessionQualityFilterModel = require('../../models/session-quality/SessionQualityFilterModel');

/**
 * Get all instructors/teachers.
 * Only returns active instructors with connected calendar, created by the logged-in admin user.
 * Returns [{user_id, name}]
 */
async function getInstructors(req) {
  try {
    const loggedInUserId = req.user?.id;
    
    const rows = await SessionQualityFilterModel.getInstructors(loggedInUserId);

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
    const rows = await SessionQualityFilterModel.getBoards(loggedInUserId, instructorId);

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
    const rows = await SessionQualityFilterModel.getClasses(loggedInUserId, instructorId, board);

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
    const rows = await SessionQualityFilterModel.getSubjects(loggedInUserId, instructorId, board, grade);

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

    const rows = await SessionQualityFilterModel.getMeetings(loggedInUserId, instructorId);

    const meetings = rows.map(r => ({
      value: r.internal_id,
      label: `${r.title || 'Untitled'} - ${r.scheduled_start_time ? new Date(r.scheduled_start_time).toLocaleDateString() : 'No date'}`
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

    const rows = await SessionQualityFilterModel.getSessions(loggedInUserId, lookupId);

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
