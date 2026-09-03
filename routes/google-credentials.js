/**
 * routes/google-credentials.js
 * CRUD routes for managing Google OAuth credentials (Super Admin only)
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const googleCredentialsController = require('../controllers/google/googleCredentialsController');

router.get('/', requireAuth, requireRole('super_admin'), googleCredentialsController.list);
router.post('/', requireAuth, requireRole('super_admin'), googleCredentialsController.save);
router.put('/:id', requireAuth, requireRole('super_admin'), googleCredentialsController.update);
router.delete('/:id', requireAuth, requireRole('super_admin'), googleCredentialsController.delete);

module.exports = router;