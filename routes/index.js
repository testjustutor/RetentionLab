/**
 * root/routes/index.js
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

// Serve page routes
router.use('/', require('./pages'));

// Top-level stats and health
router.get('/storage/stats', async (req, res) => {
  try {
    const storageDir = './storage';
    let totalSize = 0;
    
    if (fs.existsSync(storageDir)) {
      function scanDir(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isFile()) {
            totalSize += stat.size;
          } else if (stat.isDirectory()) {
            scanDir(fullPath);
          }
        }
      }
      scanDir(storageDir);
    }

    const totalKB = Math.round(totalSize / 1024);
    const totalMB = (totalKB / 1024).toFixed(1);
    res.json({
      total: totalMB > 1 ? `${totalMB} MB` : `${totalKB} KB`,
      bytes: totalSize
    });
  } catch (err) {
    logger.error('(Index Route): Storage stats error:', err);
    res.status(500).json({ total: '0 KB' });
  }
});

router.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// Auth callback (Google)
router.get('/auth/google/callback', async (req, res) => {
  try {
    const { code, error, state: account = 'default' } = req.query;
    
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const dynamicBaseUrl = `${protocol}://${host}`;

    if (error) {
      logger.error('(Index Route): Google OAuth error:', error);
      return res.status(400).send(`<h2>OAuth Error: ${error}</h2>`);
    }

    const response = await fetch(`${dynamicBaseUrl}/api/calendar/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, account })
    });

    const result = await response.json();
    
    if (response.ok) {
      res.send(`
        <!DOCTYPE html>
        <html><head><title>Success</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2 style="color: green;">✅ Google Calendar Authorized!</h2>
          <p>Account: <strong>${account}</strong></p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body></html>
      `);
    } else {
      res.status(500).send(`<h2>❌ Authorization Failed</h2><p>${result.message || 'Unknown error'}</p>`);
    }
  } catch (err) {
    logger.error('(Index Route): Callback error:', err);
    res.status(500).send(`<h2>Server Error</h2><p>${err.message}</p>`);
  }
});

// API Routes
router.use('/api/bot', require('./bot'));
router.use('/api/calendar', require('./calendar'));
router.use('/api/meetings', require('./meetings'));
router.use('/api/db', require('./db-admin'));

// Professional admin routes
router.use('/api/roles', require('./roles'));
router.use('/api/users', require('./users'));
router.use('/api/reviewers', require('./reviewers'));
router.use('/api/settings', require('./settings'));
router.use('/api/scores', require('./scores'));
router.use('/api/auth', require('./auth'));
router.use('/api/dashboard', require('./dashboard'));

// Sidebar navigation API
router.get('/api/sidebar/menu', require('./sidebar-api'));

// Header config API
router.use('/api/header-config', require('./header-config'));

router.use('/api/transcripts', require('./transcripts'));
router.use('/api/audit', require('./audit'));
router.use('/api/assets', require('./assets'));
router.use('/api/archives', require('./archives'));

module.exports = router;
