/**
 * routes/super_admin/settings/ai-providers/index.js
 * AI Providers routes
 */

const express = require('express');
const router = express.Router();
const controller = require('../../../controllers/super_admin/settings/ai-providers/aiProvidersController');

// POST /api/super_admin/settings/ai-providers/settings   (body: { category })
router.post('/settings', controller.getSettings);
// POST /api/super_admin/settings/ai-providers/settings/system   (body: { category }, used by ai-providers.js)
router.post('/settings/system', controller.getSettings);

// POST /api/super_admin/settings/ai-providers/settings/bulk
router.post('/settings/bulk', controller.saveSettings);

module.exports = router;