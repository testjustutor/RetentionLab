/**
 * routes/instructor-calendar.js
 * Thin route layer for instructor Google Calendar verification + connections.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/calendar/instructorCalendarController');
const { syncGoogleCalendar } = require('../services/calendarSyncService');

function handle(fn) {
  return (req, res) => fn(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r));
}

// Protected routes (require admin login)
router.post('/connections', requireAuth, handle(ctrl.listConnections));
router.post('/send-verification', requireAuth, handle(ctrl.sendVerification));
router.post('/disconnect', requireAuth, handle(ctrl.disconnect));
router.get('/status/:email', requireAuth, handle(ctrl.getStatus));

// Sync calendar meetings to local database
router.post('/sync', requireAuth, handle(ctrl.syncCalendar));

// Public route - instructor opens this link from email (no auth required)
router.get('/verify', ctrl.verifyToken);

// Public route - instructor self-service calendar integration by registered email
router.post('/self-request', ctrl.selfRequest);

// Callback after Google OAuth (no auth required - Google redirects here)
router.get('/callback', ctrl.handleCallback);

module.exports = router;