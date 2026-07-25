/**
 * root/routes/calendar.js
 */
const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const CalendarUsersModel = require('../models/calendar/CalendarUsersModel');
const CalendarVerificationModel = require('../models/calendar/CalendarVerificationModel');
const MeetingModel = require('../models/meetings/MeetingModel');
const CalendarAuthModel = require('../models/calendar/CalendarAuthModel');
const CalendarEventController = require('../controllers/calendar/CalendarEventController');
const CalendarHelper = require('../utils/calendarHelper');
const { sendMail } = require('../utils/mailer');
const { signCalendarLink, verifyCalendarLink } = require('../utils/calendarLinkToken');

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
  return CalendarEventController.getAuthUrl(email);
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
  const reqId = `cb_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const { code, state } = req.query; // state is a signed token containing the email

  logger.info(`Route(calendar): /callback hit reqId=${reqId}`, {
    hasCode: Boolean(code),
    hasState: Boolean(state)
  });

  if (!code) {
    return res.status(400).send('No code provided from Google.');
  }

  if (!state) {
    return res.status(400).send('Missing state token from OAuth flow.');
  }

  const timeoutMs = 15000;
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error(`OAuth callback timed out after ${timeoutMs}ms (reqId=${reqId})`)),
      timeoutMs
    );
  });

  try {
    logger.info(`Route(calendar): /callback verifyCalendarLink start reqId=${reqId}`);
    const payload = verifyCalendarLink(state);
    if (!payload || !payload.email) {
      logger.warn(`Route(calendar): /callback invalid/expired state token reqId=${reqId}`);
      return res.status(400).send('Invalid or expired state token.');
    }

    const email = payload.email;
    const config = await CalendarAuthModel.getOAuthConfig();
    const redirectUri = (config.redirect_uris && config.redirect_uris[0]);

    logger.info(`Route(calendar): /callback authorizing for ${email} reqId=${reqId}`);

    await Promise.race([
      (async () => {
        await CalendarEventController.authorize(email, code, redirectUri);
        logger.info(`Route(calendar): /callback authorize success for ${email} reqId=${reqId}`);
      })(),
      timeoutPromise
    ]);

    return res.send(`
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
    logger.error(`Route(calendar): OAuth Callback Error reqId=${reqId}:`, {
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
      responseStatus: err?.response?.status,
      responseData: err?.response?.data
    });

    const msg = err?.message || 'Unknown error';
    const hint =
      msg.includes('invalid_grant')
        ? ' (invalid_grant: use a fresh authorization code; verify the redirect URI in Google Console matches exactly your /api/calendar/callback URL)'
        : '';

    const isTimeout = msg.includes('timed out');
    return res
      .status(isTimeout ? 504 : 500)
      .send('Authentication failed: ' + msg + hint + ` (reqId=${reqId})`);
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
    const config = await CalendarAuthModel.getOAuthConfig();
    const redirectUri = (config.redirect_uris && config.redirect_uris[0]);
    const tokens = await CalendarEventController.authorize(email, code, redirectUri);

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

    const now = new Date();
    const future = new Date(now.getTime() + (parseInt(hoursAhead) || 24) * 3600000);

    let events = [];

    try {
      events = await CalendarEventController.getEvents(email, {
        timeMin: now.toISOString(),
        timeMax: future.toISOString(),
        maxResults: 20
      });
    } catch (err) {
      logger.error('Route(calendar): Google Fetch Error:', err);
      events = []; 
    }

    const filtered = events.filter(e => {
      const link = e.hangoutLink || CalendarHelper.extractMeetingLink(e.description, e.location || '');
      const detected = CalendarHelper.detectPlatform(link, e.location);
      return platform ? detected === platform : true;
    });
    
    // Store meetings from events
    await CalendarEventController.processAndStoreEvents(email, filtered);

    res.json({
      status: 'success',
      count: filtered.length,
      eventsAll: events,
      events: filtered.map(e => {
        const link = e.hangoutLink || CalendarHelper.extractMeetingLink(e.description, e.location || '');
        const platformType = CalendarHelper.detectPlatform(link, e.location || '');
        const { meetingId, passcode } = CalendarHelper.extractMeetingId(link, platformType, e.description || '', e.location || '');

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
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;