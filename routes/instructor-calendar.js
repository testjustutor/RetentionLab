/**
 * routes/instructor-calendar.js
 * Thin route layer for instructor Google Calendar verification + connections.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/instructorCalendarController');

function handle(fn) {
  return (req, res) => fn(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r));
}

// Protected routes (require admin login)
router.get('/connections', requireAuth, handle(ctrl.listConnections));
router.post('/send-verification', requireAuth, handle(ctrl.sendVerification));
router.post('/disconnect', requireAuth, handle(ctrl.disconnect));
router.get('/status/:email', requireAuth, handle(ctrl.getStatus));

// Public route - instructor opens this link from email (no auth required)
router.get('/verify', ctrl.verifyToken);

// Callback after Google OAuth (no auth required - Google redirects here)
router.get('/callback', ctrl.handleCallback);

module.exports = router;