/**
 * routes/super_admin/settings/calendar-integrations.js
 * Super Admin Calendar Integrations routes — only call controller, no logic.
 * Mounted by routes/super_admin/index.js at /settings/calendar-integrations
 * (under /api/super_admin).
 */
const express = require('express');
const router = express.Router();
const controller = require('../../../controllers/super_admin/settings/calendar-integrations/calendarIntegrationsController');

// Get calendar integration provider toggles
//   -> GET /api/super_admin/settings/calendar-integrations/settings
router.get('/settings', controller.getSettings);

// Toggle a single provider on/off
//   -> POST /api/super_admin/settings/calendar-integrations/settings/toggle
router.post('/settings/toggle', controller.toggleProvider);

module.exports = router;
