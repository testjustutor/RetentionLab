/**
 * Unified API Server
 * Main entry point for all API endpoints
 * Supports multiple platforms: Zoom, Teams, Google Meet
 * Includes: Meetings, Transcripts, Participants, Calendar Integration
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { logger } = require('./utils/logger');
const { initDB, closeDB } = require('./database/db');
const CalendarService = require('./services/calendar');

// Import routes
const meetingsRouter = require('./routes/meetings');
const transcriptsRouter = require('./routes/transcripts');
const participantsRouter = require('./routes/participants');
const calendarRouter = require('./routes/calendar');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const PORT = process.env.API_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Serve static files (dashboard, assets)
app.use(express.static(path.join(__dirname, 'public')));

// Dashboard redirect
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// OAuth callback route for Google Calendar
app.get('/auth/google/callback', async (req, res) => {
  const { code, error, state } = req.query;

  if (error) {
    return res.status(400).send(`Google authorization failed: ${error}`);
  }

  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  try {
    // Default to 'default' account if no state specified
    const account = state || 'default';
    const calendarService = new CalendarService(account);

    // Credentials handled automatically by resolveCredentialsPath() in uploads/google-calendar-json/


    await calendarService.authorize(code);
    return res.send(`<!DOCTYPE html><html><body><h2>Google Calendar authorized successfully for ${account} account.</h2><p>You may close this window and return to the dashboard.</p></body></html>`);
  } catch (err) {
    logger.error('OAuth callback error:', err);
    return res.status(500).send(`Authorization failed: ${err.message}`);
  }
});

// API Documentation Route
app.get('/api', (req, res) => {
  res.json({
    status: 'success',
    message: 'Multi-Platform Meeting Transcription API',
    version: '1.0.0',
    endpoints: {
      meetings: {
        list: 'GET /api/meetings',
        get: 'GET /api/meetings/:meetingId',
        join: 'POST /api/meetings/join',
        leave: 'POST /api/meetings/:meetingId/leave',
        status: 'GET /api/meetings/:meetingId/status'
      },
      transcripts: {
        list: 'GET /api/transcripts',
        getBySession: 'GET /api/transcripts/session/:sessionId',
        getByMeeting: 'GET /api/transcripts/meeting/:meetingId',
        search: 'POST /api/transcripts/search',
        export: 'GET /api/transcripts/export/:sessionId?format=json|csv|txt',
        stats: 'GET /api/transcripts/stats/:meetingId'
      },
      participants: {
        list: 'GET /api/participants',
        getByMeeting: 'GET /api/participants/meeting/:meetingId',
        getBySession: 'GET /api/participants/session/:sessionId',
        search: 'GET /api/participants/search',
        stats: 'GET /api/participants/stats/:meetingId'
      },
      calendar: {
        auth: 'GET /api/calendar/auth',
        callback: 'POST /api/calendar/callback',
        events: 'GET /api/calendar/events',
        eventDetail: 'GET /api/calendar/events/:eventId',
        upcomingMeetings: 'GET /api/calendar/upcoming-meetings',
        quickJoin: 'POST /api/calendar/quick-join'
      }
    },
    supportedPlatforms: ['zoom', 'teams', 'google-meet', 'webex', 'gotomeeting'],
    documentation: 'See API routes documentation in /routes folder'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/meetings', meetingsRouter);
app.use('/api/transcripts', transcriptsRouter);
app.use('/api/participants', participantsRouter);
app.use('/api/calendar', calendarRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route not found: ${req.path}`
  });
});

// Initialize and start server
async function startServer() {
  try {
    logger.info('Initializing database...');
    await initDB();
    logger.info('✅ Database initialized');

    server.listen(PORT, () => {
      logger.info(`✅ API Server running on http://localhost:${PORT}`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api`);
    });

    // Graceful shutdown
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);

  } catch (err) {
    logger.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

async function gracefulShutdown() {
  logger.info('⏹️  Shutting down server gracefully...');

  server.close(async () => {
    try {
      await closeDB();
      logger.info('✅ Database connection closed');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown:', err);
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// Start the server
startServer();

module.exports = app;
