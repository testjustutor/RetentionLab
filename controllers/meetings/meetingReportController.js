/**
 * controllers/meetingReportController.js
 * Business logic for meeting reports dashboard.
 */
const MeetingReportModel = require('../../models/meetings/MeetingReportModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /**
   * GET /api/meetings/reports/summary
   * Returns meeting statistics for the reports dashboard, filtered by date range and instructor.
   */
  async getSummary(req) {
    try {
      const { from_date, to_date, instructor_id } = req.query;

      const meetings = await MeetingReportModel.getMeetings({ from_date, to_date, instructor_id });

      // Calculate stats
      const total = meetings.length;
      const active = meetings.filter(m => m.status === 'active' || m.status === 'joining').length;
      const completed = meetings.filter(m => m.status === 'completed').length;
      const scheduled = meetings.filter(m => m.status === 'scheduled').length;

      // Calculate average duration
      let totalDuration = 0;
      let countWithDuration = 0;
      meetings.forEach(m => {
        if (m.start_time && m.end_time) {
          const diff = new Date(m.end_time) - new Date(m.start_time);
          if (diff > 0) {
            totalDuration += diff / 60000; // Convert to minutes
            countWithDuration++;
          }
        }
      });
      const avgDuration = countWithDuration > 0 ? Math.round(totalDuration / countWithDuration) : 0;

      return ok({
        meetings,
        stats: {
          total,
          active,
          completed,
          scheduled,
          avgDuration
        }
      });
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * GET /api/meetings/reports/instructors
   * Returns active instructors with connected calendars for the filter dropdown.
   */
  async getInstructors(req) {
    try {
      const instructors = await MeetingReportModel.getInstructors(req.user);
      return ok({ instructors });
    } catch (e) {
      return err(e.message);
    }
  }
};

module.exports = controller;
