/**
 * routes/instructor-calendar-callback-legacy.js
 *
 * Keeps ONE legacy path reachable: GET /api/instructor-calendar/callback
 *
 * The instructor-calendar routes were migrated to /api/instructor/calendar/*
 * (see routes/instructor/calendar.js + routes/instructor/index.js), and the old
 * flat file routes/instructor-calendar.js is no longer mounted anywhere.
 *
 * However /api/instructor-calendar/callback specifically must keep working:
 * instructorCalendarController.verifyToken() hardcodes this exact path when it
 * builds instructorCallbackUrl and sends it to Google as redirect_uri (see
 * "GET /api/instructor-calendar/verify" above), and it's also registered as an
 * authorized redirect URI in the Google Cloud OAuth console. Google will only
 * redirect back to a URI that matches one already used in the auth request /
 * registered in the console, so this path cannot be renamed or removed.
 *
 * This file registers ONLY that one GET route (not the other sub-routes) and
 * delegates to the exact same controller handler used by the new
 * /api/instructor/calendar/callback route, so behavior is identical either way.
 */
const ctrl = require('../controllers/instructor/instructorCalendarController');

module.exports = ctrl.handleCallback;
