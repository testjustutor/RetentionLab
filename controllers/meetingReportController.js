/**
 * controllers/meetingReportController.js
 * Business logic for meeting reports dashboard.
 */

const { db } = require('../database/db');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /**
   * GET /api/meetings/reports/summary
   * Returns meeting statistics for the reports dashboard
   */
  async getSummary(req) {
    try {
      const days = parseInt(req.query.days) || 30;
      const companyId = req.user?.company_id;

      const sql = `
        SELECT m.*,
               CONCAT(u.first_name, ' ', u.last_name) as owner_name,
               u.email as owner_email
        FROM meetings m
        LEFT JOIN users u ON u.id = m.owner_user_id
        WHERE m.start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
           OR m.start_time IS NULL
        ORDER BY m.start_time DESC
        LIMIT 100
      `;

      const meetings = await new Promise((resolve, reject) => {
        db.all(sql, [days], (err, rows) => err ? reject(err) : resolve(rows || []));
      });

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
  }
};

module.exports = controller;