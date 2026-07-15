/**
 * root/services/calendar/MultiUserCalendarService.js
 *
 */
const { google } = require('googleapis');
const crypto = require('crypto');
const { logger } = require('../../utils/logger');
const CalendarUsersModel = require('../../models/CalendarUsersModel');
const UsersModel = require('../../models/UsersModel');
const GoogleOAuthCredentialsModel = require('../../models/GoogleOAuthCredentialsModel');
const { signCalendarLink } = require('../../utils/calendarLinkToken');

function hashPassword(password, salt = null) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

class MultiUserCalendarService {
  constructor() {
    this.oauth2Client = null;
    this.calendar = null;
    this.currentEmail = null;
    this.redirectUri = null; // Will hold the correct redirect URI for this flow
  }

  async initialize(email, redirectUriOverride = null) {
    let user = await CalendarUsersModel.getUser(email);

    // if (!user) {
    //   logger.info(`User not found, auto-registering: ${email}`);
    //   await CalendarUsersModel.createOrUpdateUser(email, {
    //     access_token: null,
    //     refresh_token: null,
    //     expiry_date: null
    //   });
    //   user = await CalendarUsersModel.getUser(email);
    //   logger.info(`User registered: ${email}`);
    // }

    this.currentEmail = email;

    // Load Google OAuth credentials from database
    const config = await GoogleOAuthCredentialsModel.getConfig();
    if (!config || !config.client_id || !config.client_secret) {
      throw new Error('No active Google OAuth credentials found in database. Seed with: npm run seed:google-credentials');
    }
    const { client_id, client_secret } = config;
    // Use the override if provided, otherwise use the first URI from config
    this.redirectUri = redirectUriOverride || (config.redirect_uris && config.redirect_uris[0]);

    this.oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      this.redirectUri
    );

    // Set tokens from DB
    // Set credentials only if real tokens exist (skip for newly registered)
    if (user && user.access_token) {
      this.oauth2Client.setCredentials({
        access_token: user.access_token,
        refresh_token: user.refresh_token,
        expiry_date: user.token_expiry,
      });
      this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    } else {
      logger.warn(`No valid tokens for ${email} - OAuth client ready for auth flow`);
    }

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    logger.info(`MultiUserCalendarService initialized for ${email}`);
  }

  async ensureValidToken() {
    if (!this.oauth2Client) {
      throw new Error('Service not initialized');
    }

    const tokens = this.oauth2Client.credentials;
    if (!tokens || !tokens.access_token || tokens.access_token === 'placeholder_registered') {
      throw new Error('No valid access token. Complete Google OAuth authorization first.');
    }

    const now = Date.now();

    if (tokens.expiry_date && tokens.expiry_date < now + 60000) { // Refresh 1min early
      if (!tokens.refresh_token) {
        throw new Error('Token expired and no refresh_token available');
      }

      logger.info(`Refreshing token for ${this.currentEmail}`);
      try {
        const { credentials } = await this.oauth2Client.refreshAccessToken();
        await CalendarUsersModel.updateTokens(this.currentEmail, credentials);
        this.oauth2Client.setCredentials(credentials);
        logger.info(`Token refreshed successfully for ${this.currentEmail}`);
      } catch (err) {
        logger.error(`Token refresh failed for ${this.currentEmail}:`, err.message);
        throw new Error('Token refresh failed. Re-authorize required.');
      }
    }
  }

  async getOAuth2Client() {
    // Load credentials from database (no tokens/DB needed for auth URL)
    const config = await GoogleOAuthCredentialsModel.getConfig();
    if (!config || !config.client_id || !config.client_secret || !config.redirect_uris?.[0]) {
      throw new Error('No active Google OAuth credentials in database.');
    }
    return new google.auth.OAuth2(config.client_id, config.client_secret, config.redirect_uris[0]);
  }

  async getAuthUrl() { 
    if (!this.currentEmail) throw new Error("Service must be initialized with an email first.");

    // Sign the email as a JWT so the callback can verify it
    const signedState = signCalendarLink({ email: this.currentEmail });

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events'
      ],
      state: signedState
    });
  }

  async authorize(code) {
    // 1. Exchange code for tokens — explicitly pass redirect_uri to ensure it
    //    matches what was used in the original auth URL (required by Google).
    const { tokens } = await this.oauth2Client.getToken({
      code,
      redirect_uri: this.redirectUri
    });
    
    // 2. Set them into the current client
    this.oauth2Client.setCredentials(tokens);
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    // 3. Store in Database (This satisfies the NOT NULL constraint)
    let user = await UsersModel.getUserByEmail(this.currentEmail);

    if (!user) {
      const created = await UsersModel.createUser({
        user_uuid: this.currentEmail,
        email: this.currentEmail,
        role_id: 3,
        first_name: null,
        last_name: null,
        password_hash: hashPassword(this.currentEmail),
        status: 'active',
        company_id: null,
      });
      user = { id: created.id, ...created };
    } else if (user.role_id !== 3) {
      await UsersModel.updateUser(user.id, { role_id: 3 });
      user.role_id = 3;
    }

    await CalendarUsersModel.createOrUpdateUser(this.currentEmail, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date
    }, user.id);

    return tokens;
  }

  async getEvents(options = {}) {
    // No token check - return empty for unregistered, let route handle
    if (!this.oauth2Client.credentials.access_token || this.oauth2Client.credentials.access_token === 'placeholder_registered') {
      logger.info(`No tokens for ${this.currentEmail} - returning empty events`);
      return [];
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await this.ensureValidToken();
    const defaultOptions = {
      calendarId: 'primary',
      timeMin: today.toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime'
    };
    const params = { ...defaultOptions, ...options };
    const response = await this.calendar.events.list(params);
    return response.data.items || [];
  }

  async createEvent(eventData) {
    await this.ensureValidToken();
    const event = {
      summary: eventData.summary,
      description: eventData.description,
      start: {
        dateTime: eventData.start.dateTime,
        timeZone: 'Asia/Kolkata', // Default, can be dynamic
      },
      end: {
        dateTime: eventData.end.dateTime,
        timeZone: 'Asia/Kolkata',
      },
      ...eventData
    };
    const response = await this.calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      sendUpdates: 'all'
    });
    logger.info(`Event created for ${this.currentEmail}: ${event.summary}`);
    return response.data;
  }

  async getUserEmail() {
    await this.ensureValidToken();
    const response = await this.calendar.users.getProfile(); // Requires people scope? Use calendar freebusy or assume from DB
    return this.currentEmail; // Simplified - email from DB
  }
}

module.exports = MultiUserCalendarService;

