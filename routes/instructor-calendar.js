/**
 * routes/instructor-calendar.js
 * Thin route layer for instructor Google Calendar verification + connections.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/calendar/instructorCalendarController');
const { syncGoogleCalendar } = require('../services/calendarSyncService');

function handle(fn) {
  return (req, res) => fn(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r));
}

// Protected routes (require admin login)
router.get('/connections', requireAuth, handle(ctrl.listConnections));
router.post('/send-verification', requireAuth, handle(ctrl.sendVerification));
router.post('/disconnect', requireAuth, handle(ctrl.disconnect));
router.get('/status/:email', requireAuth, handle(ctrl.getStatus));

// Sync calendar meetings to local database
router.post('/sync', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { daysBack = 30, daysForward = 90 } = req.body;
    
    // For instructors: sync their own calendar
    // For admins: sync all instructors in their company
    let syncResults = [];
    
    if (user.role_name === 'instructor' || user.role_name === 'solo_instructor') {
      // Sync only their own calendar
      const result = await syncGoogleCalendar(user.email, user.id, daysBack, daysForward);
      syncResults.push({ email: user.email, ...result });
    } else if (user.role_name === 'admin' || user.role_name === 'super_admin') {
      // Sync all instructors in their company
      const UsersModel = require('../models/users/UsersModel');
      const allUsers = await UsersModel.listUsers(user, { limit: 1000 });
      const instructors = allUsers.filter(u => 
        u.role_name === 'instructor' || u.role_name === 'solo_instructor'
      );
      
      for (const instructor of instructors) {
        try {
          const result = await syncGoogleCalendar(instructor.email, instructor.id, daysBack, daysForward);
          syncResults.push({ email: instructor.email, ...result });
        } catch (err) {
          logger.error(`[CalendarSync] Failed to sync ${instructor.email}:`, err);
          syncResults.push({ email: instructor.email, error: err.message });
        }
      }
    }
    
    const totalSynced = syncResults.reduce((sum, r) => sum + (r.synced || 0), 0);
    res.json({ 
      success: true, 
      message: `Synced ${totalSynced} meetings`,
      results: syncResults 
    });
  } catch (err) {
    console.error('Calendar sync error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Public route - instructor opens this link from email (no auth required)
router.get('/verify', ctrl.verifyToken);

// Public route - instructor self-service calendar integration by registered email
router.post('/self-request', ctrl.selfRequest);

// Callback after Google OAuth (no auth required - Google redirects here)
router.get('/callback', ctrl.handleCallback);

module.exports = router;