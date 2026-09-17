/**
 * controllers/reviewerReviewsController.js
 * Business logic for the reviewer review queue page.
 * Shows instructor dropdown and their sessions for review.
 */
const ReviewerReviewsModel = require('../../models/reviewer/ReviewerReviewsModel');
const MeetingReviewersModel = require('../../models/reviewers/MeetingReviewersModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /** GET /api/reviewer-reviews/instructors â€” List instructors assigned to this reviewer */
  async getInstructors(req) {
    try {
      const reviewerId = req.user.id;

      const rows = await ReviewerReviewsModel.getInstructorsForReviewer(reviewerId);

      return ok({ instructors: rows });
    } catch (e) { return err(e.message); }
  },

  /** GET /api/reviewer-reviews/instructor-sessions â€” Get sessions for a specific instructor */
  async getInstructorSessions(req) {
    try {
      const reviewerId = req.user.id;
      const instructorId = req.query.instructor_id;
      const status = req.query.status || '';
      const search = req.query.search || '';

      if (!instructorId) return err('instructor_id is required', 400);

      const rows = await ReviewerReviewsModel.getInstructorSessions(reviewerId, instructorId, status, search);

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

  /** GET /api/reviewer-reviews/filtered-reviews — Review queue filtered by date/meeting/session (read-only) */
  async getFilteredReviews(req) {
    try {
      const reviewerId = req.user.id;
      const q = req.query || {};
      const result = await ReviewerReviewsModel.getFilteredReviews(reviewerId, {
        from_date: q.from_date || '',
        to_date: q.to_date || '',
        meeting_id: q.meeting_id || '',
        session_id: q.session_id || ''
      });

      const sessions = result.rows.map((r) => ({
        meeting_id: r.meeting_id,
        title: r.meeting_title || 'Untitled Session',
        platform: r.platform || 'unknown',
        start_time: r.start_time,
        end_time: r.end_time,
        meeting_link: r.meeting_link,
        calendar_account: r.calendar_account,
        meeting_status: r.meeting_status,
        duration: r.start_time && r.end_time
          ? Math.round((new Date(r.end_time) - new Date(r.start_time)) / 60000)
          : null,
        score_count: r.score_count || 0,
        avg_score: r.avg_score ? Math.round(Number(r.avg_score) * 10) / 10 : null,
        session_count: r.session_count || 0,
        review_id: r.review_id,
        review_status: r.review_status,
        assigned_at: r.assigned_at,
        reviewed_at: r.reviewed_at,
        comments: r.comments,
        assigned_by: r.assigned_by_name || '-',
        days_since_meeting: r.start_time
          ? Math.floor((Date.now() - new Date(r.start_time).getTime()) / (1000 * 60 * 60 * 24))
          : 0
      }));

      return ok({ sessions, counts: result.summary });
    } catch (e) { return err(e.message); }
  },

  /** GET /api/reviewer-reviews/analytics — Reviewer analytics filtered by date/meeting/session */
  async getAnalytics(req) {
    try {
      const reviewerId = req.user.id;
      const q = req.query || {};
      const result = await ReviewerReviewsModel.getAnalytics(reviewerId, {
        from_date: q.from_date || '',
        to_date: q.to_date || '',
        meeting_id: q.meeting_id || '',
        session_id: q.session_id || ''
      });
      return ok({ analytics: result });
    } catch (e) { return err(e.message); }
  },

  /** PUT /api/reviewer-reviews/:meetingId/start â€” Start a review (create + mark in_progress) */
  async startReview(req) {
    try {
      const meetingId = req.params.meetingId;
      const reviewerId = req.user.id;

      // Check if review exists
      const existing = await ReviewerReviewsModel.findReview(meetingId, reviewerId);

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

  /** PUT /api/reviewer-reviews/:meetingId/complete â€” Complete a review */
  async completeReview(req) {
    try {
      const meetingId = req.params.meetingId;
      const reviewerId = req.user.id;
      const { comments } = req.body;

      const existing = await ReviewerReviewsModel.findReview(meetingId, reviewerId);

      if (!existing) return err('Review not found. Start the review first.', 404);

      await MeetingReviewersModel.setReviewStatus(existing.id, 'completed', comments || null);
      return ok({ review_id: existing.id }, 'Review completed');
    } catch (e) { return err(e.message); }
  },

  /** GET /api/reviewer-reviews/stats â€” Quick stats for the reviewer */
  async getStats(req) {
    try {
      const reviewerId = req.user.id;

      const rows = await ReviewerReviewsModel.getReviewerStats(reviewerId);

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
