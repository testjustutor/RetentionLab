/**
 * root/routes/configuration.js
 * Configuration pages routes for super admin
 */
const express = require('express');
const router = express.Router();
const path = require('path');

// Configuration pages (super admin only)
router.get('/bot-configuration', (req, res) => {
  res.redirect('/super_admin/settings/bot-configuration');
});

router.get('/ai-providers', (req, res) => {
  res.redirect('/super_admin/settings/ai-providers');
});

router.get('/platforms', (req, res) => {
  res.redirect('/super_admin/settings/platforms');
});

module.exports = router;