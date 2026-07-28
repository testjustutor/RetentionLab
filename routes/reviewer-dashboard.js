/**
 * root/routes/reviewer-dashboard.js
 * Dashboard API for reviewers
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const reviewerDashboardController = require('../controllers/reviewer-dashboard/reviewerDashboardController');

router.get('/stats', requireAuth, requireRole('reviewer'), reviewerDashboardController.getStats);
router.get('/recent-assignments', requireAuth, requireRole('reviewer'), reviewerDashboardController.getRecentAssignments);
router.get('/overdue', requireAuth, requireRole('reviewer'), reviewerDashboardController.getOverdue);
router.get('/performance', requireAuth, requireRole('reviewer'), reviewerDashboardController.getPerformance);

module.exports = router;