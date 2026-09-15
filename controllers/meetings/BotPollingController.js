/**
 * Bot Polling Controller
 * Handles queued meeting polling and bot launching
 */

const MeetingModel = require('../../models/meetings/MeetingModel');
const botManager = require('../../services/shared/botManager');
const { logger } = require('../../utils/logger');
const settings = require('../../config/settings');

class BotPollingController {
  /**
   * Poll for queued meetings and launch bots
   */
  static async pollQueuedMeetings() {
    try {
      const queued = await MeetingModel.getQueuedMeetings(settings.bot.autoJoinLeadMinutes);

      if (queued.length > 0) {
        logger.info(`Polling found ${queued.length} queued meetings`);
      }

      for (const meeting of queued) {
        
        const minutesUntilStart = Math.round(
              (new Date(meeting.scheduled_start_time).getTime() - Date.now()) / 60000
            );

        // Timed out — mark expired and skip. Threshold is configurable via
        // BOT_QUEUED_EXPIRE_MINUTES in .env (see config/settings.js) so it
        // can be changed without touching code.
        if (minutesUntilStart < -settings.bot.queuedExpireMinutes) {
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
        const autoJoinLeadMinutes = settings.bot.autoJoinLeadMinutes;
        // Late-starting / queued-after-start meetings (e.g. a meeting created at
        // the same minute it was scheduled to start) must still launch instead
        // of sitting in queue forever. The far-future case is skipped above and
        // the long-expired case is marked 'expired' earlier, so falling through
        // means: within the pre-start window OR already started but not expired.
        if (minutesUntilStart > autoJoinLeadMinutes) continue;

        // Validate ID
        if (!meeting.external_meeting_id || meeting.external_meeting_id === 'null') {
          logger.warn('Skipping: no valid external_meeting_id');
          continue;
        }

        // Mark 'bot_launching' BEFORE calling launchFromDb — prevents double-launch.
        // meetings.status is the bot JOIN lifecycle; SocraticBot drives it onward
        // (waiting_for_host → joined, etc.), so do NOT set 'in_progress' here.
        // Skip if a bot is already live for this meeting - defense-in-depth
        // against re-queue loops stacking duplicate launches (the calendar sync
        // can re-queue a "stopped" meeting, and the window above allows late
        // joins, so never stack a second bot on top of a running one).
        const liveSession = botManager.getActiveSessionForMeeting(meeting.external_meeting_id)
          || botManager.getActiveSessionForMeeting(meeting.id);
        if (liveSession) {
          logger.warn('Skipping ' + meeting.external_meeting_id + ': bot already active for this meeting');
          continue;
        }
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