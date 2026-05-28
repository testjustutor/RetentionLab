const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const CalendarService = require('../services/calendar');
const MultiUserCalendarService = require('../services/calendar/MultiUserCalendarService');
const CalendarUsersModel = require('../models/CalendarUsersModel');
const MeetingModel = require('../models/MeetingModel');
const PlatformFactory = require('../services/platforms/platformFactory');

// ---------------------- HELPERS ----------------------
function extractMeetingLink(text = '', location = '') {
  if (!text) return null;
  location
  const matches = text.match(/https?:\/\/[^\s<>\]]+/g);
  if (!matches) return null;

  for (let url of matches) {
    // ✅ Strip trailing quotes, parentheses, and brackets that corrupt the URL
    url = url.replace(/[>\])"']+$/, '');

    if (
      url.includes('zoom.us') ||
      url.includes('teams.microsoft.com') ||
      url.includes('teams.live.com') ||
      url.includes('meet.google.com') ||
      url.includes('webex.com') ||
      url.includes('gotomeeting.com')
    ) {
      return url;
    }
  }

  return null;
}

function detectPlatform(link = '', location = '') {
  if (!link && !location) return 'unknown';

  if (location) {
    const lowerLoc = location.toLowerCase().trim();
    if (lowerLoc === 'zoom' || lowerLoc.includes('zoom.us')) return 'zoom';
    if (lowerLoc.includes('google meet') || lowerLoc.includes('meet.google')) return 'google-meet';
    if (lowerLoc.includes('teams')) return 'teams';
  }

  if (link) {
    const lowerLink = link.toLowerCase();
    if (lowerLink.includes('meet.google.com')) return 'google-meet';
    if (lowerLink.includes('zoom.us')) return 'zoom';
    if (lowerLink.includes('teams.microsoft.com') || lowerLink.includes('teams.live.com')) return 'teams';
  }

  return 'unknown';
}

