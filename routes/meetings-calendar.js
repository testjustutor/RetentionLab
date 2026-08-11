/**
 * root/routes/meetings-calendar.js
 * Thin route layer for the Admin > Meetings > Calendar page.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/calendar/instructorCalendarController');

function handle(fn) {
  return (req, res) => fn(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r));
}

// GET /api/admin/meetings/calendar/calendar-providers - active calendar providers
router.get('/calendar-providers', requireAuth, handle(ctrl.listProviders));

// POST /api/admin/meetings/calendar/calendar-connections - calendar connections
router.post('/calendar-connections', requireAuth, handle(ctrl.listConnections));

// POST /api/admin/meetings/calendar/send-verification - send verification email to instructor
router.post('/send-verification', requireAuth, handle(ctrl.sendVerification));

// POST /api/admin/meetings/calendar/sync-user - sync calendar for a single user
router.post('/sync-user', requireAuth, handle(ctrl.syncUserCalendar));

module.exports = router;
