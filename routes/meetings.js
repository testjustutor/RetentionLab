/**
 * root/routes/meetings.js
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const meetingsController = require('../controllers/meetings/meetingsController');

router.get('/', meetingsController.list);
router.get('/list', requireAuth, meetingsController.listFromDb);
router.get('/:meetingId', meetingsController.getById);
router.post('/join', meetingsController.join);
router.post('/:meetingId/leave', meetingsController.leave);
router.get('/:meetingId/status', meetingsController.getStatus);

module.exports = router;