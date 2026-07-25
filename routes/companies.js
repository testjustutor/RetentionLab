/**
 * root/routes/companies.js
 */
const express = require('express');
const router = express.Router();
const CompaniesModel = require('../models/companies/CompaniesModel');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const rows = await CompaniesModel.getAllCompanies();
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
