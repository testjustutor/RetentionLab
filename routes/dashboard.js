/**
 * root/routes/dashboard.js
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const dashboardController = require('../controllers/dashboard/dashboardController');

router.get('/', requireAuth, dashboardController.getDashboard);
router.get('/overview', requireAuth, dashboardController.getDashboardOverview);
router.get('/super_admin', requireAuth, dashboardController.getSuperAdmin);
router.get('/super-admin/stats', requireAuth, requireRole('super_admin'), dashboardController.getSuperAdminStats);

module.exports = router;