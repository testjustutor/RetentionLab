/**
 * controllers/meetings/meetingsController.js
 * Meetings controller
 */
const { logger } = require('../../utils/logger');
const TranscriptModel = require('../../models/transcripts/transcriptModel');
const MeetingModel = require('../../models/meetings/MeetingModel');
const CalendarUsersModel = require('../../models/calendar/CalendarUsersModel');
const botManager = require('../../services/shared/botManager');
const PlatformFactory = require('../../services/platforms/platformFactory');

const controller = {
  async list(req, res) {
    try {
      const meetings = botManager.listInstances();
      res.json({ status: 'success', data: { total: meetings.length, meetings } });
    } catch (err) {
      logger.error('Controller(meeting): Error listing meetings:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  },

  async listFromDb(req, res) {
    try {
      const days = parseInt(req.query.days) || 90;
      const meetings = await MeetingModel.getMeetingsWithOwnerDetails(days);
      res.json({ meetings });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  async getById(req, res) {
    try {
      const { meetingId } = req.params;
      const session = await TranscriptModel.getSessionByMeetingId(meetingId);
      if (!session) return res.status(404).json({ status: 'error', message: 'Meeting not found' });
      res.json({ status: 'success', data: session });
    } catch (err) {
      logger.error('Controller(meeting): Error fetching meeting:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  },

  async join(req, res) {
    try {
      const { platform, meetingId, meetingUrl, passcode, botName, webhookUrl } = req.body;
      if (!platform || !meetingId || !meetingUrl) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields: platform, meetingId, meetingUrl' });
      }
      logger.info(`Controller(meeting): API: Attempting to join ${platform} meeting: ${meetingId}`);
      const result = await PlatformFactory.startBot({ platform, meetingId, meetingUrl, passcode, botName: botName || `Bot-${platform}`, webhookUrl });
      if (result.success) {
        res.status(200).json({ status: 'success', data: { meetingId: result.meetingId, sessionId: result.sessionId, platform, status: 'joining' } });
      } else {
        res.status(400).json({ status: 'error', message: result.error || 'Failed to join meeting' });
      }
    } catch (err) {
      logger.error('Controller(meeting): Error joining meeting:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  },

  async leave(req, res) {
    try {
      const { meetingId } = req.params;
      const result = await botManager.stopBot(meetingId);
      if (result.success) {
        res.json({ status: 'success', message: `Bot left meeting ${meetingId}`, data: result });
      } else {
        res.status(400).json({ status: 'error', message: result.error || 'Failed to leave meeting' });
      }
    } catch (err) {
      logger.error('Controller(meeting): Error leaving meeting:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  },

  async getStatus(req, res) {
    try {
      const { meetingId } = req.params;
      const instance = botManager.getInstance(meetingId);
      if (!instance) return res.status(404).json({ status: 'error', message: 'Bot not found for this meeting' });
      res.json({ status: 'success', data: { meetingId, botStatus: instance.status, duration: instance.startedAt ? Math.floor((Date.now() - instance.startedAt) / 1000) : 0, startedAt: instance.startedAt, platform: instance.config.platform } });
    } catch (err) {
      logger.error('Controller(meeting): Error getting meeting status:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  },

  /**
   * Get a user's stored Google Calendar credentials.
   * (Helper for calendarSyncService — no database logic here.)
   */
  async getCalendarUser(userId) {
    if (!userId) throw new Error('Controller(meeting): getCalendarUser requires userId');
    return CalendarUsersModel.getUser(userId);
  },

  /**
   * Persist refreshed Google Calendar tokens for a user.
   * (Helper for calendarSyncService — no database logic here.)
   */
  async saveCalendarUserTokens(userId, tokens) {
    if (!userId) throw new Error('Controller(meeting): saveCalendarUserTokens requires userId');
    return CalendarUsersModel.createOrUpdateUserCalendar(userId, tokens);
  },

  /**
   * Sync a single calendar event into the meetings table, deduplicating by
   * title + start time + calendar account: update the existing meeting or
   * create a new one.
   * (Helper for calendarSyncService — wraps the MeetingModel calendar-sync queries.)
   */
  async syncMeetingFromCalendar({ title, platform, startTime, endTime, userId, calendarAccount }) {
    if (!title || !startTime || !endTime || !userId) {
      throw new Error('Controller(meeting): syncMeetingFromCalendar requires title, startTime, endTime, userId');
    }
    // Normalize Google ISO timestamps to the app's MySQL-friendly wall-clock
    // format (Asia/Kolkata, 'YYYY-MM-DD HH:MM:SS') used across the codebase, so
    // the insert and the deduplication lookup compare the same stable value.
    const norm = (iso) => new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace(',', '');
    const start = norm(startTime);
    const end = norm(endTime);

    const existingMeeting = await MeetingModel.findMeetingByTitleAndTime(title, start, calendarAccount);

    if (existingMeeting) {
      await MeetingModel.updateMeetingFromCalendar(existingMeeting.id, title, platform, start, end);
      return { created: false, meetingId: existingMeeting.id };
    }

    const created = await MeetingModel.createMeetingFromCalendar(title, platform, start, end, userId, calendarAccount);
    return { created: true, meetingId: created.meetingId };
  }
};

module.exports = controller;