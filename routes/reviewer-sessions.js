/**
 * routes/reviewer-sessions.js
 * Thin route layer for reviewer sessions page.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/reviewerSessionsController');

function handle(fn) {
  return (req, res) => fn(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r));
}

router.get('/instructors', requireAuth, handle(ctrl.getInstructors));
router.get('/instructor-sessions', requireAuth, handle(ctrl.getInstructorSessions));
router.get('/:meetingId/details', requireAuth, handle(ctrl.getSessionDetails));

module.exports = router;