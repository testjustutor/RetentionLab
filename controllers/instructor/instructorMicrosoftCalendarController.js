/**
 * controllers/instructor/instructorMicrosoftCalendarController.js
 * Business logic for instructor Microsoft (Outlook/Teams) Calendar
 * connections. Mirrors controllers/instructor/instructorCalendarController.js
 * (the Google version) method-for-method and endpoint-for-endpoint, but
 * authorizes against the Microsoft identity platform / Graph API via
 * MicrosoftCalendarEventController instead of googleapis.
 *
 * Connections are stored in the same shared calendar_connections table,
 * scoped to the 'teams' calendar_providers row (see
 * models/calendar/MicrosoftCalendarAuthModel.js), so a user can have an
 * independent Google connection AND a Microsoft connection at the same time.
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const CalendarVerificationModel = require('../../models/calendar/CalendarVerificationModel');
const CalendarUsersModel = require('../../models/calendar/CalendarUsersModel');
const UsersModel = require('../../models/users/UsersModel');
const MicrosoftCalendarEventController = require('../calendar/MicrosoftCalendarEventController');
const MicrosoftCalendarAuthModel = require('../../models/calendar/MicrosoftCalendarAuthModel');
const { sendMail } = require('../../utils/mailer');
const { logger } = require('../../utils/logger');

const PROVIDER_NAME = MicrosoftCalendarAuthModel.PROVIDER_NAME; // 'teams'

// ─── Secure token config ───────────────────────────────────────────────────
// Reuses the same signing secret as the Google instructor flow
// (INSTRUCTOR_CALENDAR_SECRET) but with its own JWT `purpose` claim, so a
// Google verify link can never be replayed against the Microsoft callback
// and vice versa.
const VERIFY_SECRET = process.env.INSTRUCTOR_CALENDAR_SECRET || process.env.JWT_SECRET || 'instructor_cal_secure_key_change_me';
const VERIFY_EXPIRES = '30m';
const JWT_PURPOSE = 'instructor-calendar-verify-microsoft';

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

/** Sign a JWT with email + nonce for single-use verification */
function signVerifyToken(email) {
  const nonce = crypto.randomBytes(16).toString('hex');
  return jwt.sign(
    { email, nonce, purpose: JWT_PURPOSE, iat: Math.floor(Date.now() / 1000) },
    VERIFY_SECRET,
    { expiresIn: VERIFY_EXPIRES }
  );
}

/** Verify a JWT token, return payload or null */
function verifyToken(token) {
  try {
    const payload = jwt.verify(token, VERIFY_SECRET);
    if (payload?.purpose !== JWT_PURPOSE) return null;
    return payload;
  } catch { return null; }
}

/**
 * Resolve the OAuth callback ORIGIN. Prefers a configured
 * MICROSOFT_OAUTH_BASE_URL so the redirect_uri sent to Microsoft is
 * deterministic and matches a URI registered in the Azure AD app
 * registration — mirrors instructorCalendarController.js's
 * resolveCallbackBase() (Google's GOOGLE_OAUTH_BASE_URL).
 */
function resolveCallbackBase(req) {
  const configured = process.env.MICROSOFT_OAUTH_BASE_URL;
  if (configured) {
    return String(configured).replace(/\/+$/, '');
  }
  return `${req.protocol || 'http'}://${req.get('host')}`;
}

