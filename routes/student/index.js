/**
 * routes/student/index.js
 * MAIN Student route file — consolidates the Student API routes, only CALLS controllers.
 * No business logic, no model/db usage, no inline responses here.
 * Mounted in routes/registry.js at /api/student (handler 'student').
 * Mirrors routes/super_admin/index.js.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');

const student = require('../../controllers/student/studentController');
const profile = require('./profile');

// Thin adapter for controllers that resolve to a result object (no logic here).
function handle(fn) {
  return (req, res) => fn(req).then(r => {
    const status = r.statusCode || (r.success === false ? 400 : 200);
    res.status(status).json(r);
  });
}

// ── Scaffold / Student core ─────────────────────────────────────────────
router.get('/ping', requireAuth, handle(student.ping));

// ── Profile ───────────────────────────────────────────────────────────
router.use('/profile', requireAuth, profile);

module.exports = router;
