/**
 * routes/reviews.js
 * Thin route layer for the meeting review queue.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/reviews/reviewController');

function handle(fn) {
  return (req, res) => fn(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r));
}

router.get('/queue', requireAuth, handle(ctrl.getQueue));
router.put('/:id/status', requireAuth, handle(ctrl.updateStatus));
router.get('/reviewers', requireAuth, handle(ctrl.getReviewers));
router.get('/instructors', requireAuth, handle(ctrl.getInstructors));
router.get('/meetings/:instructorId', requireAuth, handle(ctrl.getMeetingsByInstructor));
router.post('/assign-bulk', requireAuth, handle(ctrl.assignBulk));
router.post('/assign', requireAuth, handle(ctrl.assignReviewer));

module.exports = router;