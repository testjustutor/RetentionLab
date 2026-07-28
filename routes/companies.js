/**
 * root/routes/companies.js
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const companiesController = require('../controllers/companies/companiesController');

router.get('/', requireAuth, requireRole('super_admin'), companiesController.list);

module.exports = router;
