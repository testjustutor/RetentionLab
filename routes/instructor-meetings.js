/**
 * root/routes/instructor-meetings.js
 * Instructor-scoped meetings endpoints.
 * All endpoints filter by req.user.email from the auth session.
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/instructorMeetingsController');

const allowedRoles = ['solo_instructor', 'instructor', 'reviewer', 'admin', 'super_admin'];

router.use(requireAuth, requireRole(...allowedRoles));

router.get('/upcoming',  (req, res) => wrap(ctrl.getUpcoming,  req, res));
router.get('/live',      (req, res) => wrap(ctrl.getLive,      req, res));
router.get('/completed', (req, res) => wrap(ctrl.getCompleted, req, res));
router.get('/stats',     (req, res) => wrap(ctrl.getStats,     req, res));

function wrap(fn, req, res) {
  Promise.resolve(fn(req)).then(result => {
    const status = result.statusCode || 500;
    if (!result.success) return res.status(status).json(result);
    res.json(result);
  }).catch(e => {
    res.status(500).json({ success: false, error: e.message });
  });
}

module.exports = router;
