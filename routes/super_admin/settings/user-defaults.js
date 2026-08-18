/**
 * routes/super_admin/settings/user-defaults.js
 * User Defaults settings routes — only call controllers, no logic.
 * Mounted by routes/super_admin/index.js at /settings/user-defaults (under /api/super_admin).
 */
const express = require('express');
const router = express.Router();
const controller = require('../../../controllers/super_admin/settings/settingsController');

// Get user-defaults settings (category filter)
//   -> POST /api/super_admin/settings/user-defaults/system/filter
router.post('/system/filter', controller.getSystemSettingsByFilter);

// Bulk update user-defaults settings
//   -> POST /api/super_admin/settings/user-defaults/system/bulk
router.post('/system/bulk', controller.bulkUpdateSystemSettings);

module.exports = router;
