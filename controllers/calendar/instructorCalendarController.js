/**
 * controllers/calendar/instructorCalendarController.js
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
const CalendarVerificationModel = require('../../models/calendar/CalendarVerificationModel');
const CalendarUsersModel = require('../../models/calendar/CalendarUsersModel');
const UsersModel = require('../../models/users/UsersModel');
const GoogleOAuthCredentialsModel = require('../../models/calendar/GoogleOAuthCredentialsModel');
const { sendMail } = require('../../utils/mailer');
const { logger } = require('../../utils/logger');

// ─── Secure token config ───────────────────────────────────────────────────────
const VERIFY_SECRET = process.env.INSTRUCTOR_CALENDAR_SECRET || process.env.JWT_SECRET || 'instructor_cal_secure_key_change_me';
const VERIFY_EXPIRES  = '30m';  // verification link expires in 30 minutes

function hashPassword(password, salt = null) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

async function loadCredentials() {
  const config = await GoogleOAuthCredentialsModel.getConfig();
  if (!config || !config.client_id || !config.client_secret || !config.redirect_uris?.[0]) {
    throw new Error('No active Google OAuth credentials found in database. Run: npm run seed:google-credentials');
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
   * Returns calendar connections based on user role:
   * - Admin: Returns all instructor calendar connections in their company
   * - Instructor/SoloInstructor: Returns only their own connection
   */
  async listConnections(req) {
    try {
      const userRole = req.user?.role_name;
      const userId = req.user?.id;

      // For solo_instructor or instructor: return only their own connection
      if (userRole === 'solo_instructor' || userRole === 'instructor') {
        if (!userId) {
          return ok({ count: 0, data: [] });
        }

        const row = await CalendarUsersModel.getUser(userId);
        if (!row) {
          return ok({ count: 0, data: [] });
        }

        return ok({
          count: 1,
          data: [{
            email: row.email,
            status: row.status || 'disconnected',
            provider: row.provider || null,
            updated_at: row.updated_at,
            user_id: row.user_id,
            role_name: userRole
          }]
        });
      }

      // For admin: return all instructor connections in their company
      if (userRole === 'admin' || userRole === 'super_admin') {
        // Get all calendar integrations directly from CalendarUsersModel
        // This gets all connected instructors regardless of who created them
        const integrations = await CalendarUsersModel.getAllUsers({
          roles: ['instructor', 'solo_instructor'],
          status: 'active',
          excludeSelf: true,
          adminId: userId
        });

        const connections = (integrations || []).map(conn => ({
          email: conn.email,
          status: conn.status || 'disconnected',
          provider: conn.provider || null,
          updated_at: conn.updated_at,
          user_id: conn.user_id,
          role_name: conn.role_name || 'instructor'
        }));

        return ok({
          count: connections.length,
          data: connections
        });
      }

      // Default: return empty
      return ok({ count: 0, data: [] });
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

      // Look up user by email to get user_id
      const user = await UsersModel.getUserByEmail(email);
      if (!user) {
        return err('User not found', 404);
      }

      // Sign a JWT token (encrypted, expiring, single-use)
      // NOTE: This JWT MUST be the same value stored in calendar_verifications.token,
      // otherwise verifyToken() cannot find the row and status will stay 'pending'.
      const token = signVerifyToken(email);

      // Create DB record for tracking using the SAME token value
      await CalendarVerificationModel.create(user.id, 'google', token);


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
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Connect Your Google Calendar</title>
            </head>
            <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background-color:#f8fafc;color:#334155;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
                <tr>
                  <td align="center">
                    <table role="presentation" width="100%" max-width="600px" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
                      <!-- Header with branding -->
                      <tr>
                        <td style="background:linear-gradient(135deg,#1f65c2,#1b4f97);padding:32px 24px;text-align:center;">
                          <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:700;">RetentionLab</h1>
                          <p style="margin:8px 0 0;color:#e0f2fe;font-size:14px;">Meeting Intelligence Platform</p>
                        </td>
                      </tr>
                      <!-- Website info top -->
                      <tr>
                        <td style="padding:20px 24px 0 24px;text-align:center;">
                          <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;">
                            <strong style="color:#1f65c2;">www.retentionlab.com</strong> &nbsp;|&nbsp;
                            <a href="mailto:support@retentionlab.com" style="color:#1f65c2;text-decoration:none;">support@retentionlab.com</a>
                          </p>
                        </td>
                      </tr>
                      <!-- Main content -->
                      <tr>
                        <td style="padding:32px 24px;">
                          <h2 style="margin:0 0 16px 0;font-size:20px;color:#1f65c2;font-weight:600;">Connect Your Google Calendar</h2>
                          <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#475569;">
                            Your administrator has invited you to connect your Google Calendar to RetentionLab. This allows us to automatically sync your meetings for evaluation and insights.
                          </p>
                          <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#475569;">
                            Click the button below to authorize access. This is a <strong>secure, one-time link</strong> that expires in 30 minutes.
                          </p>
                          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px auto;">
                            <tr>
                              <td style="background:linear-gradient(135deg,#1f65c2,#1b4f97);border-radius:10px;padding:14px 32px;">
                                <a href="${verifyUrl}" style="display:inline-block;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.3px;">Verify & Connect Calendar</a>
                              </td>
                            </tr>
                          </table>
                          <p style="margin:0 0 8px 0;font-size:13px;color:#64748b;line-height:1.5;">
                            <strong>Why connect your calendar?</strong>
                          </p>
                          <ul style="margin:0 0 16px 0;padding-left:20px;font-size:13px;color:#64748b;line-height:1.6;">
                            <li>Automatic meeting sync and session tracking</li>
                            <li>AI-powered session quality analysis</li>
                            <li>Real-time insights and coaching feedback</li>
                          </ul>
                          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                            This link is unique to your email address. Do not share it with anyone. If you did not request this, please ignore this email.
                          </p>
                        </td>
                      </tr>
                      <!-- Divider -->
                      <tr>
                        <td style="padding:0 24px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;">
                            <tr><td style="font-size:0;line-height:0;">&nbsp;</td></tr>
                          </table>
                        </td>
                      </tr>
                      <!-- Footer with website details -->
                      <tr>
                        <td style="padding:24px;text-align:center;background-color:#f8fafc;">
                          <p style="margin:0 0 8px 0;font-size:12px;color:#64748b;line-height:1.5;">
                            <strong style="color:#1f65c2;">RetentionLab</strong> &middot; Meeting Intelligence Platform
                          </p>
                          <p style="margin:0 0 8px 0;font-size:11px;color:#94a3b8;line-height:1.5;">
                            <a href="https://www.retentionlab.com" style="color:#1f65c2;text-decoration:none;">www.retentionlab.com</a> &nbsp;|&nbsp;
                            <a href="mailto:support@retentionlab.com" style="color:#1f65c2;text-decoration:none;">support@retentionlab.com</a>
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
        logger.info(`[InstructorCalendar] Verification email sent to ${email}`);
      } catch (mailErr) {
        logger.warn(`[InstructorCalendar] Email failed for ${email}:`, mailErr.message);
      }

      return ok({ email }, 'Verification link sent to ' + email);
    } catch (e) { return err(e.message); }
  },

  /**
   * POST /api/instructor-calendar/self-request
   * Public — registered instructor submits their email to self-integrate calendar.
   */
  async selfRequest(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
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
      const verifyUrl = `${protocol}://${host}/api/instructor-calendar/verify?token=${encodeURIComponent(token)}`;

      logger.info(`[InstructorCalendar] selfRequest: approved email=${normalizedEmail} userId=${user.id}`);
      return res.json({ success: true, redirectUrl: verifyUrl });
    } catch (e) {
      logger.error('[InstructorCalendar] selfRequest error:', e);
      return res.status(500).json({ success: false, error: e.message });
    }
  },

  /** GET /api/instructor-calendar/verify?token=JWT */
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
        logger.warn('[InstructorCalendar] Failed to update verification status:', e.message);
      }
      const baseUrl = `${req.protocol || 'http'}://${req.get('host')}`;
      const instructorCallbackUrl = `${baseUrl}/api/instructor-calendar/callback`;

      logger.info(`[InstructorCalendar] verifyToken: email=${email} baseUrl=${baseUrl} callbackUrl=${instructorCallbackUrl}`);

      const config = await loadCredentials();
      logger.info(`[InstructorCalendar] verifyToken: credentials loaded redirect_uris=${JSON.stringify(config.redirect_uris)}`);

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
        state: token
      });

      return res.send(`
        <html>
          <head><meta http-equiv="refresh" content="0; url=${authUrl}"></head>
          <body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:50px;background:#ffffff;color:#334155;">
            <div style="max-width:400px;margin:auto;">
              <div style="font-size:48px;margin-bottom:16px;">&#x2705;</div>
              <h2 style="color:#1f65c2;">Verification Successful</h2>
              <p style="color:#64748b;">Redirecting to Google for authorization...</p>
            </div>
          </body>
        </html>
      `);
    } catch (e) {
      logger.error('[InstructorCalendar] Verify error:', e);
      return res.status(500).send(`<html><body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:50px;background:#ffffff;color:#334155;"><h2 style="color:#ef4444;">Verification failed</h2><p style="color:#64748b;">${e.message}</p></body></html>`);
    }
  },

  /** GET /api/instructor-calendar/callback */
  async handleCallback(req, res) {
    try {
      const { code, state } = req.query;
      const requestPath = req.originalUrl || req.url || 'unknown';

      logger.info(`[InstructorCalendar] handleCallback: called path=${requestPath} hasCode=${!!code} hasState=${!!state}`);

      if (!code) {
        logger.warn(`[InstructorCalendar] handleCallback: no code received path=${requestPath}`);
        return res.status(400).send(`<html><body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:50px;background:#ffffff;color:#334155;"><h2 style="color:#ef4444;">No authorization code received</h2></body></html>`);
      }
      if (!state) {
        logger.warn(`[InstructorCalendar] handleCallback: no state token path=${requestPath}`);
        return res.status(400).send(`<html><body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:50px;background:#ffffff;color:#334155;"><h2 style="color:#ef4444;">Missing state token</h2></body></html>`);
      }

      const payload = verifyToken(state);

      try {
        await CalendarVerificationModel.verifyToken(state);
      } catch (e) {
        logger.warn('[InstructorCalendar] handleCallback: failed to mark calendar_verification verified:', e.message);
      }

      if (!payload || !payload.email) {
        logger.warn(`[InstructorCalendar] handleCallback: invalid/expired state token path=${requestPath}`);
        return res.status(400).send(`<html><body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:50px;background:#ffffff;color:#334155;"><h2 style="color:#ef4444;">Invalid or expired state token</h2></body></html>`);
      }

      const email = payload.email;

      const baseUrl = `${req.protocol || 'http'}://${req.get('host')}`;
      const actualPath = req.originalUrl || req.url || '';
      const isInstructorPath = actualPath.includes('/api/instructor-calendar/callback');
      const callbackPath = isInstructorPath
        ? '/api/instructor-calendar/callback'
        : '/api/calendar/callback';
      const redirectUri = `${baseUrl}${callbackPath}`;

      logger.info(`[InstructorCalendar] handleCallback: email=${email} baseUrl=${baseUrl} actualPath=${actualPath} isInstructorPath=${isInstructorPath} resolvedRedirectUri=${redirectUri}`);

      const config = await loadCredentials();
      logger.info(`[InstructorCalendar] handleCallback: credentials loaded for email=${email}`);

      const oauth2Client = createOAuth2Client(config, redirectUri);

      logger.info(`[InstructorCalendar] handleCallback: exchanging code for tokens email=${email}`);
      const { tokens } = await oauth2Client.getToken({
        code,
        redirect_uri: redirectUri
      });

      oauth2Client.setCredentials(tokens);

      logger.info(`[InstructorCalendar] handleCallback: looking up user in UsersModel for ${email}`);
      let user = await UsersModel.getUserByEmail(email);

      if (!user) {
        const created = await UsersModel.createUser({
          user_uuid: email,
          email: email,
          role_id: 3,
          first_name: null,
          last_name: null,
          password_hash: hashPassword(email),
          status: 'active',
          company_id: null,
          email_verified: 1,
          email_verified_at: new Date().toLocaleString('sv-SE', {
            timeZone: 'Asia/Kolkata'
          }),
        });
        user = { id: created.id, ...created };
      } else if (user.role_id !== 3) {
        const updated_user = await UsersModel.updateUser(user.id, {
          role_id: 3,
          email_verified: 1,
          email_verified_at: new Date().toLocaleString('sv-SE', {
            timeZone: 'Asia/Kolkata'
          }),
        });
        user.role_id = 3;
        
        logger.info(`[InstructorCalendar] handleCallback: user email verification status updated of userId=${user.id}`);

      }

      logger.info(`[InstructorCalendar] handleCallback: about to save tokens to calendar_integrations for userId=${user.id}`);
      
      // Get provider_id from calendar_providers table (name = 'google-meet')
      let providerId = null;
      try {
        const CalendarProvidersModel = require('../../models/calendar/CalendarProvidersModel');
        const providerResult = await CalendarProvidersModel.getByName('google-meet');
        if (providerResult && providerResult.length > 0) {
          providerId = providerResult[0].id;
        }
      } catch (err) {
        logger.warn(`[InstructorCalendar] Could not lookup provider_id for google-meet:`, err.message);
      }
      
      await CalendarUsersModel.createOrUpdateUserCalendar(user.id, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
        provider: 'google',
        provider_id: providerId
      });

      return res.send(`
        <html>
          <body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:60px;background:#ffffff;color:#334155;">
            <div style="max-width:400px;margin:auto;">
              <div style="font-size:48px;margin-bottom:16px;">&#x2705;</div>
              <h1 style="color:#16a34a;font-size:24px;margin:0 0 8px;">Connected!</h1>
              <p style="font-size:14px;color:#64748b;">Your Google Calendar (<strong>${email}</strong>) is now connected to RetentionLab.</p>
              <p style="font-size:12px;color:#94a3b8;">You can close this window.</p>
              <script>setTimeout(() => window.close(), 4000);</script>
            </div>
          </body>
        </html>
      `);
    } catch (e) {
      logger.error('[InstructorCalendar] Callback error:', e);
      return res.status(500).send(`<html><body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:50px;background:#ffffff;color:#334155;"><h2 style="color:#ef4444;">Connection failed</h2><p style="color:#64748b;">${e.message}</p></body></html>`);
    }
  },

  /** POST /api/instructor-calendar/disconnect */
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
      
      await CalendarUsersModel.deleteUser(userId);
      return ok({}, 'Calendar disconnected');
    } catch (e) { return err(e.message); }
  },

  /** GET /api/instructor-calendar/status/:emailOrUserId */
  async getStatus(req) {
    try {
      const { emailOrUserId } = req.params;
      if (!emailOrUserId) return err('Email or user_id is required', 400);
      
      let userId = emailOrUserId;
      // If it's not a number, treat it as email and look up the user
      if (isNaN(emailOrUserId)) {
        const user = await UsersModel.getUserByEmail(emailOrUserId);
        if (!user) return err('User not found', 404);
        userId = user.id;
      }
      
      const integration = await CalendarUsersModel.getUser(userId);
      return ok({
        user_id: userId,
        email: integration?.email || null,
        connected: !!integration,
        status: integration ? (integration.status || 'active') : 'not_connected',
        updated_at: integration ? integration.updated_at : null
      });
    } catch (e) { return err(e.message); }
  },

  /**
   * POST /api/instructor-calendar/sync
   * Sync calendar meetings to local database
   * - Instructors: sync their own calendar
   * - Admins: sync all instructors in their company
   */
  async syncCalendar(req) {
    try {
      const user = req.user;
      const { daysBack = 30, daysForward = 90 } = req.body;
      
      const { syncGoogleCalendar } = require('../../services/calendarSyncService');
      
      // For instructors: sync their own calendar
      // For admins: sync all instructors in their company
      let syncResults = [];
      
      if (user.role_name === 'instructor' || user.role_name === 'solo_instructor') {
        // Sync only their own calendar
        const result = await syncGoogleCalendar(user.email, user.id, daysBack, daysForward);
        syncResults.push({ email: user.email, ...result });
      } else if (user.role_name === 'admin' || user.role_name === 'super_admin') {
        // Sync all instructors in their company
        const usersResult = await UsersModel.listUsers(user, { limit: 1000 });
        const allUsers = usersResult.rows || [];
        const instructors = allUsers.filter(u => 
          u.role_name === 'instructor' || u.role_name === 'solo_instructor'
        );
        
        for (const instructor of instructors) {
          try {
            const result = await syncGoogleCalendar(instructor.email, instructor.id, daysBack, daysForward);
            syncResults.push({ email: instructor.email, ...result });
          } catch (err) {
            logger.error(`[InstructorCalendar] Failed to sync ${instructor.email}:`, err);
            syncResults.push({ email: instructor.email, error: err.message });
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

  /**
   * POST /api/admin/meetings/calendar/sync-user
   * Sync calendar for a single user by user_id
   * Checks token expiry, refreshes if needed, then syncs meetings
   */
  async syncUserCalendar(req) {
    try {
      const { user_id } = req.body;
      
      if (!user_id) {
        return err('user_id is required', 400);
      }

      // Get user's calendar integration data
      const integration = await CalendarUsersModel.getUser(user_id);
      if (!integration) {
        return err('User calendar not connected', 404);
      }

      // Get user email
      const user = await UsersModel.getUserByEmail(integration.email);
      if (!user) {
        return err('User not found', 404);
      }

      // Import and use the sync service
      const { syncGoogleCalendar } = require('../../services/calendarSyncService');
      
      // Sync the user's calendar (service handles token refresh automatically)
      const result = await syncGoogleCalendar(integration.email, user_id, 30, 90);

      if (result.synced > 0) {
        return ok({
          message: `Successfully synced ${result.synced} meetings for ${integration.email}`,
          data: result
        });
      } else if (result.message) {
        return ok({
          message: result.message,
          data: result
        });
      } else {
        return ok({
          message: 'Sync completed',
          data: result
        });
      }
    } catch (e) {
      logger.error('[InstructorCalendar] Sync user calendar error:', e);
      return err(e.message);
    }
  }
};

module.exports = controller;


