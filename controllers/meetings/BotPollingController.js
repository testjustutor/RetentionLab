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
        
        const minutesUntilStart = Math.round(
              (new Date(meeting.scheduled_start_time).getTime() - Date.now()) / 60000
            );

        // Timed out — mark expired and skip
        if (minutesUntilStart < -5) {
          logger.warn(
            `Skipping ${meeting.external_meeting_id}: timed out by ${Math.abs(Math.round(minutesUntilStart))} mins`
          );
          const result = await MeetingModel.updateMeetingStatus(meeting.event_id, 'expired');
          if (!result.updated) {
            logger.error(`Failed to mark ${meeting.external_meeting_id} as expired — will retry next poll`);
          }
          continue;
        }

        // Wider 1–3 min window gives more polling cycles to catch it
        if (minutesUntilStart > 3 || minutesUntilStart < 1) continue;

        // Validate ID
        if (!meeting.external_meeting_id || meeting.external_meeting_id === 'null') {
          logger.warn('Skipping: no valid external_meeting_id');
          continue;
        }

        // Mark 'bot_launching' BEFORE calling launchFromDb — prevents double-launch.
        // meetings.status is the bot JOIN lifecycle; SocraticBot drives it onward
        // (waiting_for_host → joined, etc.), so do NOT set 'in_progress' here.
        await MeetingModel.updateMeetingStatus(meeting.event_id, 'bot_launching');

        try {
          await botManager.launchFromDb(meeting);
          logger.info(`Launched meeting ${meeting.external_meeting_id}`);
        } catch (launchErr) {
          logger.error(`Launch failed for ${meeting.external_meeting_id}:`, launchErr);
          // Roll back so it can be retried, or set 'failed' to stop retrying
          await MeetingModel.updateMeetingStatus(meeting.event_id, 'failed');
        }
      }
    } catch (err) {
      logger.error('Polling error:', err);
    } finally {
      setTimeout(BotPollingController.pollQueuedMeetings, 10000); //  10s poll
    }
  }
}

module.exports = BotPollingController;