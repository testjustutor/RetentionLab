/**
 * routes/super_admin/settings/ai-providers/index.js
 * AI Providers routes
 */

const express = require('express');
const router = express.Router();
const controller = require('../../../controllers/super_admin/settings/ai-providers/aiProvidersController');

// GET /api/super_admin/settings/ai-providers/settings?category=ai
router.get('/settings', controller.getSettings);
// GET /api/super_admin/settings/ai-providers/settings/system?category=ai (used by ai-providers.js)
router.get('/settings/system', controller.getSettings);

// POST /api/super_admin/settings/ai-providers/settings/bulk
router.post('/settings/bulk', controller.saveSettings);

module.exports = router;