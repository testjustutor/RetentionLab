/**
 * root/routes/reviewers.js
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const reviewersController = require('../controllers/reviewers/reviewersController');

router.post('/assign', requireAuth, requireRole('super_admin','admin'), reviewersController.assign);
router.get('/meeting/:meetingId', requireAuth, requireRole('super_admin','admin','reviewer'), reviewersController.getForMeeting);
router.put('/:id/status', requireAuth, requireRole('super_admin','admin','reviewer'), reviewersController.updateStatus);
router.delete('/:id', requireAuth, requireRole('super_admin','admin'), reviewersController.remove);
router.post('/score', requireAuth, requireRole('reviewer','admin','super_admin'), reviewersController.scoreUpsert);
router.get('/scores/meeting/:meetingId', requireAuth, requireRole('super_admin','admin','reviewer'), reviewersController.getScores);

module.exports = router;