/**
 * routes/meeting-schedule.js
 * Thin route for meeting schedule, live, and completed dashboards.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/meetings/meetingScheduleController');

router.get('/all', requireAuth, (req, res) => ctrl.getAllMeetings(req).then(r => res.status(r.statusCode || 200).json(r)));
router.get('/live', requireAuth, (req, res) => ctrl.getLiveMeetings(req).then(r => res.status(r.statusCode || 200).json(r)));
router.get('/completed', requireAuth, (req, res) => ctrl.getCompletedMeetings(req).then(r => res.status(r.statusCode || 200).json(r)));
router.post('/sync', requireAuth, (req, res) => ctrl.syncMeetings(req).then(r => res.status(r.statusCode || 200).json(r)));

module.exports = router;