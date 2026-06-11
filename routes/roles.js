/**
 * root/routes/roles.js
 */
const express = require('express');
const router = express.Router();
const RolesModel = require('../models/RolesModel');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const rows = await RolesModel.getAllRoles();
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:name', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const row = await RolesModel.getRoleByName(req.params.name);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const { role_name, description } = req.body;
    const created = await RolesModel.createRole(role_name, description);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