const controller = {
  /**
   * POST /api/instructor/microsoft-calendar/connections
   * Same shape/semantics as instructorCalendarController.listConnections(),
   * but scoped to the 'teams' provider only (a user's Google connection, if
   * any, never shows up here and vice versa).
   */
  async listConnections(req) {
    try {
      const userRole = req.user?.role_name;
      const userId = req.user?.id;

      if (userRole === 'solo_instructor' || userRole === 'instructor') {
        if (!userId) return ok({ count: 0, data: [] });

        const row = await CalendarUsersModel.getUserByProviderName(userId, PROVIDER_NAME);
        if (!row) return ok({ count: 0, data: [] });

        const hasValidToken = !!(row.access_token && row.connection_status === 'active');

        return ok({
          count: 1,
          data: [{
            email: row.email,
            status: hasValidToken ? 'active' : 'disconnected',
            provider: row.provider || PROVIDER_NAME,
            token_expire_at: row.token_expires_at || null,
            last_synced_at: row.updated_at || null,
            user_id: row.user_id,
            role_name: userRole
          }]
        });
      }

      if (userRole === 'admin' || userRole === 'super_admin') {
        const integrations = await CalendarUsersModel.getAllUsers({
          roles: ['instructor', 'solo_instructor'],
          status: 'active',
          excludeSelf: true,
          adminId: userId
        });

        const connections = (integrations || [])
          .filter(conn => (conn.provider || '').toLowerCase() === PROVIDER_NAME)
          .map(conn => ({
            email: conn.email,
            name: conn.first_name,
            Calendarstatus: (conn.connection_status === 'active' && conn.access_token) ? 'active' : 'disconnected',
            Userstatus: conn.is_active || 'disconnected',
            provider: conn.display_name || null,
            token_expire_at: conn.token_expires_at || null,
            last_synced_at: conn.updated_at || null,
            user_id: conn.user_id,
            role_name: conn.role_name || 'instructor'
          }));

        return ok({ count: connections.length, data: connections });
      }

      return ok({ count: 0, data: [] });
    } catch (e) { return err(e.message); }
  },

  /**
   * POST /api/instructor/microsoft-calendar/send-verification
   * Admin sends encrypted verification link to instructor email.
   * Also reachable admin-side via routes/meetings-calendar.js's
   * /send-verification-microsoft (Admin > People > Users "Connect Microsoft
   * Calendar" button).
   */
  async sendVerification(req) {
    try {
      const { email } = req.body;
      if (!email) return err('Email is required', 400);

      const user = await UsersModel.getUserByEmail(email);
      if (!user) return err('User not found', 404);

      // Super-admin kill switch (Settings > Calendar Integrations) — the
      // 'teams' calendar_providers row is Microsoft Calendar's provider
      // record (see PROVIDER_NAME / CalendarVerificationModel.resolveProviderId).
      // Checked here (not just hidden in the UI) so the admin-triggered
      // send-verification endpoint can't be used to bypass a disabled provider.
      const CalendarProvidersModel = require('../../models/calendar/CalendarProvidersModel');
      const msProviderRows = await CalendarProvidersModel.getByName(PROVIDER_NAME);
      const msProvider = msProviderRows && msProviderRows[0];
      if (!msProvider || !msProvider.is_active) {
        return err('Microsoft Calendar integration is currently disabled by the administrator.', 403);
      }

      const token = signVerifyToken(email);
      await CalendarVerificationModel.create(user.id, PROVIDER_NAME, token);

      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host || 'localhost:3000';
      const verifyUrl = `${protocol}://${host}/api/instructor/microsoft-calendar/verify?token=${encodeURIComponent(token)}`;

      try {
        await sendMail({
          to: email,
          subject: 'RetentionLab — Connect Your Microsoft Calendar',
          html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Connect Your Microsoft Calendar</title>
            </head>
            <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background-color:#f8fafc;color:#334155;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
                <tr>
                  <td align="center">
                    <table role="presentation" width="100%" max-width="600px" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
                      <tr>
                        <td style="background:linear-gradient(135deg,#4b53bc,#2d3086);padding:32px 24px;text-align:center;">
                          <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:700;">RetentionLab</h1>
                          <p style="margin:8px 0 0;color:#e0e7ff;font-size:14px;">Meeting Intelligence Platform</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:20px 24px 0 24px;text-align:center;">
                          <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;">
                            <strong style="color:#4b53bc;">www.retentionlab.com</strong> &nbsp;|&nbsp;
                            <a href="mailto:support@retentionlab.com" style="color:#4b53bc;text-decoration:none;">support@retentionlab.com</a>
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:32px 24px;">
                          <h2 style="margin:0 0 16px 0;font-size:20px;color:#4b53bc;font-weight:600;">Connect Your Microsoft Calendar</h2>
                          <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#475569;">
                            Your administrator has invited you to connect your Microsoft (Outlook/Teams) Calendar to RetentionLab. This allows us to automatically sync your meetings for evaluation and insights.
                          </p>
                          <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#475569;">
                            Click the button below to authorize access. This is a <strong>secure, one-time link</strong> that expires in 30 minutes.
                          </p>
                          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px auto;">
                            <tr>
                              <td style="background:linear-gradient(135deg,#4b53bc,#2d3086);border-radius:10px;padding:14px 32px;">
                                <a href="${verifyUrl}" style="display:inline-block;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.3px;">Verify &amp; Connect Calendar</a>
                              </td>
                            </tr>
                          </table>
                          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                            This link is unique to your email address. Do not share it with anyone. If you did not request this, please ignore this email.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:24px;text-align:center;background-color:#f8fafc;">
                          <p style="margin:0 0 8px 0;font-size:12px;color:#64748b;line-height:1.5;">
                            <strong style="color:#4b53bc;">RetentionLab</strong> &middot; Meeting Intelligence Platform
                          </p>
                          <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">
                            &copy; 2026 RetentionLab. All rights reserved.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
          purpose: 'calendar_integration'
        });
        logger.info(`[InstructorMicrosoftCalendar] Verification email sent to ${email}`);
      } catch (mailErr) {
        logger.warn(`[InstructorMicrosoftCalendar] Email failed for ${email}:`, mailErr.message);
      }

      return ok({ email }, 'Verification link sent to ' + email);
    } catch (e) { return err(e.message); }
  },

  /**
   * POST /api/instructor/microsoft-calendar/self-request
   * Public — registered instructor submits their email to self-integrate
   * their Microsoft calendar.
   */
  async selfRequest(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
      }

      // Super-admin kill switch (Settings > Calendar Integrations) — see the
      // matching check in sendVerification() above for why this looks up
      // PROVIDER_NAME ('teams') specifically.
      const CalendarProvidersModel = require('../../models/calendar/CalendarProvidersModel');
      const msProviderRows = await CalendarProvidersModel.getByName(PROVIDER_NAME);
      const msProvider = msProviderRows && msProviderRows[0];
      if (!msProvider || !msProvider.is_active) {
        return res.status(403).json({ success: false, error: 'Microsoft Calendar integration is currently disabled by the administrator.' });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const user = await UsersModel.getUserByEmail(normalizedEmail);

      if (!user) {
        return res.status(403).json({ success: false, error: 'Email not found. Please contact your administrator.' });
      }

      const allowedRoles = ['instructor', 'solo_instructor'];
      if (!allowedRoles.includes(user.role_name)) {
        return res.status(403).json({ success: false, error: 'Only instructors can connect their calendar. Please contact your administrator.' });
      }

      if (user.status !== 'active' || !user.is_active) {
        return res.status(403).json({ success: false, error: 'Your account is not active. Please contact your administrator.' });
      }

      const token = signVerifyToken(normalizedEmail);
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host || 'localhost:3000';
      const verifyUrl = `${protocol}://${host}/api/instructor/microsoft-calendar/verify?token=${encodeURIComponent(token)}`;

      logger.info(`[InstructorMicrosoftCalendar] selfRequest: approved email=${normalizedEmail} userId=${user.id}`);
      return res.json({ success: true, redirectUrl: verifyUrl });
    } catch (e) {
      logger.error('[InstructorMicrosoftCalendar] selfRequest error:', e);
      return res.status(500).json({ success: false, error: e.message });
    }
  },

  /** GET /api/instructor/microsoft-calendar/verify?token=JWT (public) */
  async verifyToken(req, res) {
    try {
      const { token } = req.query;
      if (!token) return res.status(400).send(`<html><body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:50px;background:#ffffff;color:#334155;"><h2 style="color:#ef4444;">Missing verification token</h2></body></html>`);

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(400).send(`
          <html><body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:50px;background:#ffffff;color:#334155;">
            <h2 style="color:#ef4444;">Link Expired or Invalid</h2>
            <p style="color:#64748b;">This verification link is no longer valid. Please request a new one from your administrator.</p>
          </body></html>
        `);
      }

      const email = payload.email;

      try {
        await CalendarVerificationModel.verifyToken(token);
      } catch (e) {
        logger.warn('[InstructorMicrosoftCalendar] Failed to update verification status:', e.message);
      }

      const baseUrl = resolveCallbackBase(req);
      const instructorCallbackUrl = `${baseUrl}/api/instructor/microsoft-calendar/callback`;

      logger.info(`[InstructorMicrosoftCalendar] verifyToken: email=${email} baseUrl=${baseUrl} callbackUrl=${instructorCallbackUrl}`);

      // Pass the SAME state token already verified above (`token`) instead of
      // a freshly-signed one, so the callback can look up the exact same
      // calendar_connections row created by CalendarVerificationModel.create()
      // — matches the Google flow, which passes `state: token` for the same reason.
      const authUrl = await MicrosoftCalendarEventController.getAuthUrl(email, instructorCallbackUrl, token);

      return res.send(`
        <html>
          <head><meta http-equiv="refresh" content="0; url=${authUrl}"></head>
          <body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:50px;background:#ffffff;color:#334155;">
            <div style="max-width:400px;margin:auto;">
              <div style="font-size:48px;margin-bottom:16px;">&#x2705;</div>
              <h2 style="color:#4b53bc;">Verification Successful</h2>
              <p style="color:#64748b;">Redirecting to Microsoft for authorization...</p>
            </div>
          </body>
        </html>
      `);
    } catch (e) {
      logger.error('[InstructorMicrosoftCalendar] Verify error:', e);
      return res.status(500).send(`<html><body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:50px;background:#ffffff;color:#334155;"><h2 style="color:#ef4444;">Verification failed</h2><p style="color:#64748b;">${e.message}</p></body></html>`);
    }
  },

  /** GET /api/instructor/microsoft-calendar/callback (public — Microsoft redirects here) */
  async handleCallback(req, res) {
    try {
      const { code, state, error, error_description } = req.query;

      if (error) {
        logger.warn(`[InstructorMicrosoftCalendar] handleCallback: Microsoft returned error=${error} desc=${error_description}`);
        return res.status(400).send(`<html><body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:50px;background:#ffffff;color:#334155;"><h2 style="color:#ef4444;">Authorization failed</h2><p style="color:#64748b;">${escapeHtml(error_description || error)}</p></body></html>`);
      }
      if (!code) {
        return res.status(400).send(`<html><body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:50px;background:#ffffff;color:#334155;"><h2 style="color:#ef4444;">No authorization code received</h2></body></html>`);
      }
      if (!state) {
        return res.status(400).send(`<html><body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:50px;background:#ffffff;color:#334155;"><h2 style="color:#ef4444;">Missing state token</h2></body></html>`);
      }

      const payload = verifyToken(state);

      try {
        await CalendarVerificationModel.verifyToken(state);
      } catch (e) {
        logger.warn('[InstructorMicrosoftCalendar] handleCallback: failed to mark calendar_connections verified:', e.message);
      }

      if (!payload || !payload.email) {
        return res.status(400).send(`<html><body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:50px;background:#ffffff;color:#334155;"><h2 style="color:#ef4444;">Invalid or expired state token</h2></body></html>`);
      }

      const email = payload.email;
      const baseUrl = resolveCallbackBase(req);
      const redirectUri = `${baseUrl}/api/instructor/microsoft-calendar/callback`;

      logger.info(`[InstructorMicrosoftCalendar] handleCallback: exchanging code for tokens email=${email}`);
      await MicrosoftCalendarEventController.authorize(email, code, redirectUri);

      // authorize() already creates/updates the user + saves tokens; mirror
      // Google's controller by also ensuring role_id=3 + email verified.
      const user = await UsersModel.getUserByEmail(email);
      if (user && (user.role_id !== 3 || !user.email_verified)) {
        await UsersModel.updateUser(user.id, {
          role_id: 3,
          email_verified: 1,
          email_verified_at: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' })
        });
      }

      return res.send(`
        <html>
          <body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:60px;background:#ffffff;color:#334155;">
            <div style="max-width:400px;margin:auto;">
              <div style="font-size:48px;margin-bottom:16px;">&#x2705;</div>
              <h1 style="color:#16a34a;font-size:24px;margin:0 0 8px;">Connected!</h1>
              <p style="font-size:14px;color:#64748b;">Your Microsoft Calendar (<strong>${escapeHtml(email)}</strong>) is now connected to RetentionLab.</p>
              <p style="font-size:12px;color:#94a3b8;">You can close this window.</p>
              <script>setTimeout(() => window.close(), 4000);</script>
            </div>
          </body>
        </html>
      `);
    } catch (e) {
      logger.error('[InstructorMicrosoftCalendar] Callback error:', e);
      return res.status(500).send(`<html><body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:50px;background:#ffffff;color:#334155;"><h2 style="color:#ef4444;">Connection failed</h2><p style="color:#64748b;">${escapeHtml(e.message)}</p></body></html>`);
    }
  },

  /** POST /api/instructor/microsoft-calendar/disconnect */
  async disconnect(req) {
    try {
      const { email, user_id } = req.body;
      if (!email && !user_id) return err('Email or user_id is required', 400);

      let userId = user_id;
      if (!userId && email) {
        const user = await UsersModel.getUserByEmail(email);
        if (!user) return err('User not found', 404);
        userId = user.id;
      }

      // Only remove the Microsoft ('teams') connection row — a Google
      // connection for the same user, if any, is untouched.
      await CalendarUsersModel.deleteUserProvider(userId, PROVIDER_NAME);
      return ok({}, 'Microsoft calendar disconnected');
    } catch (e) { return err(e.message); }
  },

  /** GET /api/instructor/microsoft-calendar/status/:emailOrUserId */
  async getStatus(req) {
    try {
      const { emailOrUserId } = req.params;
      if (!emailOrUserId) return err('Email or user_id is required', 400);

      let userId = emailOrUserId;
      if (isNaN(emailOrUserId)) {
        const user = await UsersModel.getUserByEmail(emailOrUserId);
        if (!user) return err('User not found', 404);
        userId = user.id;
      }

      const integration = await CalendarUsersModel.getUserByProviderName(userId, PROVIDER_NAME);
      return ok({
        user_id: userId,
        email: integration?.email || null,
        connected: !!integration,
        status: integration ? (integration.connection_status || 'active') : 'not_connected',
        updated_at: integration ? integration.updated_at : null
      });
    } catch (e) { return err(e.message); }
  },

  /**
   * POST /api/instructor/microsoft-calendar/sync
   * Sync Microsoft calendar meetings to local database.
   */
  async syncCalendar(req) {
    try {
      const user = req.user;
      const { daysBack = 30, daysForward = 90 } = req.body;

      const { syncMicrosoftCalendar } = require('../../services/calendarSyncService');

      let syncResults = [];

      if (user.role_name === 'instructor' || user.role_name === 'solo_instructor') {
        const result = await syncMicrosoftCalendar(user.email, user.id, daysBack, daysForward);
        syncResults.push({ email: user.email, ...result });
      } else if (user.role_name === 'admin' || user.role_name === 'super_admin') {
        const usersResult = await UsersModel.listUsers(user, { limit: 1000 });
        const allUsers = usersResult.rows || [];
        const instructors = allUsers.filter(u =>
          u.role_name === 'instructor' || u.role_name === 'solo_instructor'
        );

        for (const instructor of instructors) {
          try {
            const result = await syncMicrosoftCalendar(instructor.email, instructor.id, daysBack, daysForward);
            syncResults.push({ email: instructor.email, ...result });
          } catch (e) {
            logger.error(`[InstructorMicrosoftCalendar] Failed to sync ${instructor.email}:`, e);
            syncResults.push({ email: instructor.email, error: e.message });
          }
        }
      }

      const totalSynced = syncResults.reduce((sum, r) => sum + (r.synced || 0), 0);
      return ok({
        message: `Synced ${totalSynced} meetings`,
        results: syncResults
      });
    } catch (e) { return err(e.message); }
  }
};

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = controller;
