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

// Engagement insights
router.post('/engagement', requireAuth, engagementController.getEngagementInsights);

// Action items insights
router.post('/actions', requireAuth, actionsController.getActionItems);

// Decisions insights
router.post('/decisions', requireAuth, decisionsController.getDecisions);

// Risks insights
router.post('/risks', requireAuth, risksController.getRisks);

module.exports = router;
