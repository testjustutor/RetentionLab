/**
 * root/routes/scores.js
 */
const express = require('express');
const router = express.Router();
const RubricModel = require('../models/RubricModel');
const { requireAuth, requireRole } = require('../middleware/auth');

// Bulk save scores (used by admin / reviewer UIs)
router.post('/bulk', requireAuth, requireRole('reviewer','admin','super_admin'), async (req, res) => {
  try {
    const { meetingId, scores } = req.body;
    if (!meetingId || !Array.isArray(scores)) return res.status(400).json({ error: 'meetingId and scores[] required' });
    await RubricModel.saveMeetingScores(meetingId, scores);
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
