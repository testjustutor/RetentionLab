/**
 * routes/instructor/profile.js
 * Instructor profile routes — only call controllers, no logic.
 * Mounted by routes/instructor/index.js at /profile (under /api/instructor).
 * Mirrors routes/reviewer/profile.js / routes/student/profile.js.
 */
const express = require('express');
const router = express.Router();
const controller = require('../../controllers/instructor/profile/profileController');

// Get current logged-in user's profile
//   -> GET /api/instructor/profile/me
router.get('/me', function (req, res) {
  controller.me(req).then(r => res.json(r)).catch(e => res.status(500).json({ error: e.message }));
});

// Change password
//   -> POST /api/instructor/profile/change-password
router.post('/change-password', function (req, res) {
  controller.changePassword(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r)).catch(e => res.status(500).json({ error: e.message }));
});

// Update profile (own fields)
//   -> PUT /api/instructor/profile/:id
router.put('/:id', function (req, res) {
  controller.update(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r)).catch(e => res.status(500).json({ error: e.message }));
});

module.exports = router;