function extractMeetingId(link, platform, description = '', location = '') {
  let meetingId = null;
  let passcode = null;

  if (platform === 'zoom') {
    try {
      if (link) {
        const url = new URL(link);
        const match = url.pathname.match(/\/j\/(\d+)/);
        if (match) meetingId = match[1];
      }
    } catch {}
    if (description) {
      const idMatch = description.match(/Meeting ID[:\s]*([\d\s]+)/i);
      if (idMatch) {
        meetingId = idMatch[1].replace(/\s/g, '');
      }

      const passMatch = description.match(/(?:Passcode|Password)[:\s]*([\w]+)/i)
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
        meetingId: decodeURIComponent(orgMatch[1]),
        passcode
      };
    }

    // ✅ Teams 
    const liveMatch = link.match(/meet\/(\d+)/);
    if (liveMatch) {
      return {
        meetingId: liveMatch[1],
        passcode
      };
    }

    return {
      meetingId: 'teams-' + Date.now(),
      passcode
    };
  }

  // -------- Google Meet --------
  if (platform === 'google-meet') {
   
    const meetUrl = location ? location : link;

    if (!meetUrl) {
      return { meetingId: null, passcode: null };
    }

    try {
      const url = new URL(meetUrl);
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

// ---------------------- MULTI USERS ----------------------
router.get('/multi/users', async (req, res) => {
  try {
    const users = await CalendarUsersModel.getAllUsers();
    res.json({
      status: 'success',
      count: users.length,
      data: users.map(u => ({
        email: u.email,
        tokenExpiry: u.token_expiry ? new Date(u.token_expiry).toLocaleString() : null,
        updated: u.updated_at
      }))
    });
  } catch (err) {
    logger.error('Route(calendar): Error listing users:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/multi/users/disconnect', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ status: 'error', message: 'valid email required' });
    }

    await CalendarUsersModel.deleteUser(email);
    res.json({ status: 'success', message: `User ${email} disconnected` });
  } catch (err) {
    logger.error('Route(calendar): ', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ---------------------- MULTI AUTH ----------------------
router.post('/multi/auth', async (req, res) => {
    const { email } = req.body;
    const service = new MultiUserCalendarService();
    await service.initialize(email); // Setup the client
    const url = await service.getAuthUrl(); // Generate URL with email in 'state'
    
    res.json({ status: 'success', url: url });
});

// This MUST match the path in your Google Console and the error URL
router.get('/callback', async (req, res) => {
  const { code, state } = req.query; // state is your email: shyam.charan@ncreduservices.com

  if (!code) {
    return res.status(400).send('No code provided from Google.');
  }

  try {
    const service = new MultiUserCalendarService();
    
    // 1. Initialize the service with the email sent back in 'state'
    await service.initialize(state);
    
    // 2. Exchange the code for tokens and save to DB
    await service.authorize(code);

    // 3. Success! Close the popup or redirect
    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
          <h1 style="color: #28a745;">✅ Success!</h1>
          <p>Account <strong>${state}</strong> connected successfully.</p>
          <p>You can close this window now.</p>
          <script>
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    logger.error('Route(calendar): OAuth Callback Error:', err);
    res.status(500).send('Authentication failed: ' + err.message);
  }
});

router.post('/multi/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ status: 'error', message: 'code and email required' });
    }

    const service = new MultiUserCalendarService();
    await service.initialize(state);
    const tokens = await service.authorize(code);

    res.json({
      status: 'success',
      message: `Authorized ${state}`,
      data: { email: state, expiry: tokens.expiry_date }
    });
  } catch (err) {
    logger.error('Route(calendar): ',err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ---------------------- EVENTS ----------------------
router.post('/multi/events', async (req, res) => {
  try {
    const { email, hoursAhead = '24', platform } = req.body;

    if (!email) {
      return res.status(400).json({ status: 'error', message: 'email required' });
    }

    const hours = parseInt(hoursAhead) || 24;

    const service = new MultiUserCalendarService();
    await service.initialize(email);

    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    // Set to end of today (23:59:59)
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    
    const future = new Date(now.getTime() + (parseInt(hoursAhead) || 24) * 3600000);

    let events = [];

    try {
      events = await service.getEvents({
        timeMin: now.toISOString(),
        timeMax: future.toISOString(),
        // timeMin: startOfToday.toISOString(),
        // timeMax: endOfToday.toISOString(),
        maxResults: 20
      });
    } catch (err) {
      logger.error('Route(calendar): Google Fetch Error:', err);
      events = []; 
    }

    const filtered = events.filter(e => {
      const link = e.hangoutLink || extractMeetingLink(e.description, e.location || '');
      const detected = detectPlatform(link, e.location);
      return platform ? detected === platform : true;
    });
    
    // --- START OF STORAGE LOGIC ---
    for (const e of filtered) {

      logger.info('(Route(calendar): e.location -', e.location);

      // logger.info(`(Route(calendar): description - ${e.description} `);

      const link = e.hangoutLink || extractMeetingLink(e.description, e.location || '');
      logger.info(`(Route(calendar): link - ${link} `);
      
      const platformType = detectPlatform(link, e.location);

      // logger.info(`(Route(calendar): platformType - ${platformType} `);

      if (platformType && platformType !== 'unknown') {
        
        const { meetingId, passcode } = extractMeetingId(link, platformType, e.description || '', e.location || '');

        // logger.info(`(Route(calendar): Platform - ${platformType} meetingId - ${meetingId} and passcode - ${passcode} `);
        
        if (meetingId && meetingId !== 'unknown' && meetingId !== 'null') {
              
          await MeetingModel.getMeetingByIdOrCreate({
            meetingId: meetingId,
            platform: platformType,
            eventId: e.id,
            passcode:passcode,
            account: email,
            meetingLink: link,
            startTime: e.start.dateTime || e.start.date,
            endTime: e.end.dateTime || e.end.date,
            timezone: e.start.timezone,
            title: e.summary || 'Untitled Meeting'
          });
        }
      }

    }

    res.json({
      status: 'success',
      count: filtered.length,
      eventsAll:events,
      events: filtered.map(e => {
        const link = e.hangoutLink || extractMeetingLink(e.description, e.location || '');
        const platformType = detectPlatform(link, e.location || '');

        const { meetingId, passcode } = extractMeetingId(link, platformType, e.description || '', e.location || '');

        return {
          id: e.id,
          title: e.summary,
          start: e.start.dateTime || e.start.date,
          end: e.end.dateTime || e.end.date,
          timezone: e.start.timezone,
          link,
          platform: platformType,
          meetingId,
          passcode
        };
      })
    });
  } catch (err) {
    // logger.error('Route(calendar): ',err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;