/**
 * controllers/instructorMeetingsController.js
 * Meetings scoped to the currently logged-in instructor.
 * Uses req.user.email (from auth middleware) to filter calendar_account.
 */
const MeetingModel = require('../models/MeetingModel');
const { logger } = require('../utils/logger');

function ok(data, msg) { return { success: true, message: msg || null, ...data }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /**
   * GET /api/instructor-meetings/upcoming
   */
  async getUpcoming(req) {
    try {
      const email = req.user?.email;
      if (!email) return err('No email in session', 401);

      const hours = parseInt(req.query.hours) || 720; // default 30 days
      const meetings = await MeetingModel.getMeetingsByAccounts([email.toLowerCase()], hours);

      return ok({
        meetings: (meetings || []).map(m => ({
          meetingId: m.meeting_id,
          title: m.title,
          platform: m.platform,
          meetingLink: m.meeting_link,
          startTime: m.start_time,
          endTime: m.end_time,
          status: m.status,
          calendarAccount: m.calendar_account,
          sessionId: m.session_id
        }))
      });
    } catch (e) { return err(e.message); }
  },

  /**
   * GET /api/instructor-meetings/live
   */
  async getLive(req) {
    try {
      const email = req.user?.email;
      if (!email) return err('No email in session', 401);

      const meetings = await MeetingModel.getLiveMeetingsByAccounts([email.toLowerCase()]);

      return ok({
        meetings: (meetings || []).map(m => ({
          meetingId: m.meeting_id,
          title: m.title,
          platform: m.platform,
          meetingLink: m.meeting_link,
          startTime: m.start_time,
          endTime: m.end_time,
          status: m.status,
          sessionId: m.session_id
        }))
      });
    } catch (e) { return err(e.message); }
  },

  /**
   * GET /api/instructor-meetings/completed
   */
  async getCompleted(req) {
    try {
      const email = req.user?.email;
      if (!email) return err('No email in session', 401);

      const hours = parseInt(req.query.hours) || 2160; // default 90 days
      const meetings = await MeetingModel.getCompletedMeetingsByAccounts([email.toLowerCase()], hours);

      return ok({
        meetings: (meetings || []).map(m => ({
          meetingId: m.meeting_id,
          title: m.title,
          platform: m.platform,
          meetingLink: m.meeting_link,
          startTime: m.start_time,
          endTime: m.end_time,
          status: m.status,
          calendarAccount: m.calendar_account,
          sessionId: m.session_id
        }))
      });
    } catch (e) { return err(e.message); }
  },

  /**
   * GET /api/instructor-meetings/stats
   * Summary counts for the instructor's meetings
   */
  async getStats(req) {
    try {
      const email = req.user?.email;
      if (!email) return err('No email in session', 401);

      const lcEmail = email.toLowerCase();

      const [upcoming, live, completed] = await Promise.all([
        MeetingModel.getMeetingsByAccounts([lcEmail], 720),
        MeetingModel.getLiveMeetingsByAccounts([lcEmail]),
        MeetingModel.getCompletedMeetingsByAccounts([lcEmail], 2160)
      ]);

      return ok({
        upcomingCount: (upcoming || []).length,
        liveCount: (live || []).length,
        completedCount: (completed || []).length
      });
    } catch (e) { return err(e.message); }
  }
};

module.exports = controller;
