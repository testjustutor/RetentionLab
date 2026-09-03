/**
 * routes/super_admin/profile.js
 * Super Admin profile routes — only call controllers, no logic.
 * Mounted by routes/super_admin/index.js at /people/profile (under /api/super_admin).
 */
const express = require('express');
const router = express.Router();
const controller = require('../../controllers/super_admin/profile/profileController');

// Get current logged-in user's profile
//   -> GET /api/super_admin/people/profile/me
router.get('/me', function (req, res) {
  controller.me(req).then(r => res.json(r)).catch(e => res.status(500).json({ error: e.message }));
});

// Change password
//   -> POST /api/super_admin/people/profile/change-password
router.post('/change-password', function (req, res) {
  controller.changePassword(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r)).catch(e => res.status(500).json({ error: e.message }));
});

// Update profile (own fields)
//   -> PUT /api/super_admin/people/profile/:id
router.put('/:id', function (req, res) {
  controller.update(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r)).catch(e => res.status(500).json({ error: e.message }));
});

module.exports = router;
