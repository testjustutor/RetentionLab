/**
 * routes/instructor/dashboard.js
 * Moved from routes/instructor-dashboard.js (was mounted at /api/instructor-dashboard);
 * now mounted by routes/instructor/index.js at /dashboard (under /api/instructor).
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const instructorDashboardController = require('../../controllers/instructor/instructorDashboardController');

router.use(requireAuth);

router.get('/stats', instructorDashboardController.getDashboardStats);
router.get('/recent-meetings', instructorDashboardController.getRecentMeetings);
router.get('/score-trend', instructorDashboardController.getScoreTrend);
router.get('/evaluation-breakdown', instructorDashboardController.getEvaluationBreakdown);

module.exports = router;
