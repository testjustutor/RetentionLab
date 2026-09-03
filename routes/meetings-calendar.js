/**
 * root/routes/meetings-calendar.js
 * Thin route layer for the Admin > Meetings > Calendar page.
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/calendar/instructorCalendarController');

function handle(fn) {
  return (req, res) => fn(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r));
}

// Admin-only calendar operations (must be an authenticated admin/super_admin)
const requireAdmin = requireRole('admin', 'super_admin');

// GET /api/admin/meetings/calendar/calendar-providers - active calendar providers
router.get('/calendar-providers', requireAuth, requireAdmin, handle(ctrl.listProviders));

// POST /api/admin/meetings/calendar/calendar-connections - calendar connections
router.post('/calendar-connections', requireAuth, requireAdmin, handle(ctrl.listConnections));

// POST /api/admin/meetings/calendar/send-verification - send verification email to instructor
router.post('/send-verification', requireAuth, requireAdmin, handle(ctrl.sendVerification));

// POST /api/admin/meetings/calendar/sync-user - sync calendar for a single user
router.post('/sync-user', requireAuth, requireAdmin, handle(ctrl.syncUserCalendar));

module.exports = router;
