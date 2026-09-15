/**
 * routes/instructor/index.js
 * MAIN Instructor route file — consolidates every Instructor API route, only CALLS
 * sub-routers/controllers. No business logic here.
 * Mounted in routes/registry.js at /api/instructor (handler 'instructor').
 *
 * Replaces the old flat mounts:
 *   /api/instructor-dashboard        -> /api/instructor/dashboard
 *   /api/instructor-calendar         -> /api/instructor/calendar
 *   /api/admin/instructor-meetings   -> /api/instructor/meetings
 *
 * NOTE: this does NOT change the Google OAuth redirect URI. Google's console
 * is registered against the shared /api/calendar/callback endpoint (routes/registry.js
 * -> handler 'index', action 'calendarCallback'), which is untouched by this migration.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');

router.use('/dashboard', require('./dashboard'));
router.use('/calendar', require('./calendar'));
router.use('/meetings', require('./meetings'));
router.use('/profile', requireAuth, require('./profile'));

module.exports = router;
