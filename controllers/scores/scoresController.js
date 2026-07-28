/**
 * controllers/scores/scoresController.js
 * Scores controller
 */
const RubricModel = require('../../models/rubrics/RubricModel');
const MeetingSessionScoresModel = require('../../models/meetings/MeetingSessionScoresModel');

const controller = {
  async bulkSave(req, res) {
    try {
      const { meetingId, scores } = req.body;
      if (!meetingId || !Array.isArray(scores)) {
        return res.status(400).json({ error: 'meetingId and scores[] required' });
      }
      await RubricModel.saveMeetingScores(meetingId, scores);
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
  }
};

module.exports = controller;