/**
 * routes/reviewer/evaluations.js
 * Thin route layer for storing/reading tutor-evaluation review-calculation values
 * (reviewer scoring UI).
 * Moved from routes/reviewer-evaluations.js (was mounted at /api/tutor-evaluation);
 * now mounted by routes/reviewer/index.js at /evaluations (under /api/reviewer).
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const controller = require('../../controllers/reviewer/tutorEvaluationController');

// Save a tutor-evaluation calculation summary (parent + per-category rows)
router.post('/summary', requireAuth, requireRole('reviewer', 'admin', 'super_admin'), controller.saveReview);

// Scoring UI support (must precede /summary/:sessionId so 'sessions'/'rubric' are not parsed as :sessionId)
router.get('/sessions', requireAuth, requireRole('reviewer', 'admin', 'super_admin'), controller.getSessions);
router.get('/rubric', requireAuth, requireRole('reviewer', 'admin', 'super_admin'), controller.getRubric);

// Fetch a saved summary for a session (optional ?reviewer_id=&flow=)
router.get('/summary/:sessionId', requireAuth, requireRole('reviewer', 'admin', 'super_admin'), controller.getReview);

module.exports = router;
