/**
 * routes/reviewer/sessions.js
 * Thin route layer for the reviewer sessions page.
 * Moved from routes/reviewer-sessions.js (was mounted at /api/reviewer-sessions);
 * now mounted by routes/reviewer/index.js at /sessions (under /api/reviewer).
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const ctrl = require('../../controllers/reviewer/reviewerSessionsController');

function handle(fn) {
  return (req, res) => fn(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r));
}

router.get('/instructors', requireAuth, handle(ctrl.getInstructors));
router.get('/instructor-sessions', requireAuth, handle(ctrl.getInstructorSessions));
router.get('/filter-options', requireAuth, handle(ctrl.getFilterOptions));
router.get('/filtered-sessions', requireAuth, handle(ctrl.getFilteredSessions));
router.get('/evaluations', requireAuth, handle(ctrl.getEvaluations));
router.get('/:meetingId/details', requireAuth, handle(ctrl.getSessionDetails));

module.exports = router;
