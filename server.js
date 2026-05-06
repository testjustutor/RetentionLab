require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = express.json(); // Simple CORS
const TranscriptModel = require('./models/transcriptModel');
const { logger } = require('./utils/logger');
const { initDB } = require('./database/db');
const botManager = require('./services/shared/botManager');

// --- HELPER IMPORTS FOR AUTO-SYNC ---
const MeetingModel = require('./models/MeetingModel');
const CalendarUsersModel = require('./models/CalendarUsersModel');
const MultiUserCalendarService = require('./services/calendar/MultiUserCalendarService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors);
app.use(express.json());
app.use(express.static('public'));

// -------------------------------------------------------------------------
// NEW: BACKGROUND SYNC HELPERS (Keeps logic consistent with calendar.js)
// -------------------------------------------------------------------------
function extractMeetingLink(description) {
  if (!description) return null;
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const matches = description.match(urlPattern);
  if (matches) {
    for (let url of matches) {
      if (url.includes('zoom.us') || url.includes('meet.google.com') || url.includes('teams.microsoft.com') || url.includes('teams.live.com')) {
        return url;
      }
    }
  }
  return null;
}

function detectPlatform(link = '') {
  if (!link) return 'unknown';

  link = link.toLowerCase();

  if (link.includes('meet.google.com')) return 'google-meet';
  if (link.includes('zoom.us')) return 'zoom';

  if (
    link.includes('teams.microsoft.com') ||
    link.includes('teams.live.com')
  ) return 'teams';

  return 'unknown';
}

function extractMeetingId(link, platform, description = '') {
  let meetingId = null;
  let passcode = null;

  // -------- Zoom --------
  if (platform === 'zoom') {
    try {
      if (link) {
        const url = new URL(link);

        // Meeting ID from URL
        const match = url.pathname.match(/\/j\/(\d+)/);
        if (match) meetingId = match[1];
      }
    } catch {}

    // ✅ Extract REAL passcode from description
    if (description) {
      const idMatch = description.match(/Meeting ID[:\s]*([\d\s]+)/i);
      if (idMatch) {
        meetingId = idMatch[1].replace(/\s/g, '');
      }

      const passMatch = description.match(/(?:Passcode|Password)[:\s]*([\w]+)/i);
      if (passMatch) {
        passcode = passMatch[1];
      }
    }

    return { meetingId, passcode };
  }

  // -------- Teams --------
  if (platform === 'teams') {
    if (!link) return { meetingId: null, passcode: null };

    // ✅ Teams ORG (teams.microsoft.com)
    const orgMatch = link.match(/meetup-join\/([^/?]+)/);
    if (orgMatch) {
      return {
        meetingId: orgMatch[1].substring(0, 40),
        passcode: null
      };
    }

    // ✅ Teams PERSONAL (teams.live.com)
    const liveMatch = link.match(/meet\/(\d+)/);
    if (liveMatch) {
      return {
        meetingId: liveMatch[1],
        passcode: null
      };
    }

    // ❌ Only fallback if nothing matches
    return {
      meetingId: 'teams-' + Date.now(),
      passcode: null
    };
  }

  // -------- Google Meet --------
  if (platform === 'google-meet') {
    if (!link) return { meetingId: null, passcode: null };

    try {
      const url = new URL(link);

      // 👉 Extract /oeb-eahf-toi
      const meetingId = url.pathname.replace('/', '');

      return {
        meetingId: meetingId || null,
        passcode: null
      };
    } catch {
      return { meetingId: null, passcode: null };
    }
  }

  return { meetingId: null, passcode: null };
}

// -------------------------------------------------------------------------
// NEW: AUTO-SYNC ALL USERS (The "Fireflies" background engine)
// -------------------------------------------------------------------------
async function backgroundSyncAllUsers() {
  try {
    const users = await CalendarUsersModel.getAllUsers();
    logger.info(`🔄 Global Sync: Checking meetings for ${users.length} authenticated users...`);

    for (const user of users) {
      try {
        const service = new MultiUserCalendarService();
        await service.initialize(user.email);

        const activeEventIds = [];

        // Fetch next 24 hours
        const events = await service.getEvents({
          timeMin: new Date().toISOString(),
          timeMax: new Date(Date.now() + 24 * 3600000).toISOString(),
          singleEvents: true
        });

        for (const e of events) {
          activeEventIds.push(e.id);
          const link = e.hangoutLink || extractMeetingLink(e.description);
          if (link) {
            const platformType = detectPlatform(link);
            const { meetingId, passcode } = extractMeetingId(link, platformType, e.description);
            
            logger.info(`🔄 meetingId : ${meetingId} and passcode : ${passcode} `);
            // Store & Match logic
            await MeetingModel.getMeetingByIdOrCreate({
              meetingId: meetingId || e.id,
              platform: platformType,
              passcode: passcode,
              eventId: e.id,
              account: user.email,
              meetingLink: link,
              startTime: e.start.dateTime || e.start.date,
              endTime: e.end.dateTime || e.end.date,
              timezone: e.start.timezone || e.start.timeZone,
              title: e.summary || 'Untitled Meeting'
            });
          }
        }
        await MeetingModel.deleteRemovedMeetings(user.email, activeEventIds);
        logger.info(`Sync complete for ${user.email}. Cleanup performed.`);
      } catch (userErr) {
        logger.error(`Failed to sync for ${user.email}: ${userErr.message}`);
      }
    }
  } catch (err) {
    logger.error('Global background sync error:', err);
  }
}

// -------------------------------------------------------------------------
// EXISTING ROUTES (Unchanged)
// -------------------------------------------------------------------------

app.get('/storage/stats', async (req, res) => {
  try {
    const storageDir = './storage';
    let totalSize = 0;
    const fs = require('fs');
    const path = require('path');
    
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
    logger.error('Storage stats error:', err);
    res.status(500).json({ total: '0 KB' });
  }
});

app.use('/api/bot', require('./routes/bot'));

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code, error, state: account = 'default' } = req.query;
    
    // --- DYNAMIC URL DETECTION ---
    // Detect if we are using https (common on live servers/ngrok) or http
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    // Get the current host (e.g., your-ngrok-url.ngrok-free.app or localhost:3000)
    const host = req.headers.host;
    const dynamicBaseUrl = `${protocol}://${host}`;

    if (error) {
      logger.error('Google OAuth error:', error);
      return res.status(400).send(`<h2>OAuth Error: ${error}</h2><p><a href="${dynamicBaseUrl}/public/dashboard.html">Back</a></p>`);
    }

    // Call the internal API using the dynamic URL instead of localhost:3000
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
          <p><a href="${dynamicBaseUrl}/public/dashboard.html" style="color: blue;">Go to Dashboard</a></p>
        </body></html>
      `);
    } else {
      res.status(500).send(`<h2>❌ Authorization Failed</h2><p>${result.message || 'Unknown error'}</p>`);
    }
  } catch (err) {
    logger.error('Callback error:', err);
    res.status(500).send(`<h2>Server Error</h2><p>${err.message}</p>`);
  }
});

app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/db', require('./routes/db-admin'));

app.get('/api/transcripts/:meetingId', async (req, res) => {
  try {
    const transcripts = await TranscriptModel.getTranscriptsByMeeting(req.params.meetingId);
    res.json({
      meetingId: req.params.meetingId,
      count: transcripts.length,
      transcripts: transcripts.map(t => ({
        speaker: t.speaker,
        text: t.text,
        time: t.timestamp
      }))
    });
  } catch (err) {
    logger.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// -------------------------------------------------------------------------
// RE-ACTIVATED: BOT POLLING SERVICE
// -------------------------------------------------------------------------
setInterval(async () => {
  try {
    const queued = await MeetingModel.getQueuedMeetings();
    if (queued.length > 0) {
        logger.info(`Polling found ${queued.length} queued meetings`);
    }
    
    for (const meeting of queued) {
      const startTime = new Date(meeting.start_time);
      const now = new Date();
      
      if (startTime <= now) {
        // ✅ FIX: Check for the ID before launching
        if (!meeting.meeting_id || meeting.meeting_id === 'null') {
          logger.warn(`Skipping meeting ${meeting.meeting_id}: No valid meeting_id found in DB.`);
          
          continue; 
        }

        await botManager.launchFromDb(meeting);
      }
    }
  } catch (err) {
    logger.error('Polling error:', err);
  }
}, 10000);

// -------------------------------------------------------------------------
// SERVER STARTUP WITH INITIAL GLOBAL SYNC
// -------------------------------------------------------------------------
CalendarUsersModel.createTable()
  .catch(err => logger.warn('Users table creation failed:', err))
  .then(() => initDB())
  .then(async () => {
    // 🚀 FIREFLIES LOGIC: Run Global Sync immediately on server start
    await backgroundSyncAllUsers();
    
    // 🔄 Sync every 30 minutes to capture new calendar invites
    setInterval(backgroundSyncAllUsers, 30 * 60 * 1000);

    // At the very bottom of server.js, replace the httpServer.listen block:
    httpServer.listen(PORT, () => {
      // This will log the actual port being used
      logger.info(`🚀 Bot Server is LIVE on Port: ${PORT}`);
      logger.info(`Auto-Sync (1min) and Polling (30s) are now ACTIVE.`);
    });
  })
  .catch(err => {
    logger.error('Server start error:', err);
  });

module.exports = { app, io };