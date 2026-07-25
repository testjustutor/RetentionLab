/**
 * controllers/reviewerReviewsController.js
 * Business logic for the reviewer review queue page.
 * Shows instructor dropdown and their sessions for review.
 */
const { db } = require('../../database/db');
const MeetingReviewersModel = require('../../models/reviewers/MeetingReviewersModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /** GET /api/reviewer-reviews/instructors — List instructors assigned to this reviewer */
  async getInstructors(req) {
    try {
      const reviewerId = req.user.id;

      // Only return instructors that have meetings assigned to this reviewer
      // Meetings are linked to instructors via calendar_account (email)
      let sql = `
        SELECT DISTINCT u.id, u.first_name, u.last_name, u.email,
               r.role_name
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        INNER JOIN meetings m ON LOWER(m.calendar_account) = LOWER(u.email)
        INNER JOIN meeting_reviewers mr ON mr.meeting_id = m.meeting_id AND mr.reviewer_id = ?
        WHERE u.deleted_at IS NULL
        AND u.is_active = 1
        AND r.role_name IN ('solo_instructor', 'instructor')
        ORDER BY u.first_name, u.last_name`;
      const params = [reviewerId];

      const rows = await new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
      });

      return ok({ instructors: rows });
    } catch (e) { return err(e.message); }
  },

  /** GET /api/reviewer-reviews/instructor-sessions — Get sessions for a specific instructor */
  async getInstructorSessions(req) {
    try {
      const reviewerId = req.user.id;
      const instructorId = req.query.instructor_id;
      const status = req.query.status || '';
      const search = req.query.search || '';

      if (!instructorId) return err('instructor_id is required', 400);

      let sql = `
        SELECT m.meeting_id,
               m.title as meeting_title,
               m.start_time,
               m.end_time,
               m.platform,
               m.meeting_link,
               m.status as meeting_status,
               m.calendar_account,
               ma.audio_path,
               ma.transcript_path,
               ma.summary_path,
               ma.oqi_score,
               ma.review_status as asset_review_status,
               (SELECT COUNT(*) FROM meeting_scores ms WHERE ms.meeting_id = m.meeting_id) as score_count,
               (SELECT AVG(ms.score) FROM meeting_scores ms WHERE ms.meeting_id = m.meeting_id) as avg_score,
               mr.id as review_id,
               mr.review_status,
               mr.assigned_at,
               mr.reviewed_at,
               mr.comments,
               CONCAT(u.first_name, ' ', u.last_name) as assigned_by_name
        FROM meetings m
        INNER JOIN meeting_reviewers mr ON mr.meeting_id = m.meeting_id AND mr.reviewer_id = ?
        LEFT JOIN meeting_assets ma ON ma.meeting_id = m.meeting_id
        LEFT JOIN users u ON u.id = mr.assigned_by
        WHERE LOWER(m.calendar_account) = (SELECT LOWER(email) FROM users WHERE id = ?)`;
      const params = [reviewerId, instructorId];

      if (status) {
        if (status === 'all') {
          // no filter
        } else if (status === 'pending') {
          sql += ` AND (mr.review_status = 'pending' OR mr.review_status IS NULL)`;
        } else if (status === 'in_progress') {
          sql += ` AND mr.review_status IN ('in_progress', 'in-progress')`;
        } else if (status === 'completed') {
          sql += ` AND mr.review_status = 'completed'`;
        } else if (status === 'unassigned') {
          sql += ` AND mr.review_status IS NULL`;
        }
      }

      if (search) {
        sql += ` AND (m.title LIKE ? OR m.platform LIKE ? OR m.calendar_account LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      sql += ` ORDER BY m.start_time DESC LIMIT 100`;

      const rows = await new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
      });

      // Format the data
      const sessions = rows.map(r => ({
        meeting_id: r.meeting_id,
        title: r.meeting_title || 'Untitled Session',
        platform: r.platform || 'unknown',
        start_time: r.start_time,
        end_time: r.end_time,
        meeting_link: r.meeting_link,
        calendar_account: r.calendar_account,
        duration: r.start_time && r.end_time
          ? Math.round((new Date(r.end_time) - new Date(r.start_time)) / 60000)
          : null,
        review_id: r.review_id,
        review_status: r.review_status || 'unassigned',
        assigned_at: r.assigned_at,
        reviewed_at: r.reviewed_at,
        comments: r.comments,
        has_audio: !!r.audio_path,
        has_transcript: !!r.transcript_path,
        has_summary: !!r.summary_path,
        oqi_score: r.oqi_score,
        score_count: r.score_count || 0,
        avg_score: r.avg_score ? Math.round(r.avg_score * 10) / 10 : null,
        assigned_by: r.assigned_by_name || '-',
        days_since_meeting: Math.floor((Date.now() - new Date(r.start_time).getTime()) / (1000 * 60 * 60 * 24))
      }));

      // Counts
      const counts = {
        total: sessions.length,
        unassigned: sessions.filter(s => s.review_status === 'unassigned').length,
        pending: sessions.filter(s => s.review_status === 'pending').length,
        in_progress: sessions.filter(s => s.review_status === 'in_progress' || s.review_status === 'in-progress').length,
        completed: sessions.filter(s => s.review_status === 'completed').length
      };

      // Overdue
      const overdue = sessions.filter(s => s.review_status !== 'completed' && s.review_status !== 'unassigned' && s.days_since_meeting > 7).length;

      return ok({ sessions, counts, overdue });
    } catch (e) { return err(e.message); }
  },

  /** PUT /api/reviewer-reviews/:meetingId/start — Start a review (create + mark in_progress) */
  async startReview(req) {
    try {
      const meetingId = req.params.meetingId;
      const reviewerId = req.user.id;

      // Check if review exists
      const existing = await new Promise((resolve, reject) => {
        db.get(
          `SELECT * FROM meeting_reviewers WHERE meeting_id = ? AND reviewer_id = ?`,
          [meetingId, reviewerId],
          (err, row) => err ? reject(err) : resolve(row)
        );
      });

      if (existing) {
        // Update to in_progress
        await MeetingReviewersModel.setReviewStatus(existing.id, 'in_progress');
        return ok({ review_id: existing.id }, 'Review started');
      }

      // Create new review
      const result = await MeetingReviewersModel.assignReviewer(meetingId, reviewerId, req.user.id);
      // Set to in_progress immediately
      if (result && result.id) {
        await MeetingReviewersModel.setReviewStatus(result.id, 'in_progress');
      }
      return ok({ review_id: result?.id }, 'Review started');
    } catch (e) { return err(e.message); }
  },

  /** PUT /api/reviewer-reviews/:meetingId/complete — Complete a review */
  async completeReview(req) {
    try {
      const meetingId = req.params.meetingId;
      const reviewerId = req.user.id;
      const { comments } = req.body;

      const existing = await new Promise((resolve, reject) => {
        db.get(
          `SELECT * FROM meeting_reviewers WHERE meeting_id = ? AND reviewer_id = ?`,
          [meetingId, reviewerId],
          (err, row) => err ? reject(err) : resolve(row)
        );
      });

      if (!existing) return err('Review not found. Start the review first.', 404);

      await MeetingReviewersModel.setReviewStatus(existing.id, 'completed', comments || null);
      return ok({ review_id: existing.id }, 'Review completed');
    } catch (e) { return err(e.message); }
  },

  /** GET /api/reviewer-reviews/stats — Quick stats for the reviewer */
  async getStats(req) {
    try {
      const reviewerId = req.user.id;

      const rows = await new Promise((resolve, reject) => {
        db.all(
          `SELECT mr.review_status,
                  COUNT(*) as count,
                  AVG(CASE WHEN mr.review_status = 'completed' AND mr.reviewed_at IS NOT NULL AND mr.assigned_at IS NOT NULL
                      THEN TIMESTAMPDIFF(HOUR, mr.assigned_at, mr.reviewed_at) END) as avg_hours
           FROM meeting_reviewers mr
           WHERE mr.reviewer_id = ?
           GROUP BY mr.review_status`,
          [reviewerId],
          (err, rows) => err ? reject(err) : resolve(rows || [])
        );
      });

      const stats = {
        pending: 0,
        in_progress: 0,
        completed: 0,
        avgCompletionHours: 0
      };

      for (const row of rows) {
        if (row.review_status === 'pending') stats.pending = row.count;
        if (row.review_status === 'in_progress' || row.review_status === 'in-progress') stats.in_progress = row.count;
        if (row.review_status === 'completed') {
          stats.completed = row.count;
          stats.avgCompletionHours = row.avg_hours ? Math.round(row.avg_hours * 10) / 10 : 0;
        }
      }

      return ok({ stats });
    } catch (e) { return err(e.message); }
  }
};

module.exports = controller;