/**
 * routes/reviewer/dashboard.js
 * Dashboard API for reviewers.
 * Moved from routes/reviewer-dashboard.js (was mounted at /api/reviewer-dashboard);
 * now mounted by routes/reviewer/index.js at /dashboard (under /api/reviewer).
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const reviewerDashboardController = require('../../controllers/reviewer/reviewerDashboardController');

router.get('/stats', requireAuth, requireRole('reviewer'), reviewerDashboardController.getStats);
router.get('/recent-assignments', requireAuth, requireRole('reviewer'), reviewerDashboardController.getRecentAssignments);
router.get('/overdue', requireAuth, requireRole('reviewer'), reviewerDashboardController.getOverdue);
router.get('/performance', requireAuth, requireRole('reviewer'), reviewerDashboardController.getPerformance);

module.exports = router;
