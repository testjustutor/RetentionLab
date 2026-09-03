/**
 * controllers/meetings/assets/meetingAssetController.js
 * Meeting Asset Controller — orchestrates meeting_assets storage.
 * Contains logic/validation only; all SQL lives in MeetingAssetModel.
 */
const MeetingAssetModel = require('../../../models/meetings/assets/meetingAssetModel');
const { logger } = require('../../../utils/logger');

class MeetingAssetController {
  /**
   * Initialize a meeting asset row (status 'Conversion') with audio + transcript.
   * @param {string} meetingId - meeting_assets.meeting_id
   * @param {string} sessionId - meeting_assets.session_id
   * @param {string} audioPath - meeting_assets.audio_path
   * @param {string} transcriptPath - meeting_assets.transcript_path
   * @returns {Promise<Object>}
   */
  static async initializeAssets(meetingId, sessionId, audioPath, transcriptPath) {
    if (!meetingId || !sessionId) {
      logger.warn('[MeetingAssetController] initializeAssets skipped: missing meetingId/sessionId');
      throw new Error('[MeetingAssetController] initializeAssets requires meetingId and sessionId');
    }
    const result = await MeetingAssetModel.initializeAssets(
      meetingId,
      sessionId,
      audioPath || null,
      transcriptPath || null
    );
    logger.info(
      `[MeetingAssetController] Assets initialized for meeting ${meetingId} session ${sessionId}`
    );
    return result;
  }

  /**
   * Update meeting asset fields for a specific session of a meeting.
   * @param {string} meetingId - meeting_assets.meeting_id
   * @param {string} sessionId - meeting_assets.session_id
   * @param {Object} data - column => value map (only existing columns are written)
   * @returns {Promise<Object>}
   */
  static async updateAssets(meetingId, sessionId, data) {
    if (!meetingId || !sessionId) {
      logger.warn('[MeetingAssetController] updateAssets skipped: missing meetingId/sessionId');
      throw new Error('[MeetingAssetController] updateAssets requires meetingId and sessionId');
    }

    if (!data || typeof data !== 'object') {
      logger.warn('[MeetingAssetController] updateAssets skipped: invalid data payload');
      throw new Error('[MeetingAssetController] updateAssets expects a data object');
    }

    const result = await MeetingAssetModel.updateAssets(meetingId, sessionId, data);
    logger.info(
      `[MeetingAssetController] Assets updated for meeting ${meetingId} session ${sessionId}`
    );
    return result;
  }
}

module.exports = MeetingAssetController;
