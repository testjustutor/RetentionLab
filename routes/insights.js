/**
 * Insights routes
 * Provides analytics and insights data
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const engagementController = require('../controllers/insights/engagementController');
const actionsController = require('../controllers/insights/actionsController');
const decisionsController = require('../controllers/insights/decisionsController');
const risksController = require('../controllers/insights/risksController');
const analyticsController = require('../controllers/insights/analyticsController');

// Engagement insights
router.post('/engagement', requireAuth, engagementController.getEngagementInsights);

// Instructor list for insights filters (shared across insights pages)
router.get('/instructors', requireAuth, engagementController.getInstructors);

// Action items insights
router.post('/actions', requireAuth, actionsController.getActionItems);

// Decisions insights
router.post('/decisions', requireAuth, decisionsController.getDecisions);

// Risks insights
router.post('/risks', requireAuth, risksController.getRisks);

// Analytics insights
router.post('/analytics', requireAuth, analyticsController.getAnalytics);

module.exports = router;
