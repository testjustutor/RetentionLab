/**
 * root/routes/index.js
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');

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

// Intercept /api/calendar/callback for instructor-calendar JWT tokens
// (Google Console only approves /api/calendar/callback, so we intercept here)
router.get('/api/calendar/callback', (req, res, next) => {
  const { state } = req.query;
  if (state && state.startsWith('eyJ')) {
    try {
      const jwt = require('jsonwebtoken');
      const VERIFY_SECRET = process.env.INSTRUCTOR_CALENDAR_SECRET || process.env.JWT_SECRET || 'instructor_cal_secure_key_change_me';
      const payload = jwt.verify(state, VERIFY_SECRET);
      if (payload?.purpose === 'instructor-calendar-verify') {
        const ctrl = require('../controllers/calendar/instructorCalendarController');
        return ctrl.handleCallback(req, res);
      }
    } catch { /* not our JWT, pass through */ }
  }
  next(); // pass to calendar.js for normal handling
});

router.use('/api/bot', require('./bot'));
router.use('/api/monitoring', require('./monitoring'));
router.use('/api/calendar', require('./calendar'));
router.use('/api/meetings', require('./meetings'));
router.use('/api/db', require('./db-admin'));

// Professional admin routes
router.use('/api/companies', require('./companies'));
router.use('/api/roles', require('./roles'));
router.use('/api/users', require('./users'));
router.use('/api/reviewers', require('./reviewers'));
router.use('/api/reviews', require('./reviews'));
router.use('/api/reviewer-dashboard', requireAuth, require('../routes/reviewer-dashboard'));
router.use('/api/reviewer-sessions', requireAuth, require('../routes/reviewer-sessions'));
router.use('/api/reviewer-reviews', requireAuth, require('../routes/reviewer-reviews'));
router.use('/api/settings', require('./settings'));
router.use('/api/scores', require('./scores'));
router.use('/api/auth', require('./auth'));
router.use('/api/dashboard', require('./dashboard'));
router.use('/api/instructor-dashboard', require('./instructor-dashboard'));

// Sidebar navigation API
router.get('/api/sidebar/menu', requireAuth, require('./sidebar-api'));

// Header config API
router.use('/api/header-config', require('./header-config'));

router.use('/api/transcripts', require('./transcripts'));
router.use('/api/audit', require('./audit'));
router.use('/api/audit-reports', require('./audit-reports'));
router.use('/api/assets', require('./assets'));
router.use('/api/archives', require('./archives'));

// Rubric management (super admin)
router.use('/api/rubrics', require('./rubrics'));
router.use('/api/rubric-admin', require('./rubric-admin'));

// Sidebar menu management (super admin)
router.use('/api/sidebar-menu-admin', require('./sidebar-menu-admin'));

// Google OAuth credentials management (super admin) - legacy (kept for backward compatibility)
router.use('/api/google-credentials', require('./google-credentials'));

// Calendar providers + credentials (new schema)
router.use('/api/calendar-integrations', require('./calendar-integrations'));

// Menu management
router.use('/api/menu', require('./menu'));

// Configuration pages (super admin)
router.use('/super_admin/configuration', require('./configuration'));

// Tutoring/session-quality endpoints
router.use('/api/meeting-schedule', require('./meeting-schedule'));
router.use('/api/recordings', require('./recordings-dashboard'));
router.use('/api/instructor-calendar', require('./instructor-calendar'));
router.use('/api/instructor-meetings', require('./instructor-meetings'));
router.use('/api/departments', require('./departments'));
router.use('/api/tutoring', require('./tutoring'));
router.use('/api/participants', require('./participants'));

// Report controllers (MVC pattern)
router.use('/api/meetings/reports', require('./meeting-reports'));
router.use('/api/evaluations/reports', require('./evaluation-reports'));

// Serve page routes (must be after API routes to avoid intercepting API calls)
router.use('/', require('./pages'));

module.exports = router;