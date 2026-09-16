/**
 * routes/microsoft-credentials.js
 * CRUD routes for managing Microsoft OAuth credentials (Super Admin only).
 * Mirrors routes/google-credentials.js exactly.
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const microsoftCredentialsController = require('../controllers/microsoft/microsoftCredentialsController');

router.get('/', requireAuth, requireRole('super_admin'), microsoftCredentialsController.list);
router.post('/', requireAuth, requireRole('super_admin'), microsoftCredentialsController.save);
router.put('/:id', requireAuth, requireRole('super_admin'), microsoftCredentialsController.update);
router.delete('/:id', requireAuth, requireRole('super_admin'), microsoftCredentialsController.delete);

module.exports = router;
