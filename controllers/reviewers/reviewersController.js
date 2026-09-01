/**
 * controllers/reviewers/reviewersController.js
 * Reviewers controller
 */
const MeetingReviewersModel = require('../../models/reviewers/MeetingReviewersModel');
const MeetingScoresModel = require('../../models/reviews/MeetingScoresModel');

const controller = {
  async assign(req, res) {
    try {
      const { meetingId, reviewerId } = req.body;
      const r = await MeetingReviewersModel.assignReviewer(meetingId, reviewerId, req.user.id);
      res.status(201).json(r);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async getForMeeting(req, res) {
    try {
      const rows = await MeetingReviewersModel.getReviewersForMeeting(req.params.meetingId);
      res.json({ count: rows.length, data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async updateStatus(req, res) {
    try {
      const { status, comments } = req.body;
      const result = await MeetingReviewersModel.setReviewStatus(req.params.id, status, comments);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async remove(req, res) {
    try {
      const result = await MeetingReviewersModel.removeReviewer(req.params.id);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async scoreUpsert(req, res) {
    try {
      const { meeting_id, session_id, indicator_id, score, comment } = req.body;
      const result = await MeetingScoresModel.upsertScore({ meeting_id, session_id, indicator_id, reviewer_id: req.user.id, score, comment, score_type: 'MANUAL' });
      res.status(201).json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async getScores(req, res) {
    try {
      const rows = await MeetingScoresModel.getScoresByMeeting(req.params.meetingId);
      res.json({ count: rows.length, data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
};

module.exports = controller;