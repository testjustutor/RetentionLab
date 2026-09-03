/**
 * routes/super_admin/settings/platforms/index.js
 * Super Admin Platforms routes — only call controller, no logic.
 * Mounted by routes/super_admin/index.js at /settings/platforms (under /api/super_admin).
 */
const express = require('express');
const router = express.Router();
const controller = require('../../../controllers/super_admin/settings/platforms/platformsController');

// Get platform settings
//   -> GET /api/super_admin/settings/platforms/settings?category=platforms
router.get('/settings', controller.getSettings);

// Save platform settings (bulk update)
//   -> POST /api/super_admin/settings/platforms/settings/bulk
router.post('/settings/bulk', controller.saveSettings);

module.exports = router;
