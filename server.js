/**
 * root/server.js
 *
 * Main Express server with background sync and bot polling
 */

// ============================================================================
// CORE MODULES
// ============================================================================
require('dotenv').config();
const express = require('express');
const http = require('http');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

// ============================================================================
// THIRD-PARTY MODULES
// ============================================================================
const { Server } = require('socket.io');
const cors = express.json();

// ============================================================================
// LOCAL MODELS
// ============================================================================
const TranscriptModel = require('./models/transcripts/transcriptModel');
const { HeaderConfigModel } = require('./models/header/HeaderConfigModel');
const MeetingModel = require('./models/meetings/MeetingModel');
const CalendarUsersModel = require('./models/calendar/CalendarUsersModel');
const CalendarVerificationModel = require('./models/calendar/CalendarVerificationModel');

// ============================================================================
// LOCAL SERVICES
// ============================================================================
const botManager = require('./services/shared/botManager');

// ============================================================================
// LOCAL CONTROLLERS
// ============================================================================
const CalendarSyncController = require('./controllers/calendar/CalendarSyncController');
const BotPollingController = require('./controllers/meetings/BotPollingController');

// ============================================================================
// UTILITIES
// ============================================================================
const { logger } = require('./utils/logger');
const { initDB } = require('./database/db');

// ============================================================================
// APP INITIALIZATION
// ============================================================================
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// MIDDLEWARE
// ============================================================================
app.use(cors);
app.use(express.json());
app.use(cookieParser());

// ============================================================================
// ROUTES
// ============================================================================

/**
 * Clean URL mapping for session-quality pages
 * Maps /admin/session-quality/:page to .html files
 */
app.get('/admin/session-quality/:page', (req, res) => {
  const page = req.params.page;
  const validPages = ['index', 'rubric', 'analysis', 'impact', 'parent-summary', 'coaching', 'better-alternatives', 'next-plan', 'flags', 'final-eval'];
  if (validPages.includes(page)) {
    return res.sendFile(path.join(__dirname, 'public', 'admin', 'session-quality', `${page}.html`));
  }
  return res.status(404).send('Page not found');
});

// ============================================================================
// CENTRALIZED ROUTE REGISTRATION
// ============================================================================
const { registerRoutes } = require('./routes/registry');
registerRoutes(app);

// ============================================================================
// STATIC FILES
// ============================================================================
app.use('/storage', express.static(path.join(__dirname, 'storage')));
app.use(express.static('public'));

// ============================================================================
// BACKGROUND SERVICES
// ============================================================================

/**
 * Global calendar sync - runs every 30 minutes
 * Syncs all authenticated users' calendar events
 */
async function scheduleBackgroundSync() {
  await CalendarSyncController.globalSync();
  setTimeout(scheduleBackgroundSync, 30 * 60 * 1000);
}

// Expose controller methods for use in routes or other parts of the application
module.exports.CalendarSyncController = CalendarSyncController;
module.exports.BotPollingController = BotPollingController;

/**
 * Bot polling service - runs every 30 seconds
 * Checks for queued meetings and launches bots
 */
async function pollQueuedMeetings() {
  await BotPollingController.pollQueuedMeetings();
}

// ============================================================================
// SERVER INITIALIZATION
// ============================================================================

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Start bot polling
setTimeout(pollQueuedMeetings, 30000);

// Database initialization and server startup
initDB()
  .then(() => {
    logger.info('[Startup] Database connection initialized');
    // Attach db to app.locals for use in controllers
    const { db } = require('./database/db');
    app.locals.db = db;
  })
  .catch(err => logger.warn('(ServerJS File): Setup failed:', err))
  .then(async () => {
    // Optional background sync to reduce startup noise
    if (process.env.RUN_CAL_SYNC_AT_START === 'true') {
      await scheduleBackgroundSync();
    } else {
      logger.info('[Startup] Calendar sync at start disabled (set RUN_CAL_SYNC_AT_START=true to enable)');
    }

    httpServer.listen(PORT, () => {
      logger.info(`(ServerJS File): Server is LIVE on Port: ${PORT}`);
      logger.info(`(ServerJS File): Auto-Sync (1min) and Polling (30s) are now ACTIVE.`);
    });
  })
  .catch(err => {
    logger.error('(ServerJS File): Server start error:', err);
  });

module.exports = { app, io };