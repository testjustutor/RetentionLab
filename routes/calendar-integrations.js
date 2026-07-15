/**
 * routes/calendar-integrations.js
 * Super admin CRUD for calendar_providers + calendar_credentials
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/calendarIntegrationController');

// Providers
router.get('/providers', requireAuth, requireRole('super_admin'), (req, res) => ctrl.listProviders(req, res));
router.post('/providers', requireAuth, requireRole('super_admin'), (req, res) => ctrl.createProvider(req, res));
router.put('/providers/:id', requireAuth, requireRole('super_admin'), (req, res) => ctrl.updateProvider(req, res));
router.delete('/providers/:id', requireAuth, requireRole('super_admin'), (req, res) => ctrl.deleteProvider(req, res));

// Credentials
router.get('/credentials', requireAuth, requireRole('super_admin'), (req, res) => ctrl.listCredentialsByProvider(req, res));
router.post('/credentials', requireAuth, requireRole('super_admin'), (req, res) => ctrl.createCredential(req, res));
router.put('/credentials/:id', requireAuth, requireRole('super_admin'), (req, res) => ctrl.updateCredential(req, res));
router.delete('/credentials/:id', requireAuth, requireRole('super_admin'), (req, res) => ctrl.deleteCredential(req, res));

module.exports = router;

