/**
 * controllers/calendar/calendarController.js
 * Calendar controller
 */
const { logger } = require('../../utils/logger');
const CalendarUsersModel = require('../../models/calendar/CalendarUsersModel');
const CalendarVerificationModel = require('../../models/calendar/CalendarVerificationModel');
const CalendarAuthModel = require('../../models/calendar/CalendarAuthModel');
const CalendarEventController = require('./CalendarEventController');
const CalendarHelper = require('../../utils/calendarHelper');
const MeetingModel = require('../../models/meetings/MeetingModel');
const { sendMail } = require('../../utils/mailer');
const { verifyCalendarLink } = require('../../utils/calendarLinkToken');

const controller = {
  async getUserStats(req, res) {
    try {
      const rows = await MeetingModel.getUserStats();
      const data = rows.map(row => ({
        id: row.id, email: row.email, provider: row.provider,
        token_expiry: row.token_expiry, status: row.status,
        created_at: row.created_at, updated_at: row.updated_at,
        user_id: row.user_id, role_name: row.role_name,
        stats: {
          total_meetings: row.total_meetings || 0,
          completed_meetings: row.completed_meetings || 0,
          total_duration_seconds: row.total_duration_seconds || 0,
          avg_rating: null, top_platform: row.top_platform || null,
          last_meeting_at: row.last_meeting_at || null,
        }
      }));
      res.json({ status: 'success', data });
    } catch (err) {
      logger.error('Controller(calendar): getUserStats error:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  },

  async listUsers(req, res) {
    try {
      const users = await CalendarUsersModel.getAllUsers();
      res.json({ status: 'success', count: users.length, data: users.map(u => ({
        id: u.user_id_ref || u.user_id || null, email: u.email,
        tokenExpiry: u.token_expiry ? new Date(u.token_expiry).toLocaleString() : null,
        updated: u.updated_at, role_name: u.role_name || null
      })) });
    } catch (err) {
      logger.error('Controller(calendar): Error listing users:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  },

  async disconnectUser(req, res) {
    try {
      const { email, user_id } = req.body;
      let userId = user_id;
      if (!userId && email) {
        const users = await CalendarUsersModel.getAllUsers();
        const user = users.find(u => u.email === email);
        if (!user) return res.status(404).json({ status: 'error', message: `User ${email} not found` });
        userId = user.user_id;
      }
      if (!userId) return res.status(400).json({ status: 'error', message: 'user_id or valid email required' });
      await CalendarUsersModel.deleteUser(userId);
      res.json({ status: 'success', message: `User ${userId} calendar disconnected` });
    } catch (err) {
      logger.error('Controller(calendar): disconnect error:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  },

  async auth(req, res) {
    const { email } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ status: 'error', message: 'valid email required' });
    const verification = await CalendarVerificationModel.create(email);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const verifyLink = `${baseUrl}/api/calendar/multi/verify?token=${encodeURIComponent(verification.token)}`;
    const subject = 'Verify your calendar connection';
    const text = `Hello,\n\nPlease verify your calendar connection by opening this link:\n${verifyLink}\n\nThis link will expire soon for security reasons.`;
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a"><h2 style="margin:0 0 12px">Verify your calendar connection</h2><p style="margin:0 0 12px">Please verify your calendar connection by opening the link below:</p><p style="margin:0 0 18px"><a href="${verifyLink}">${verifyLink}</a></p><p style="margin:0;color:#475569">This link will expire soon for security reasons.</p></div>`;
    await sendMail({ to: email, subject, text, html });
    res.json({ status: 'success', message: 'Verification email sent.', verifyLink });
  },

  async verify(req, res) {
    try {
      const { token } = req.query;
      if (!token) return res.status(400).send('Missing verification token.');
      const result = await CalendarVerificationModel.verifyToken(token);
      if (!result) return res.status(404).send('Verification link not found.');
      if (result.expired) return res.status(400).send('Verification link expired.');
      const email = result.row.email;
      const authUrl = await CalendarEventController.getAuthUrl(email);
      res.send(`<html><head><meta http-equiv="refresh" content="0; url=${authUrl}"></head><body style="font-family: sans-serif; padding: 40px; text-align: center;"><h2>Verification complete</h2><p>Redirecting to Google authorization for <strong>${email}</strong>...</p></body></html>`);
    } catch (err) {
      logger.error('Controller(calendar): Verification error:', err);
      res.status(500).send('Verification failed: ' + err.message);
    }
  },

  async postCallback(req, res) {
    try {
      const { code, state } = req.query;
      if (!code || !state) return res.status(400).json({ status: 'error', message: 'code and state token required' });
      const payload = verifyCalendarLink(state);
      if (!payload || !payload.email) return res.status(400).json({ status: 'error', message: 'invalid state token' });
      const email = payload.email;
      const config = await CalendarAuthModel.getOAuthConfig();
      const redirectUri = (config.redirect_uris && config.redirect_uris[0]);
      const tokens = await CalendarEventController.authorize(email, code, redirectUri);
      res.json({ status: 'success', message: `Authorized ${email}`, data: { email, expiry: tokens.expiry_date } });
    } catch (err) {
      logger.error('Controller(calendar): callback error:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  },

  async callback(req, res) {
    const reqId = `cb_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const { code, state } = req.query;
    logger.info(`Controller(calendar): /callback hit reqId=${reqId}`, { hasCode: Boolean(code), hasState: Boolean(state) });
    if (!code) return res.status(400).send('No code provided from Google.');
    if (!state) return res.status(400).send('Missing state token from OAuth flow.');
    const timeoutMs = 15000;
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`OAuth callback timed out after ${timeoutMs}ms (reqId=${reqId})`)), timeoutMs));
    try {
      const payload = verifyCalendarLink(state);
      if (!payload || !payload.email) return res.status(400).send('Invalid or expired state token.');
      const email = payload.email;
      const config = await CalendarAuthModel.getOAuthConfig();
      const redirectUri = (config.redirect_uris && config.redirect_uris[0]);
      await Promise.race([
        (async () => { await CalendarEventController.authorize(email, code, redirectUri); })(),
        timeoutPromise
      ]);
      return res.send(`<html><body style="font-family: sans-serif; text-align: center; padding-top: 50px;"><h1 style="color: #28a745;">✅ Success!</h1><p>Account <strong>${email}</strong> connected successfully.</p><p>You can close this window now.</p><script>setTimeout(() => window.close(), 3000);</script></body></html>`);
    } catch (err) {
      const msg = err?.message || 'Unknown error';
      const hint = msg.includes('invalid_grant') ? ' (invalid_grant)' : '';
      const isTimeout = msg.includes('timed out');
      return res.status(isTimeout ? 504 : 500).send('Authentication failed: ' + msg + hint + ` (reqId=${reqId})`);
    }
  },

  async getEvents(req, res) {
    try {
      const { email, hoursAhead = '24', platform } = req.body;
      if (!email) return res.status(400).json({ status: 'error', message: 'email required' });
      const now = new Date();
      const future = new Date(now.getTime() + (parseInt(hoursAhead) || 24) * 3600000);
      let events = [];
      try {
        events = await CalendarEventController.getEvents(email, { timeMin: now.toISOString(), timeMax: future.toISOString(), maxResults: 20 });
      } catch (err) { events = []; }
      const filtered = events.filter(e => {
        const link = e.hangoutLink || CalendarHelper.extractMeetingLink(e.description, e.location || '');
        return platform ? CalendarHelper.detectPlatform(link, e.location) === platform : true;
      });
      await CalendarEventController.processAndStoreEvents(email, filtered);
      res.json({ status: 'success', count: filtered.length, eventsAll: events,
        events: filtered.map(e => {
          const link = e.hangoutLink || CalendarHelper.extractMeetingLink(e.description, e.location || '');
          const platformType = CalendarHelper.detectPlatform(link, e.location || '');
          const { meetingId, passcode } = CalendarHelper.extractMeetingId(link, platformType, e.description || '', e.location || '');
          return { id: e.id, title: e.summary, start: e.start.dateTime || e.start.date, end: e.end.dateTime || e.end.date, timezone: e.start.timezone, link, platform: platformType, meetingId, passcode };
        })
      });
    } catch (err) { res.status(500).json({ status: 'error', message: err.message }); }
  }
};

module.exports = controller;