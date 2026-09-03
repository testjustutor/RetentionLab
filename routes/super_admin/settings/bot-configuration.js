/**
 * routes/super_admin/settings/bot-configuration/index.js
 * Super Admin "Bot Configuration" routes — only call controllers, no logic.
 * Mounted by routes/super_admin/index.js at /settings/bot-configuration (under /api/super_admin).
 */
const express = require('express');
const router = express.Router();
const controller = require('../../../controllers/super_admin/settings/bot-configuration/botConfigController');

// Get bot settings (category=bot)
//   -> GET /api/super_admin/settings/bot-configuration/settings?category=bot
router.get('/settings', controller.getSettings);

// Save bot settings (bulk update)
//   -> POST /api/super_admin/settings/bot-configuration/settings/bulk
router.post('/settings/bulk', controller.saveSettings);

module.exports = router;
