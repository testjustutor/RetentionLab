/**
 * Bot Polling Controller
 * Handles queued meeting polling and bot launching
 */

const MeetingModel = require('../../models/meetings/MeetingModel');
const botManager = require('../../services/shared/botManager');
const { logger } = require('../../utils/logger');

class BotPollingController {
  /**
   * Poll for queued meetings and launch bots
   */
  static async pollQueuedMeetings() {
    try {
      const queued = await MeetingModel.getQueuedMeetings(['queued']);

      if (queued.length > 0) {
        logger.info(`Polling found ${queued.length} queued meetings`);
      }

      for (const meeting of queued) {
        const minutesUntilStart =
          (new Date(meeting.start_time).getTime() - Date.now()) / 60000;

        // Timed out — mark expired and skip
        if (minutesUntilStart < -5) {
          logger.warn(
            `Skipping ${meeting.meeting_id}: timed out by ${Math.abs(Math.round(minutesUntilStart))} mins`
          );
          await MeetingModel.updateMeetingStatus(meeting.event_id, 'expired');
          continue;
        }

        // Wider 1–3 min window gives more polling cycles to catch it
        if (minutesUntilStart > 3 || minutesUntilStart < 1) continue;

        // Validate ID
        if (!meeting.meeting_id || meeting.meeting_id === 'null') {
          logger.warn('Skipping: no valid meeting_id');
          continue;
        }

        // Mark 'launching' BEFORE calling launchFromDb — prevents double-launch
        await MeetingModel.updateMeetingStatus(meeting.event_id, 'launching');

        try {
          await botManager.launchFromDb(meeting);
          await MeetingModel.updateMeetingStatus(meeting.event_id, 'in_progress');
          logger.info(`Launched meeting ${meeting.meeting_id}`);
        } catch (launchErr) {
          logger.error(`Launch failed for ${meeting.meeting_id}:`, launchErr);
          // Roll back so it can be retried, or set 'failed' to stop retrying
          await MeetingModel.updateMeetingStatus(meeting.event_id, 'failed');
        }
      }
    } catch (err) {
      logger.error('Polling error:', err);
    } finally {
      setTimeout(BotPollingController.pollQueuedMeetings, 30000);
    }
  }
}

module.exports = BotPollingController;