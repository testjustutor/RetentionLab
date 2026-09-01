/**
 * controllers/scores/scoresController.js
 * Scores controller
 */
const RubricModel = require('../../models/rubrics/RubricModel');
const MeetingSessionScoresModel = require('../../models/meetings/MeetingSessionScoresModel');
const UsersModel = require('../../models/users/UsersModel');
const MeetingModel = require('../../models/meetings/MeetingModel');
const ScoresModel = require('../../models/scores/ScoresModel');

const controller = {
  async bulkSave(req, res) {
    try {
      const { meetingId, sessionId, scores } = req.body;
      if (!meetingId || sessionId == null || !Array.isArray(scores)) {
        return res.status(400).json({ error: 'meetingId, sessionId, and scores[] required' });
      }
      await RubricModel.saveMeetingScores(meetingId, sessionId, scores);
      res.json({ saved: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  async sessionUpsert(req, res) {
    try {
      const { meeting_id, session_id, indicator_id, score, comment } = req.body;
      if (!meeting_id || session_id === undefined || !indicator_id) {
        return res.status(400).json({ error: 'meeting_id, session_id, and indicator_id are required' });
      }
      const result = await MeetingSessionScoresModel.upsertScore({
        meeting_id,
        session_id: parseInt(session_id),
        indicator_id,
        reviewer_id: req.user.id,
        score: score ?? 0,
        comment: comment || null,
        score_type: 'MANUAL'
      });
      res.status(201).json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  async sessionGet(req, res) {
    try {
      const { meetingId, sessionId } = req.params;
      const rows = await MeetingSessionScoresModel.getScoresBySession(meetingId, parseInt(sessionId));
      res.json({ count: rows.length, data: rows, success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  async sessionDelete(req, res) {
    try {
      const { meetingId, sessionId } = req.params;
      const result = await MeetingSessionScoresModel.clearSessionScoresBySession(meetingId, sessionId);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  async meetingDelete(req, res) {
    try {
      const { meetingId } = req.params;
      const result = await MeetingSessionScoresModel.clearSessionScoresByMeeting(meetingId);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  async list(req, res) {
    try {
      const days = parseInt(req.query.days) || 90;
      const scores = await MeetingSessionScoresModel.getAllScoresWithDetails(days);
      res.json({ scores });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  /** POST /api/evaluation/instructors â€” List instructors for filter */
  async getInstructors(req, res) {
    try {
      const result = await UsersModel.listUsers(req.user, {
        role: 'instructor',
        limit: 100
      });
      const instructors = (result.rows || []).filter(u => (u.role_name || '').toLowerCase() === 'instructor');
      res.json({ instructors });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  /** GET /api/scores/sessions/:instructorId â€” Get sessions for instructor */
  async getSessionsByInstructor(req, res) {
    try {
      const instructorId = parseInt(req.params.instructorId);
      if (!instructorId) return res.status(400).json({ error: 'Instructor ID required' });

      // Get instructor's email
      const instructor = await ScoresModel.findEmailByUserId(instructorId);

      if (!instructor) return res.status(404).json({ error: 'Instructor not found' });

      // Get sessions for this instructor's meetings
      const sessions = await ScoresModel.getSessionsByInstructorEmail(instructor.email);

      res.json({ sessions });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  /** POST /api/evaluation/reviewers â€” List reviewers */
  async getReviewers(req, res) {
    try {
      const reviewers = await UsersModel.listByRole(req.user, 'reviewer');
      res.json({ reviewers });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  /** POST /api/scores/filtered â€” Get filtered scores with category structure */
  async getFilteredScores(req, res) {
    try {
      const { from_date, to_date, instructor_id, session_id, reviewer_id, search, page = 1, per_page = 50 } = req.body;

      const { rows, totalCount } = await ScoresModel.getFilteredScores({
        from_date, to_date, instructor_id, session_id, reviewer_id, search, page, per_page
      });

      // Group by category
      const byCategory = {};
      rows.forEach(score => {
        const catKey = score.category_id;
        if (!byCategory[catKey]) {
          byCategory[catKey] = {
            category_id: score.category_id,
            category_name: score.category_name,
            category_weight: score.category_weight,
            indicators: {}
          };
        }
        const indKey = score.indicator_id;
        if (!byCategory[catKey].indicators[indKey]) {
          byCategory[catKey].indicators[indKey] = {
            indicator_id: score.indicator_id,
            indicator_name: score.indicator_name,
            scores: []
          };
        }
        byCategory[catKey].indicators[indKey].scores.push(score);
      });

      const categories = Object.values(byCategory);
      const totalPages = Math.ceil(totalCount / per_page) || 1;
      const message = totalCount === 0 ? 'No scores found for the selected filters' : `${totalCount} score(s) found`;

      res.json({
        success: true,
        categories,
        totalCount,
        totalPages,
        currentPage: parseInt(page),
        perPage: parseInt(per_page),
        message,
        statusCode: 200
      });
    } catch (err) { res.status(500).json({ error: err.message, statusCode: 500 }); }
  }
};

module.exports = controller;
