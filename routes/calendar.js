/**
 * root/routes/calendar.js
 */
const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { verifyCalendarLink } = require('../utils/calendarLinkToken');
const calendarController = require('../controllers/calendar/calendarController');

// ---------------------- MULTI USERS ----------------------
router.get('/multi/users/stats', calendarController.getUserStats);
router.get('/multi/users', calendarController.listUsers);
router.post('/multi/users/disconnect', calendarController.disconnectUser);

// ---------------------- MULTI AUTH ----------------------
router.post('/multi/auth', calendarController.auth);
router.get('/multi/verify', calendarController.verify);
router.post('/multi/callback', calendarController.postCallback);

// ---------------------- LINK TOKEN ----------------------
router.post('/multi/link-token', async (req, res) => {
  try {
    const { email, userId } = req.body;
    if (!email) return res.status(400).json({ status: 'error', message: 'email required' });
    const { signCalendarLink } = require('../utils/calendarLinkToken');
    const token = signCalendarLink({ email, userId: userId || null });
    res.json({ status: 'success', token });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/resolve-user', async (req, res) => {
  try {
    let { token } = req.query;
    if (!token && req.cookies && req.cookies.rl_calendar_token) {
      token = req.cookies.rl_calendar_token;
    }
    if (!token) return res.status(400).json({ status: 'error', message: 'token required' });
    const payload = verifyCalendarLink(token);
    if (!payload) return res.status(400).json({ status: 'error', message: 'invalid token' });
    res.json({ status: 'success', email: payload.email, userId: payload.userId || null });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/open', async (req, res) => {
  try {
    const { token, target } = req.body || {};
    if (!token) return res.status(400).send('Missing token');
    const payload = verifyCalendarLink(token);
    if (!payload || !payload.email) return res.status(400).send('Invalid or expired token');
    res.cookie('rl_calendar_token', token, { httpOnly: true, maxAge: 5 * 60 * 1000, sameSite: 'lax' });
    const redirectTo = target === 'archives' ? '/admin/archives.html' : '/admin/calendar-events.html';
    return res.redirect(302, redirectTo);
  } catch (err) {
    logger.error('Route(calendar): open token error', err);
    return res.status(500).send('Server error');
  }
});

// Google OAuth callback (GET - redirected from Google) - Added to controller
router.get('/callback', calendarController.callback);

// ---------------------- EVENTS ----------------------
router.post('/multi/events', calendarController.getEvents);

module.exports = router;