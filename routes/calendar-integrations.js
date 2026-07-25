/**
 * routes/calendar-integrations.js
 * Read-only integration status for admin settings page.
 * All CRUD for providers/credentials has been removed for security.
 * OAuth credentials must be configured via .env file only.
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/calendar/calendarIntegrationController');

// Read-only: Get integration status for admin settings page
router.get('/integration-status', requireAuth, requireRole('admin'), (req, res) => ctrl.getIntegrationStatus(req, res));

module.exports = router;