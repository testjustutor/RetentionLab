/**
 * root/routes/reviewers.js
 */
const express = require('express');
const router = express.Router();
const MeetingReviewersModel = require('../models/reviewers/MeetingReviewersModel');
const MeetingScoresModel = require('../models/reviews/MeetingScoresModel');
const { requireAuth, requireRole } = require('../middleware/auth');

router.post('/assign', requireAuth, requireRole('super_admin','admin'), async (req, res) => {
  try {
    const { meetingId, reviewerId } = req.body;
    const r = await MeetingReviewersModel.assignReviewer(meetingId, reviewerId, req.user.id);
    res.status(201).json(r);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/meeting/:meetingId', requireAuth, requireRole('super_admin','admin','reviewer'), async (req, res) => {
  try {
    const rows = await MeetingReviewersModel.getReviewersForMeeting(req.params.meetingId);
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/status', requireAuth, requireRole('super_admin','admin','reviewer'), async (req, res) => {
  try {
    const { status, comments } = req.body;
    const result = await MeetingReviewersModel.setReviewStatus(req.params.id, status, comments);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, requireRole('super_admin','admin'), async (req, res) => {
  try {
    const result = await MeetingReviewersModel.removeReviewer(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Meeting scores endpoints (reviewer actions)
router.post('/score', requireAuth, requireRole('reviewer','admin','super_admin'), async (req, res) => {
  try {
    const { meeting_id, indicator_id, score, comment } = req.body;
    const reviewer_id = req.user.id;
    const result = await MeetingScoresModel.upsertScore({ meeting_id, indicator_id, reviewer_id, score, comment, score_type: 'MANUAL' });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/scores/meeting/:meetingId', requireAuth, requireRole('super_admin','admin','reviewer'), async (req, res) => {
  try {
    const rows = await MeetingScoresModel.getScoresByMeeting(req.params.meetingId);
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
