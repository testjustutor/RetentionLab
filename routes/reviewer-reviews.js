/**
 * routes/reviewer-reviews.js
 * Thin route layer for the reviewer review queue page.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/reviewerReviewsController');

function handle(fn) {
  return (req, res) => fn(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r));
}

router.get('/instructors', requireAuth, handle(ctrl.getInstructors));
router.get('/instructor-sessions', requireAuth, handle(ctrl.getInstructorSessions));
router.get('/stats', requireAuth, handle(ctrl.getStats));
router.put('/:meetingId/start', requireAuth, handle(ctrl.startReview));
router.put('/:meetingId/complete', requireAuth, handle(ctrl.completeReview));

module.exports = router;