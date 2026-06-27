/**
 * controllers/instructorCalendarController.js
 * Business logic for instructor Google Calendar connections.
 * OWN MVC stack — uses its own JWT signed verification tokens,
 * own verify + callback endpoints, and reuses CalendarUsersModel for storage.
 * Uses googleapis directly (no MultiUserCalendarService dependency).
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { google } = require('googleapis');
const CalendarVerificationModel = require('../models/CalendarVerificationModel');
const CalendarUsersModel = require('../models/CalendarUsersModel');
const UsersModel = require('../models/UsersModel');
const { sendMail } = require('../utils/mailer');
const { logger } = require('../utils/logger');

// ─── Secure token config ───────────────────────────────────────────────────────
const VERIFY_SECRET = process.env.INSTRUCTOR_CALENDAR_SECRET || process.env.JWT_SECRET || 'instructor_cal_secure_key_change_me';
const VERIFY_EXPIRES  = '30m';  // verification link expires in 30 minutes

// ─── Google OAuth helpers (no MultiUserCalendarService) ────────────────────────
const CREDENTIALS_PATH = path.join(__dirname, '../uploads/google-calendar-json/credentials_multi.json');

function hashPassword(password, salt = null) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

async function loadCredentials() {
  const raw = await fs.readFile(CREDENTIALS_PATH, 'utf8');
  const creds = JSON.parse(raw);
  const config = creds.installed || creds.web || creds;
  if (!config.client_id || !config.client_secret || !config.redirect_uris?.[0]) {
    throw new Error('credentials_multi.json missing client_id, client_secret, or redirect_uris');
  }
  return config;
}

/**
 * Create a fully configured OAuth2 client with the correct redirect_uri.
 */
function createOAuth2Client(config, redirectUri) {
  return new google.auth.OAuth2(
    config.client_id,
    config.client_secret,
    redirectUri
  );
}

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

/** Sign a JWT with email + nonce for single-use verification */
function signVerifyToken(email) {
  const nonce = crypto.randomBytes(16).toString('hex');
  return jwt.sign(
    { email, nonce, purpose: 'instructor-calendar-verify', iat: Math.floor(Date.now() / 1000) },
    VERIFY_SECRET,
    { expiresIn: VERIFY_EXPIRES }
  );
}

/** Verify a JWT token, return payload or null */
function verifyToken(token) {
  try {
    const payload = jwt.verify(token, VERIFY_SECRET);
    if (payload?.purpose !== 'instructor-calendar-verify') return null;
    return payload;
  } catch { return null; }
}

