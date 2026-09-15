/**
 * routes/instructor-calendar-verify-legacy.js
 *
 * Keeps ONE legacy path reachable: GET /api/instructor-calendar/verify
 *
 * The instructor-calendar routes were migrated to /api/instructor/calendar/*
 * (see routes/instructor/calendar.js + routes/instructor/index.js), and the old
 * flat file routes/instructor-calendar.js is no longer mounted anywhere.
 *
 * However /api/instructor-calendar/verify specifically must keep working:
 * it's the exact URL already emailed to instructors and relied on by the
 * existing Google Calendar OAuth setup, so it cannot simply be redirected or
 * regenerated as /api/instructor/calendar/verify.
 *
 * This file registers ONLY that one GET route (not the other sub-routes like
 * /connections, /send-verification, etc. — those live solely under
 * /api/instructor/calendar now) and delegates to the exact same controller
 * handler used by the new path, so behavior is identical either way.
 */
const ctrl = require('../controllers/instructor/instructorCalendarController');

module.exports = ctrl.verifyToken;
