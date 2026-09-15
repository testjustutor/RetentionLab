/**
 * routes/student/profile.js
 * Student profile routes — only call controllers, no logic.
 * Mounted by routes/student/index.js at /profile (under /api/student).
 * Mirrors routes/super_admin/profile.js.
 */
const express = require('express');
const router = express.Router();
const controller = require('../../controllers/student/profile/profileController');

// Get current logged-in user's profile
//   -> GET /api/student/profile/me
router.get('/me', function (req, res) {
  controller.me(req).then(r => res.json(r)).catch(e => res.status(500).json({ error: e.message }));
});

// Change password
//   -> POST /api/student/profile/change-password
router.post('/change-password', function (req, res) {
  controller.changePassword(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r)).catch(e => res.status(500).json({ error: e.message }));
});

// Update profile (own fields)
//   -> PUT /api/student/profile/:id
router.put('/:id', function (req, res) {
  controller.update(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r)).catch(e => res.status(500).json({ error: e.message }));
});

module.exports = router;
