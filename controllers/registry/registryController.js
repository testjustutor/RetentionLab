/**
 * controllers/registry/registryController.js
 * Handles inline actions from route registry
 */
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { VERIFY_SECRET } = require('../../utils/calendarLinkToken');
const instructorCalendarController = require('../calendar/instructorCalendarController');

const controller = {
  async health(req, res) {
    res.json({ status: 'OK', timestamp: new Date() });
  },

  async storageStats(req, res) {
    try {
      const storageDir = path.resolve(__dirname, '../../storage');
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
      res.status(500).json({ total: '0 KB' });
    }
  },

  async googleCallback(req, res) {
    res.status(500).send('Use /auth/google/callback');
  },

  async calendarCallback(req, res, next) {
    const { state } = req.query;
    if (state && state.startsWith('eyJ')) {
      try {
        const VERIFY_SECRET = process.env.INSTRUCTOR_CALENDAR_SECRET || process.env.JWT_SECRET || 'instructor_cal_secure_key_change_me';
        const payload = jwt.verify(state, VERIFY_SECRET);
        if (payload?.purpose === 'instructor-calendar-verify') {
          return instructorCalendarController.handleCallback(req, res, next);
        }
      } catch { /* not our JWT, pass through */ }
    }
    next();
  }
};

module.exports = controller;