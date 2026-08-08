/**
 * controllers/reviewController.js
 * Business logic for the meeting review queue.
 * Uses meeting_reviewers and meeting_scores models.
 */
const { db } = require('../../database/db');
const MeetingModel = require('../../models/meetings/MeetingModel');
const CalendarUsersModel = require('../../models/calendar/CalendarUsersModel');
const UsersModel = require('../../models/users/UsersModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /** GET /api/reviews/queue — Get all reviews for admin's company */
  async getQueue(req) {
    try {
      const status = req.query.status || '';
      const companyId = req.user.company_id;

      let sql = `
        SELECT mr.*,
               m.title as meeting_title, m.scheduled_start_time as start_time, m.scheduled_end_time as end_time, m.platform, m.meeting_link,
               m.calendar_account,
               rev.first_name as reviewer_name, rev.email as reviewer_email,
               creator.first_name as assigned_by_name,
               owner.company_id as owner_company_id,
               (SELECT COUNT(*) FROM meeting_scores ms WHERE ms.meeting_id = mr.meeting_id) as score_count
        FROM meeting_reviewers mr
        LEFT JOIN meetings m ON m.external_meeting_id = mr.meeting_id
        LEFT JOIN users rev ON rev.id = mr.reviewer_id
        LEFT JOIN users creator ON creator.id = mr.assigned_by
        LEFT JOIN users owner ON owner.email = m.calendar_account
        WHERE 1=1`;
      const params = [];

      if (companyId) {
        sql += ' AND (owner.company_id = ? OR owner.company_id IS NULL)';
        params.push(companyId);
      }

      if (status) {
        sql += ' AND mr.review_status = ?';
        params.push(status);
      }

      sql += ' ORDER BY mr.assigned_at DESC LIMIT 100';

      const rows = await new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
      });

      const pending = rows.filter(r => r.review_status === 'pending').length;
      const inProgress = rows.filter(r => r.review_status === 'in_progress' || r.review_status === 'in-progress').length;
      const completed = rows.filter(r => r.review_status === 'completed').length;

      return ok({ reviews: rows, counts: { pending, inProgress, completed, total: rows.length } });
    } catch (e) { return err(e.message); }
  },

  /** PUT /api/reviews/:id/status — Update review status (assign/reject/complete) */
  async updateStatus(req) {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      if (!status) return err('Status is required', 400);

      const result = await new Promise((resolve, reject) => {
        db.run(
          `UPDATE meeting_reviewers SET review_status = ?, reviewed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE reviewed_at END WHERE id = ?`,
          [status, status, id],
          function(err) { err ? reject(err) : resolve({ updated: this.changes > 0 }); }
        );
      });
      return ok({ result }, 'Review status updated');
    } catch (e) { return err(e.message); }
  },

  /** GET /api/reviews/reviewers — List available reviewers */
  async getReviewers(req) {
    try {
      const result = await UsersModel.listUsers(req.user, { limit: 100 });
      const rows = result.rows || [];
      const reviewers = rows.filter(r => (r.role_name || '').toLowerCase() === 'reviewer');
      return ok({ reviewers });
    } catch (e) { return err(e.message); }
  },

  /** GET /api/reviews/instructors — List instructors for filter dropdown */
  async getInstructors(req) {
    try {
      const companyId = req.user.company_id;
      let sql = `
        SELECT DISTINCT u.id, u.first_name, u.last_name, u.email, u.status
        FROM users u
        WHERE u.role_id = (SELECT id FROM roles WHERE role_name = 'instructor')
        AND u.deleted_at IS NULL
      `;
      const params = [];

      if (companyId) {
        sql += ' AND u.company_id = ?';
        params.push(companyId);
      }

      sql += ' ORDER BY u.first_name, u.last_name';

      const rows = await new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
      });

      const instructors = rows.map(r => ({
        id: r.id,
        name: `${r.first_name} ${r.last_name || ''}`.trim(),
        email: r.email,
        status: r.status
      }));

      return ok({ instructors });
    } catch (e) { return err(e.message); }
  },

  /** GET /api/reviews/meetings/:instructorId — Get meetings for specific instructor */
  async getMeetingsByInstructor(req) {
    try {
      const instructorId = parseInt(req.params.instructorId);
      if (!instructorId) return err('Instructor ID required', 400);

      // Get instructor's email
      const instructor = await new Promise((resolve, reject) => {
        db.get('SELECT email FROM users WHERE id = ?', [instructorId], (err, row) => err ? reject(err) : resolve(row));
      });

      if (!instructor) return err('Instructor not found', 404);

      // Get meetings for this instructor
      const meetings = await new Promise((resolve, reject) => {
        db.all(
          `SELECT m.id, m.external_meeting_id as meeting_id, m.title, m.scheduled_start_time, 
                  m.scheduled_end_time, m.platform, m.status
           FROM meetings m
           WHERE LOWER(m.calendar_account) = LOWER(?)
           AND m.scheduled_start_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)
           ORDER BY m.scheduled_start_time DESC
           LIMIT 50`,
          [instructor.email],
          (err, rows) => err ? reject(err) : resolve(rows || [])
        );
      });

      return ok({ meetings });
    } catch (e) { return err(e.message); }
  },

  /** POST /api/reviews/assign-bulk — Assign reviewer to all meetings of an instructor */
  async assignBulk(req) {
    try {
      const { instructor_id, reviewer_id } = req.body;
      if (!instructor_id || !reviewer_id) return err('instructor_id and reviewer_id required', 400);

      // Get instructor's email
      const instructor = await new Promise((resolve, reject) => {
        db.get('SELECT email FROM users WHERE id = ?', [instructor_id], (err, row) => err ? reject(err) : resolve(row));
      });

      if (!instructor) return err('Instructor not found', 404);

      // Get all meetings for this instructor
      const meetings = await new Promise((resolve, reject) => {
        db.all(
          `SELECT m.external_meeting_id as meeting_id
           FROM meetings m
           WHERE LOWER(m.calendar_account) = LOWER(?)
           AND m.scheduled_start_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)`,
          [instructor.email],
          (err, rows) => err ? reject(err) : resolve(rows || [])
        );
      });

      if (!meetings.length) {
        return ok({ assigned: 0, message: 'No meetings found for this instructor' });
      }

      // Assign reviewer to all meetings
      let assignedCount = 0;
      for (const meeting of meetings) {
        const result = await new Promise((resolve, reject) => {
          db.run(
            `INSERT IGNORE INTO meeting_reviewers (meeting_id, reviewer_id, assigned_by, assigned_at, review_status)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'pending')`,
            [meeting.meeting_id, parseInt(reviewer_id), req.user.id],
            function(err) {
              if (err) return reject(err);
              resolve({ changes: this.changes });
            }
          );
        });
        assignedCount += result.changes;
      }

      return ok({ assigned: assignedCount }, `Assigned ${assignedCount} meetings to reviewer`);
    } catch (e) { return err(e.message); }
  },

  /** POST /api/reviews/assign — Assign a reviewer to a meeting */
  async assignReviewer(req) {
    try {
      const { meeting_id, reviewer_id } = req.body;
      if (!meeting_id || !reviewer_id) return err('meeting_id and reviewer_id required', 400);

      const result = await new Promise((resolve, reject) => {
        db.run(
          `INSERT IGNORE INTO meeting_reviewers (meeting_id, reviewer_id, assigned_by, assigned_at, review_status)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'pending')`,
          [meeting_id, parseInt(reviewer_id), req.user.id],
          function(err) {
            if (err) return reject(err);
            resolve({ id: this.lastID, changes: this.changes });
          }
        );
      });
      return ok({ result }, result.changes > 0 ? 'Reviewer assigned' : 'Already assigned');
    } catch (e) { return err(e.message); }
  }
};

module.exports = controller;