/**
 * root/routes/configuration.js
 * Configuration pages routes for super admin
 */
const express = require('express');
const router = express.Router();
const path = require('path');

// Configuration pages (super admin only)
router.get('/bot-configuration', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'super_admin', 'configuration', 'bot-configuration.html'));
});

router.get('/ai-providers', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'super_admin', 'configuration', 'ai-providers.html'));
});

router.get('/platforms', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'super_admin', 'configuration', 'platforms.html'));
});

module.exports = router;