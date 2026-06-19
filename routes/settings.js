/**
 * root/routes/settings.js
 */
const express = require('express');
const router = express.Router();
const SystemSettingsModel = require('../models/SystemSettingsModel');
const UserSettingsModel = require('../models/UserSettingsModel');

// System settings (company-level)
router.get('/system/:companyId/:key', async (req, res) => {
  try {
    const row = await SystemSettingsModel.getSetting(req.params.companyId, req.params.key);
    res.json(row || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/system/:companyId', async (req, res) => {
  try {
    const { key, value, type } = req.body;
    const r = await SystemSettingsModel.upsertSetting(req.params.companyId, key, value, type || 'string');
    res.json(r);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Global system settings (company_id = 0 for system-level)
router.get('/global/:key', async (req, res) => {
  try {
    const row = await SystemSettingsModel.getSetting(0, req.params.key);
    res.json(row || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/global', async (req, res) => {
  try {
    const { key, value, type } = req.body;
    const r = await SystemSettingsModel.upsertSetting(0, key, value, type || 'string');
    res.json(r);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User settings
router.get('/user/:userId/:key', async (req, res) => {
  try {
    const row = await UserSettingsModel.getSetting(req.params.userId, req.params.key);
    res.json(row || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/user/:userId', async (req, res) => {
  try {
    const { key, value } = req.body;
    const r = await UserSettingsModel.upsertSetting(req.params.userId, key, value);
    res.json(r);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
