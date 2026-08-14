/**
 * routes/calendar-integrations.js
 * Read-only integration status for admin settings page.
 * All CRUD for providers has been removed for security.
 * OAuth credentials must be configured via .env file only.
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/calendar/calendarIntegrationController');

// Read-only: Get integration status for admin settings page
router.get('/integration-status', requireAuth, requireRole('admin'), (req, res) => ctrl.getIntegrationStatus(req, res));

// Dynamic: Get connected accounts (users) for a provider
// GET /api/calendar-integrations/connections?provider_id=1&status=all
router.get('/connections', requireAuth, requireRole('admin'), (req, res) => ctrl.getConnectedAccounts(req, res));

// Manage: Disconnect a connected account
// POST /api/calendar-integrations/disconnect  body: { connection_id }
router.post('/disconnect', requireAuth, requireRole('admin'), (req, res) => ctrl.disconnectConnection(req, res));

module.exports = router;