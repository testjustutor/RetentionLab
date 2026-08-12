/**
 * controllers/meetings/meeting-session/meetingSessionController.js
 * Meeting Session Controller — orchestrates meeting_sessions updates.
 * Contains logic/validation only; all SQL lives in MeetingSessionModel.
 */
const MeetingSessionModel = require('../../../models/meetings/meeting-session/meetingSessionModel');
const { logger } = require('../../../utils/logger');

class MeetingSessionController {
  /**
   * Create a meeting session and return the created/reused session row.
   * @param {string} meetingId - meetings id
   * @returns {Promise<Object>} session row or { id: null, meeting_id }
   */
  static async createSession(meetingId) {
    if (!meetingId) {
      logger.warn('[MeetingSessionController] createSession skipped: missing meetingId');
      throw new Error('[MeetingSessionController] createSession requires meetingId');
    }
    const session = await MeetingSessionModel.createSession(meetingId);
    logger.info(`[MeetingSessionController] Session created for meeting ${meetingId}: id=${session.id}`);
    return session;
  }

  /**
   * Save the recorded audio path for a session.
   * @param {string} meetingId - meetings id (used for logging/context; session id is authoritative)
   * @param {number} sessionId - meeting_sessions.id
   * @param {string} filePath - audio file path
   * @returns {Promise<boolean>}
   */
  static async updateMeetingSessionAudioPath(meetingId, sessionId, filePath) {
    if (!sessionId || !filePath) {
      logger.warn('[MeetingSessionController] updateMeetingSessionAudioPath skipped: missing sessionId/filePath');
      return false;
    }
    const updated = await MeetingSessionModel.updateAudioPath(sessionId, filePath);
    logger.info(`[MeetingSessionController] Audio path saved for session ${sessionId} (meeting ${meetingId})`);
    return updated;
  }

  /**
   * Fetch a session by its id.
   * @param {number} sessionId - meeting_sessions.id
   * @returns {Promise<Object|null>}
   */
  static async getMeetingSessionById(sessionId) {
    if (!sessionId) {
      logger.warn('[MeetingSessionController] getMeetingSessionById skipped: missing sessionId');
      return null;
    }
    return MeetingSessionModel.getById(sessionId);
  }

  /**
   * Update a session status.
   * @param {string} meetingId - meetings id (used for logging only; session id is authoritative)
   * @param {number} sessionId - meeting_sessions.id
   * @param {string} status - e.g. 'completed'
   * @returns {Promise<boolean>}
   */
  static async updateMeetingSessionStatus(meetingId, sessionId, status) {
    if (!sessionId || !status) {
      logger.warn('[MeetingSessionController] updateMeetingSessionStatus skipped: missing sessionId/status');
      return false;
    }
    const updated = await MeetingSessionModel.updateStatus(sessionId, status);
    logger.info(`[MeetingSessionController] Session ${sessionId} (meeting ${meetingId}) status -> ${status}`);
    return updated;
  }
}

module.exports = MeetingSessionController;