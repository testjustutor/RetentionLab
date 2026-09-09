/**
 * routes/reviewer/reviews.js
 * Thin route layer for the reviewer review queue page.
 * Moved from routes/reviewer-reviews.js (was mounted at /api/reviewer-reviews);
 * now mounted by routes/reviewer/index.js at /reviews (under /api/reviewer).
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const ctrl = require('../../controllers/reviewer/reviewerReviewsController');

function handle(fn) {
  return (req, res) => fn(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r));
}

router.get('/instructors', requireAuth, handle(ctrl.getInstructors));
router.get('/instructor-sessions', requireAuth, handle(ctrl.getInstructorSessions));
router.get('/filtered-reviews', requireAuth, handle(ctrl.getFilteredReviews));
router.get('/analytics', requireAuth, handle(ctrl.getAnalytics));
router.get('/stats', requireAuth, handle(ctrl.getStats));
router.put('/:meetingId/start', requireAuth, handle(ctrl.startReview));
router.put('/:meetingId/complete', requireAuth, handle(ctrl.completeReview));

module.exports = router;
