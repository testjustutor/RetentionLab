/**
 * routes/instructor/microsoft-calendar.js
 * Thin route layer for instructor Microsoft Calendar verification +
 * connections. Mirrors routes/instructor/calendar.js (the Google version)
 * route-for-route, mounted by routes/instructor/index.js at
 * /microsoft-calendar (under /api/instructor).
 *
 * This is a brand-new Azure AD app registration's redirect_uri (there is no
 * legacy path constraint the way there is for Google's /api/calendar/callback),
 * so this file owns both /verify and /callback directly instead of needing
 * separate *-legacy.js shims.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const ctrl = require('../../controllers/instructor/instructorMicrosoftCalendarController');

function handle(fn) {
  return (req, res) => fn(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r));
}

// Protected routes (require login)
router.post('/connections', requireAuth, handle(ctrl.listConnections));
router.post('/send-verification', requireAuth, handle(ctrl.sendVerification));
router.post('/disconnect', requireAuth, handle(ctrl.disconnect));
router.get('/status/:emailOrUserId', requireAuth, handle(ctrl.getStatus));

// Sync Microsoft calendar meetings to local database
router.post('/sync', requireAuth, handle(ctrl.syncCalendar));

// Public route - instructor opens this link from email (no auth required)
router.get('/verify', ctrl.verifyToken);

// Public route - instructor self-service calendar integration by registered email
router.post('/self-request', ctrl.selfRequest);

// Callback after Microsoft OAuth (no auth required - Microsoft redirects here)
router.get('/callback', ctrl.handleCallback);

module.exports = router;