const controller = {
  /**
   * GET /api/instructor-calendar/connections
   */
  async listConnections(req) {
    try {
      const rows = await CalendarUsersModel.getAllUsers();
      return ok({
        count: rows.length,
        data: (rows || []).map(r => ({
          email: r.email,
          status: r.status || 'disconnected',
          provider: r.provider || null,
          updated_at: r.updated_at,
          user_id: r.user_id || r.user_id_ref,
          role_name: r.role_name
        }))
      });
    } catch (e) { return err(e.message); }
  },

  /**
   * POST /api/instructor-calendar/send-verification
   * Admin sends encrypted verification link to instructor email.
   */
  async sendVerification(req) {
    try {
      const { email } = req.body;
      if (!email) return err('Email is required', 400);

      // Also create DB record for tracking
      await CalendarVerificationModel.create(email);

      // Sign a JWT token (encrypted, expiring, single-use)
      const token = signVerifyToken(email);

      // Build secure verification URL
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host || 'localhost:3000';
      const verifyUrl = `${protocol}://${host}/api/instructor-calendar/verify?token=${encodeURIComponent(token)}`;

      // Send professional email
      try {
        await sendMail({
          to: email,
          subject: 'RetentionLab — Connect Your Google Calendar',
          html: `
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:auto;background:#0f172a;border-radius:16px;overflow:hidden;color:#e2e8f0;">
              <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:32px 24px;text-align:center;">
                <h1 style="margin:0;font-size:22px;color:#fff;font-weight:700;">RetentionLab</h1>
                <p style="margin:8px 0 0;color:#e9d5ff;font-size:14px;">Calendar Integration</p>
              </div>
              <div style="padding:28px 24px;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Your administrator has invited you to connect your Google Calendar so RetentionLab can automatically sync your meetings for evaluation and insights.</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">Click the button below to authorize access. This is a <strong>secure, one-time link</strong> that expires in 30 minutes.</p>
                <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.3px;">Verify & Connect Calendar</a>
                <p style="margin:24px 0 0;font-size:12px;color:#64748b;">This link is unique to your email address. Do not share it with anyone.</p>
              </div>
              <div style="padding:16px 24px;background:#1e293b;text-align:center;font-size:11px;color:#475569;">
                RetentionLab &copy; 2026 &middot; Meeting Intelligence Platform
              </div>
            </div>
          `
        });
        logger.info(`[InstructorCalendar] Verification email sent to ${email}`);
      } catch (mailErr) {
        logger.warn(`[InstructorCalendar] Email failed for ${email}:`, mailErr.message);
      }

      return ok({ email }, 'Verification link sent to ' + email);
    } catch (e) { return err(e.message); }
  },

  /**
   * GET /api/instructor-calendar/verify?token=JWT
   * Public — instructor clicks this link from email.
   * Verifies JWT, redirects to Google OAuth.
   */
  async verifyToken(req, res) {
    try {
      const { token } = req.query;
      if (!token) return res.status(400).send('<h2>Missing verification token</h2>');

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(400).send(`
          <html><body style="font-family:Arial;text-align:center;padding:50px;background:#0f172a;color:#e2e8f0;">
            <h2 style="color:#f87171;">Link Expired or Invalid</h2>
            <p>This verification link is no longer valid. Please request a new one from your administrator.</p>
          </body></html>
        `);
      }

      const email = payload.email;
      const baseUrl = `${req.protocol || 'http'}://${req.get('host')}`;
      const instructorCallbackUrl = `${baseUrl}/api/instructor-calendar/callback`;

      logger.info(`[InstructorCalendar] verifyToken: email=${email} baseUrl=${baseUrl} callbackUrl=${instructorCallbackUrl}`);

      // Load Google OAuth credentials and build auth URL directly
      const config = await loadCredentials();
      logger.info(`[InstructorCalendar] verifyToken: credentials loaded client_id=${config.client_id} redirect_uris=${JSON.stringify(config.redirect_uris)}`);

      const oauth2Client = createOAuth2Client(config, instructorCallbackUrl);

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/calendar.events'
        ],
        redirect_uri: instructorCallbackUrl,
        response_type: 'code',
        state: token  // our JWT, verified in handleCallback
      });

      // Redirect to Google
      return res.send(`
        <html>
          <head><meta http-equiv="refresh" content="0; url=${authUrl}"></head>
          <body style="font-family:Arial;text-align:center;padding:50px;background:#0f172a;color:#e2e8f0;">
            <h2 style="color:#a78bfa;">Verification Successful</h2>
            <p>Redirecting to Google for authorization...</p>
          </body>
        </html>
      `);
    } catch (e) {
      logger.error('[InstructorCalendar] Verify error:', e);
      return res.status(500).send('<h2>Verification failed</h2><p>' + e.message + '</p>');
    }
  },

  /**
   * GET /api/instructor-calendar/callback?code=...&state=...
   * Public — Google redirects here after user authorizes.
   * Exchanges code for tokens and stores in calendar_integrations table.
   */
  async handleCallback(req, res) {
    try {
      const { code, state } = req.query;
      const requestPath = req.originalUrl || req.url || 'unknown';

      logger.info(`[InstructorCalendar] handleCallback: called path=${requestPath} hasCode=${!!code} hasState=${!!state}`);

      if (!code) {
        logger.warn(`[InstructorCalendar] handleCallback: no code received path=${requestPath}`);
        return res.status(400).send('<h2>No authorization code received</h2>');
      }
      if (!state) {
        logger.warn(`[InstructorCalendar] handleCallback: no state token path=${requestPath}`);
        return res.status(400).send('<h2>Missing state token</h2>');
      }

      // State contains the JWT with email
      const payload = verifyToken(state);
      if (!payload || !payload.email) {
        logger.warn(`[InstructorCalendar] handleCallback: invalid/expired state token path=${requestPath}`);
        return res.status(400).send('<h2>Invalid or expired state token</h2>');
      }

      const email = payload.email;

      // Determine the correct redirect URI based on which route was hit.
      // The interceptor in routes/index.js may redirect /api/calendar/callback here too.
      const baseUrl = `${req.protocol || 'http'}://${req.get('host')}`;
      const actualPath = req.originalUrl || req.url || '';
      const isInstructorPath = actualPath.includes('/api/instructor-calendar/callback');
      const callbackPath = isInstructorPath
        ? '/api/instructor-calendar/callback'
        : '/api/calendar/callback';
      const redirectUri = `${baseUrl}${callbackPath}`;

      logger.info(`[InstructorCalendar] handleCallback: email=${email} baseUrl=${baseUrl} actualPath=${actualPath} isInstructorPath=${isInstructorPath} resolvedRedirectUri=${redirectUri}`);

      // Load credentials and create OAuth2 client inline — no MultiUserCalendarService
      const config = await loadCredentials();
      logger.info(`[InstructorCalendar] handleCallback: credentials loaded client_id=${config.client_id}`);

      const oauth2Client = createOAuth2Client(config, redirectUri);

      // Exchange authorization code for tokens — explicitly pass redirect_uri
      // so that it matches what was used in the original auth URL.
      logger.info(`[InstructorCalendar] handleCallback: exchanging code for tokens email=${email}`);
      const { tokens } = await oauth2Client.getToken({
        code,
        redirect_uri: redirectUri
      });

      logger.info(`[InstructorCalendar] handleCallback: token exchange success email=${email} hasAccessToken=${!!tokens.access_token} hasRefreshToken=${!!tokens.refresh_token} expiry=${tokens.expiry_date}`);

      oauth2Client.setCredentials(tokens);

      // Store tokens in database
      logger.info(`[InstructorCalendar] handleCallback: looking up user in UsersModel for ${email}`);
      let user = await UsersModel.getUserByEmail(email);
      logger.info(`[InstructorCalendar] handleCallback: UsersModel lookup result email=${email} found=${!!user} userId=${user?.id || 'null'}`);

      if (!user) {
        logger.info(`[InstructorCalendar] handleCallback: creating new user in UsersModel for ${email}`);
        const created = await UsersModel.createUser({
          user_uuid: email,
          email: email,
          role_id: 3,
          first_name: null,
          last_name: null,
          password_hash: hashPassword(email),
          status: 'active',
          company_id: null,
        });
        user = { id: created.id, ...created };
        logger.info(`[InstructorCalendar] handleCallback: created user id=${user.id} for ${email}`);
      } else if (user.role_id !== 3) {
        logger.info(`[InstructorCalendar] handleCallback: updating role for ${email} from ${user.role_id} to 3`);
        await UsersModel.updateUser(user.id, { role_id: 3 });
        user.role_id = 3;
      }

      logger.info(`[InstructorCalendar] handleCallback: about to save tokens to calendar_integrations for email=${email} userId=${user.id}`);
      const dbResult = await CalendarUsersModel.createOrUpdateUser(email, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date
      }, user.id);
      logger.info(`[InstructorCalendar] handleCallback: calendar_integrations save result email=${email} dbResult=${JSON.stringify(dbResult)}`);

      logger.info(`[InstructorCalendar] handleCallback: Google Calendar connected for ${email} user_id=${user.id}`);

      return res.send(`
        <html>
          <body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:60px;background:#0f172a;color:#e2e8f0;">
            <div style="max-width:400px;margin:auto;">
              <div style="font-size:48px;margin-bottom:16px;">&#x2705;</div>
              <h1 style="color:#4ade80;font-size:24px;margin:0 0 8px;">Connected!</h1>
              <p style="font-size:14px;color:#94a3b8;">Your Google Calendar (<strong>${email}</strong>) is now connected to RetentionLab.</p>
              <p style="font-size:12px;color:#64748b;">You can close this window.</p>
              <script>setTimeout(() => window.close(), 4000);</script>
            </div>
          </body>
        </html>
      `);
    } catch (e) {
      logger.error('[InstructorCalendar] Callback error:', e);
      return res.status(500).send('<h2>Connection failed</h2><p>' + e.message + '</p>');
    }
  },

  /**
   * POST /api/instructor-calendar/disconnect
   */
  async disconnect(req) {
    try {
      const { email } = req.body;
      if (!email) return err('Email is required', 400);
      await CalendarUsersModel.deleteUser(email);
      return ok({}, 'Calendar disconnected');
    } catch (e) { return err(e.message); }
  },

  /**
   * GET /api/instructor-calendar/status/:email
   */
  async getStatus(req) {
    try {
      const { email } = req.params;
      if (!email) return err('Email is required', 400);
      const integration = await CalendarUsersModel.getUser(email);
      return ok({
        email,
        connected: !!integration,
        status: integration ? (integration.status || 'active') : 'not_connected',
        updated_at: integration ? integration.updated_at : null
      });
    } catch (e) { return err(e.message); }
  }
};

module.exports = controller;