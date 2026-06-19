/**
 * root/routes/calendar.js
 */
const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const CalendarService = require('../services/calendar');
const MultiUserCalendarService = require('../services/calendar/MultiUserCalendarService');
const CalendarUsersModel = require('../models/CalendarUsersModel');
const CalendarVerificationModel = require('../models/CalendarVerificationModel');
const MeetingModel = require('../models/MeetingModel');
const PlatformFactory = require('../services/platforms/platformFactory');
const { URL } = require('url');
const { sendMail } = require('../utils/mailer');
const { signCalendarLink, verifyCalendarLink } = require('../utils/calendarLinkToken');

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
      const decoded = decodeURIComponent(orgMatch[1]);

      // Extract only meeting_xxx part
      const meetingMatch = decoded.match(/(meeting_[^@]+)/);
      return {
        meetingId: meetingMatch ? meetingMatch[1] : decoded,
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
router.get('/multi/users/stats', async (req, res) => {
  try {
    const rows = await MeetingModel.getUserStats();
    const data = rows.map(row => ({
      id:           row.id,
      email:        row.email,
      provider:     row.provider,
      token_expiry: row.token_expiry,
      status:       row.status,
      created_at:   row.created_at,
      updated_at:   row.updated_at,
      user_id:      row.user_id,
      role_name:    row.role_name,
      stats: {
        total_meetings:         row.total_meetings         || 0,
        completed_meetings:     row.completed_meetings     || 0,
        total_duration_seconds: row.total_duration_seconds || 0,
        avg_rating:             null,
        top_platform:           row.top_platform           || null,
        last_meeting_at:        row.last_meeting_at        || null,
      }
    }));
    res.json({ status: 'success', data });
  } catch (err) {
    logger.error('Route(calendar): /multi/users/stats error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/multi/users', async (req, res) => {
  try {
    const users = await CalendarUsersModel.getAllUsers();
    res.json({
      status: 'success',
      count: users.length,
      data: users.map(u => ({
        id: u.user_id_ref || u.user_id || null,
        email: u.email,
        tokenExpiry: u.token_expiry ? new Date(u.token_expiry).toLocaleString() : null,
        updated: u.updated_at,
        role_name: u.role_name || null
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
async function buildAuthUrl(email) {
  const service = new MultiUserCalendarService();
  await service.initialize(email);
  return service.getAuthUrl();
}

async function sendVerificationEmail(email, link) {
  const subject = 'Verify your calendar connection';
  const text = [
    `Hello,`,
    ``,
    `Please verify your calendar connection by opening this link:`,
    link,
    ``,
    `This link will expire soon for security reasons.`,
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      <h2 style="margin:0 0 12px">Verify your calendar connection</h2>
      <p style="margin:0 0 12px">Please verify your calendar connection by opening the link below:</p>
      <p style="margin:0 0 18px"><a href="${link}">${link}</a></p>
      <p style="margin:0;color:#475569">This link will expire soon for security reasons.</p>
    </div>
  `;

  await sendMail({ to: email, subject, text, html });
}

router.post('/multi/auth', async (req, res) => {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ status: 'error', message: 'valid email required' });
    }

    const verification = await CalendarVerificationModel.create(email);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const verifyLink = `${baseUrl}/api/calendar/multi/verify?token=${encodeURIComponent(verification.token)}`;
    await sendVerificationEmail(email, verifyLink);

    res.json({ status: 'success', message: 'Verification email sent.', verifyLink });
  });

router.post('/multi/link-token', async (req, res) => {
  try {
    const { email, userId } = req.body;
    if (!email) return res.status(400).json({ status: 'error', message: 'email required' });
    const token = signCalendarLink({ email, userId: userId || null });
    res.json({ status: 'success', token });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/resolve-user', async (req, res) => {
  try {
    let { token } = req.query;

    // Allow token from cookie (set by POST open endpoint)
    if (!token && req.cookies && req.cookies.rl_calendar_token) {
      token = req.cookies.rl_calendar_token;
    }

    if (!token) return res.status(400).json({ status: 'error', message: 'token required' });
    const payload = verifyCalendarLink(token);
    if (!payload) return res.status(400).json({ status: 'error', message: 'invalid token' });
    res.json({ status: 'success', email: payload.email, userId: payload.userId || null });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Accept a token via POST (form) and set an HttpOnly cookie, then redirect
router.post('/open', async (req, res) => {
  try {
    const { token, target } = req.body || {};
    if (!token) return res.status(400).send('Missing token');
    const payload = verifyCalendarLink(token);
    if (!payload || !payload.email) return res.status(400).send('Invalid or expired token');

    // Set short-lived HttpOnly cookie so the opened page can resolve the user without token in URL
    res.cookie('rl_calendar_token', token, { httpOnly: true, maxAge: 5 * 60 * 1000, sameSite: 'lax' });

    const redirectTo = target === 'archives' ? '/admin/archives.html' : '/admin/calendar-events.html';
    return res.redirect(302, redirectTo);
  } catch (err) {
    logger.error('Route(calendar): open token error', err);
    return res.status(500).send('Server error');
  }
});

router.get('/multi/verify', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send('Missing verification token.');

    const result = await CalendarVerificationModel.verifyToken(token);
    if (!result) return res.status(404).send('Verification link not found.');
    if (result.expired) return res.status(400).send('Verification link expired. Please request a new one.');

    const email = result.row.email;
    const authUrl = await buildAuthUrl(email);
    res.send(`
      <html>
        <head><meta http-equiv="refresh" content="0; url=${authUrl}"></head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h2>Verification complete</h2>
          <p>Redirecting to Google authorization for <strong>${email}</strong>...</p>
        </body>
      </html>
    `);
  } catch (err) {
    logger.error('Route(calendar): Verification error:', err);
    res.status(500).send('Verification failed: ' + err.message);
  }
});

// This MUST match the path in your Google Console and the error URL
router.get('/callback', async (req, res) => {
  const { code, state } = req.query; // state is a signed token containing the email

  if (!code) {
    return res.status(400).send('No code provided from Google.');
  }

  if (!state) {
    return res.status(400).send('Missing state token from OAuth flow.');
  }

  try {
    const payload = verifyCalendarLink(state);
    if (!payload || !payload.email) return res.status(400).send('Invalid or expired state token.');

    const email = payload.email;

    const service = new MultiUserCalendarService();
    
    // 1. Initialize the service with the email sent back in 'state'
    await service.initialize(email);
    
    // 2. Exchange the code for tokens and save to DB
    await service.authorize(code);

    // 3. Success! Close the popup or redirect
    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
          <h1 style="color: #28a745;">✅ Success!</h1>
          <p>Account <strong>${email}</strong> connected successfully.</p>
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
      return res.status(400).json({ status: 'error', message: 'code and state token required' });
    }

    const payload = verifyCalendarLink(state);
    if (!payload || !payload.email) return res.status(400).json({ status: 'error', message: 'invalid state token' });

    const email = payload.email;

    const service = new MultiUserCalendarService();
    await service.initialize(email);
    const tokens = await service.authorize(code);

    res.json({
      status: 'success',
      message: `Authorized ${email}`,
      data: { email, expiry: tokens.expiry_date }
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