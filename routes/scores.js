/**
 * root/routes/scores.js
 * Scoring endpoints for meeting and session-level indicator assessments
 * Uses MeetingSessionScoresModel (Node.js data layer for MySQL)
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const scoresController = require('../controllers/scores/scoresController');

// ─── Meeting-Level Scoring Endpoints ───────────────────────────────────────
router.post('/bulk', requireAuth, requireRole('reviewer','admin','super_admin'), scoresController.bulkSave);

// ─── Session-Level Scoring Endpoints ───────────────────────────────────────
router.post('/session', requireAuth, requireRole('reviewer','admin','super_admin'), scoresController.sessionUpsert);
router.get('/session/:meetingId/:sessionId', requireAuth, requireRole('super_admin','admin','reviewer'), scoresController.sessionGet);
router.delete('/session/:meetingId/:sessionId', requireAuth, requireRole('super_admin','admin'), scoresController.sessionDelete);
router.delete('/session/meeting/:meetingId', requireAuth, requireRole('super_admin','admin'), scoresController.meetingDelete);

/**
 * GET /api/scores
 * List all scores with joined meeting/reviewer details for reports
 */
router.get('/', requireAuth, scoresController.list);

// New endpoints for filtered scores
router.post('/evaluation/instructors', requireAuth, scoresController.getInstructors);
router.get('/sessions/:instructorId', requireAuth, scoresController.getSessionsByInstructor);
router.post('/evaluation/reviewers', requireAuth, scoresController.getReviewers);
router.post('/filtered', requireAuth, scoresController.getFilteredScores);

module.exports = router;
