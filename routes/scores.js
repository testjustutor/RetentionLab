/**
 * root/routes/scores.js
 * Scoring endpoints for meeting and session-level indicator assessments
 * Uses MeetingSessionScoresModel (Node.js data layer for SQLite)
 */
const express = require('express');
const router = express.Router();
const RubricModel = require('../models/RubricModel');
const MeetingSessionScoresModel = require('../models/MeetingSessionScoresModel');
const { requireAuth, requireRole } = require('../middleware/auth');

// ─── Meeting-Level Scoring Endpoints ───────────────────────────────────────

// Bulk save meeting-level scores (used by admin / reviewer UIs)
router.post('/bulk', requireAuth, requireRole('reviewer','admin','super_admin'), async (req, res) => {
  try {
    const { meetingId, scores } = req.body;
    if (!meetingId || !Array.isArray(scores)) {
      return res.status(400).json({ error: 'meetingId and scores[] required' });
    }
    await RubricModel.saveMeetingScores(meetingId, scores);
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Session-Level Scoring Endpoints ───────────────────────────────────────

/**
 * POST /api/scores/session
 * Upsert a granular session-level indicator score
 * 
 * Body: {
 *   meeting_id: string (required),
 *   session_id: number (required),
 *   indicator_id: string (required),
 *   score: number (0-100, optional, default 0),
 *   comment: string (optional)
 * }
 */
router.post('/session', requireAuth, requireRole('reviewer','admin','super_admin'), async (req, res) => {
  try {
    const { meeting_id, session_id, indicator_id, score, comment } = req.body;
    
    // Validate required fields
    if (!meeting_id || session_id === undefined || !indicator_id) {
      return res.status(400).json({ 
        error: 'meeting_id, session_id, and indicator_id are required' 
      });
    }
    
    // Upsert score (Node.js Model talks to SQLite)
    const result = await MeetingSessionScoresModel.upsertScore({
      meeting_id,
      session_id: parseInt(session_id),
      indicator_id,
      reviewer_id: req.user.id,
      score: score ?? 0,
      comment: comment || null,
      score_type: 'MANUAL'  // API calls are manual scores (vs 'AI' from Python)
    });
    
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/scores/session/:meetingId/:sessionId
 * Retrieve all indicator scores for a specific session with rubric details
 */
router.get('/session/:meetingId/:sessionId', requireAuth, requireRole('super_admin','admin','reviewer'), async (req, res) => {
  try {
    const { meetingId, sessionId } = req.params;
    
    // Fetch scores with rubric details joined
    const rows = await MeetingSessionScoresModel.getScoresBySession(meetingId, parseInt(sessionId));
    
    res.json({
      count: rows.length,
      data: rows,
      success: true
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/scores/session/:meetingId/:sessionId
 * Delete all scores for a specific session
 */
router.delete('/session/:meetingId/:sessionId', requireAuth, requireRole('super_admin','admin'), async (req, res) => {
  try {
    const { meetingId, sessionId } = req.params;
    
    const result = await MeetingSessionScoresModel.clearSessionScoresBySession(meetingId, sessionId);
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/scores/session/meeting/:meetingId
 * Delete all session scores for an entire meeting (⚠️ be careful!)
 */
router.delete('/session/meeting/:meetingId', requireAuth, requireRole('super_admin','admin'), async (req, res) => {
  try {
    const { meetingId } = req.params;
    
    const result = await MeetingSessionScoresModel.clearSessionScoresByMeeting(meetingId);
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/scores
 * List all scores with joined meeting/reviewer details for reports
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { db } = require('../database/db');
    const days = parseInt(req.query.days) || 90;

    const sql = `
      SELECT ms.*, m.title as meeting_title, m.start_time as meeting_date,
             u.first_name || ' ' || u.last_name as reviewer_name,
             u.id as reviewer_id
      FROM meeting_scores ms
      LEFT JOIN meetings m ON m.meeting_id = ms.meeting_id
      LEFT JOIN users u ON u.id = ms.reviewer_id
      WHERE ms.scored_at >= datetime('now', '-' || ? || ' days')
      ORDER BY ms.scored_at DESC
      LIMIT 200
    `;

    const scores = await new Promise((resolve, reject) => {
      db.all(sql, [days], (err, rows) => err ? reject(err) : resolve(rows || []));
    });

    res.json({ scores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
