/**
 * root/routes/instructor-dashboard.js
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const instructorDashboardController = require('../controllers/instructorDashboardController');

router.use(requireAuth);

router.get('/stats', instructorDashboardController.getDashboardStats);
router.get('/recent-meetings', instructorDashboardController.getRecentMeetings);
router.get('/score-trend', instructorDashboardController.getScoreTrend);
router.get('/evaluation-breakdown', instructorDashboardController.getEvaluationBreakdown);

module.exports = router;
