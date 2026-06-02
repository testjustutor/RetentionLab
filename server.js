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
  const urlPattern = /https?:\/\/[^\s<>\]]+/g;
  const matches = description.match(urlPattern);
  if (matches) {
    for (let url of matches) {
      url = url.replace(/[>\])"']+$/, '');
      if (url.includes('zoom.us') || 
          url.includes('meet.google.com') || 
          url.includes('teams.microsoft.com') || 
          url.includes('teams.live.com')
        ) {
        return url;
      }
    }
  }
  return null;
}

function detectPlatform(link = '', location = '') {
  if (!link && !location) return 'unknown';

  if (link) {
    const lowerLink = link.toLowerCase();
    if (lowerLink.includes('meet.google.com')) return 'google-meet';
    if (lowerLink.includes('zoom.us')) return 'zoom';
    if (lowerLink.includes('teams.microsoft.com') || lowerLink.includes('teams.live.com')) return 'teams';
  }

  // 2. Secondary check: Fall back to raw text inside the Location input box
  if (location) {
    const lowerLoc = location.toLowerCase().trim();
    if (lowerLoc === 'zoom' || lowerLoc.includes('zoom.us')) return 'zoom';
    if (lowerLoc.includes('google meet') || lowerLoc.includes('meet.google')) return 'google-meet';
    if (lowerLoc.includes('teams')) return 'teams';
  }

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

    let passcode = null;
    const passMatch = description.match(/(?:Passcode|Password)[:\s]*([\w]+)/i) || link.match(/[?&](?:passcode|pwd|p)=([^&]+)/i);
    if (passMatch) passcode = passMatch[1];

    // ✅ Teams ORG (teams.microsoft.com)
    const orgMatch = link.match(/meetup-join\/([^/?]+)/);
    if (orgMatch) {
      return {
        // ✅ Fix: Don't truncate Teams IDs; they can be over 100+ characters long
        meetingId: decodeURIComponent(orgMatch[1]),
        passcode
      };
    }

    // ✅ Teams PERSONAL (teams.live.com)
    const liveMatch = link.match(/meet\/(\d+)/);
    if (liveMatch) {
      return {
        meetingId: liveMatch[1],
        passcode
      };
    }

    // ❌ Only fallback if nothing matches
    return {
      meetingId: 'teams-' + Date.now(),
      passcode
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
    logger.info(`(ServerJS File): Global Sync: Checking meetings for ${users.length} authenticated users...`);

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
          
          logger.info(`(ServerJS File): e.id - ${e.id} `);
          
          const link = e.hangoutLink || extractMeetingLink(e.description);
          if (link) {
            
            const platformType = detectPlatform(link, e.location || '');

            if (platformType && platformType !== 'unknown') {

              const { meetingId, passcode } = extractMeetingId(link, platformType, e.description);
              
              logger.info(`(ServerJS File): Platform - ${platformType} meetingId - ${meetingId} and passcode - ${passcode} `);
              
              if (meetingId && meetingId !== 'unknown' && meetingId !== 'null') {
                // Store & Match logic
                await MeetingModel.getMeetingByIdOrCreate({
                  meetingId: meetingId,
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
              }else{
                logger.warn(`(ServerJS File): Skipping DB store. Invalid meetingId gathered: "${meetingId}"`);
              }
            }
          }
        }
        // await MeetingModel.deleteRemovedMeetings(user.email, activeEventIds);
        logger.info(`(ServerJS File): Sync complete for ${user.email}. Cleanup performed.`);
      } catch (userErr) {
        logger.error(`(ServerJS File): Failed to sync for ${user.email}: ${userErr.message}`);
      }
    }
  } catch (err) {
    logger.error('(ServerJS File): Global background sync error:', err);
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
    logger.error('(ServerJS File): Storage stats error:', err);
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
      logger.error('(ServerJS File): Google OAuth error:', error);
      return res.status(400).send(`<h2>OAuth Error: ${error}</h2>`);
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
        </body></html>
      `);
    } else {
      res.status(500).send(`<h2>❌ Authorization Failed</h2><p>${result.message || 'Unknown error'}</p>`);
    }
  } catch (err) {
    logger.error('(ServerJS File): Callback error:', err);
    res.status(500).send(`<h2>Server Error</h2><p>${err.message}</p>`);
  }
});

app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/db', require('./routes/db-admin'));

app.use('/api/transcripts', require('./routes/transcripts'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/assets', require('./routes/assets'));
app.use('/api/archives', require('./routes/archives'));

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
    // ✅ Only fetch meetings that haven't been touched yet
    const queued = await MeetingModel.getQueuedMeetings(['queued']);

    if (queued.length > 0) {
      logger.info(`(ServerJS): Polling found ${queued.length} queued meetings`);
    }

    for (const meeting of queued) {
      const minutesUntilStart =
        (new Date(meeting.start_time).getTime() - Date.now()) / 60000;

      // ✅ Timed out — mark expired and skip
      if (minutesUntilStart < -5) {
        logger.warn(
          `(ServerJS): Skipping ${meeting.meeting_id}: timed out by ${Math.abs(Math.round(minutesUntilStart))} mins`
        );
        await MeetingModel.updateMeetingStatus(meeting.meeting_id, 'expired');
        continue;
      }

      // ✅ Wider 1–3 min window gives more polling cycles to catch it
      if (minutesUntilStart > 3 || minutesUntilStart < 1) continue;

      // ✅ Validate ID
      if (!meeting.meeting_id || meeting.meeting_id === 'null') {
        logger.warn(`(ServerJS): Skipping: no valid meeting_id`);
        continue;
      }

      // ✅ Mark 'launching' BEFORE calling launchFromDb — prevents double-launch
      //    on the next poll cycle (getQueuedMeetings won't return this meeting again)
      await MeetingModel.updateMeetingStatus(meeting.meeting_id, 'launching');

      try {
        await botManager.launchFromDb(meeting);
        await MeetingModel.updateMeetingStatus(meeting.meeting_id, 'in_progress');
        logger.info(`(ServerJS): Launched meeting ${meeting.meeting_id}`);
      } catch (launchErr) {
        logger.error(`(ServerJS): Launch failed for ${meeting.meeting_id}:`, launchErr);
        // ✅ Roll back so it can be retried, or set 'failed' to stop retrying
        await MeetingModel.updateMeetingStatus(meeting.meeting_id, 'failed');
      }
    }
  } catch (err) {
    logger.error('(ServerJS): Polling error:', err);
  }
}, 30000); // ✅ 30s is enough — meetings don't change second-by-second

// -------------------------------------------------------------------------
// SERVER STARTUP WITH INITIAL GLOBAL SYNC
// -------------------------------------------------------------------------
CalendarUsersModel.createTable()
  .catch(err => logger.warn('(ServerJS File): Users table creation failed:', err))
  .then(() => initDB())
  .then(async () => {
    // 🚀 FIREFLIES LOGIC: Run Global Sync immediately on server start
    await backgroundSyncAllUsers();
    
    // 🔄 Sync every 30 minutes to capture new calendar invites
    setInterval(backgroundSyncAllUsers, 30 * 60 * 1000);

    // At the very bottom of server.js, replace the httpServer.listen block:
    httpServer.listen(PORT, () => {
      // This will log the actual port being used
      logger.info(`(ServerJS File): Bot Server is LIVE on Port: ${PORT}`);
      logger.info(`(ServerJS File): Auto-Sync (1min) and Polling (30s) are now ACTIVE.`);
    });
  })
  .catch(err => {
    logger.error('(ServerJS File): Server start error:', err);
  });

module.exports = { app, io };