/**
 * Microsoft Calendar Event Controller
 * Handles calendar event operations using the Microsoft identity platform
 * (OAuth2 v2.0 endpoint) and Microsoft Graph API.
 * Mirrors controllers/calendar/CalendarEventController.js (the Google/
 * googleapis version) method-for-method, using axios directly instead of a
 * provider SDK (axios is already a project dependency; no new package
 * needed — Microsoft's OAuth token endpoint and Graph API are both plain
 * REST/JSON, same as how the rest of this codebase already calls Deepgram/
 * Gemini/OpenAI directly with axios).
 */

const axios = require('axios');
const { logger } = require('../../utils/logger');
const MicrosoftCalendarAuthModel = require('../../models/calendar/MicrosoftCalendarAuthModel');
const CalendarUsersModel = require('../../models/calendar/CalendarUsersModel');
const CalendarHelper = require('../../utils/calendarHelper');

class MicrosoftCalendarEventController {
  /**
   * Load the active Microsoft OAuth config (client_id/secret/tenant/urls).
   */
  static async getConfig() {
    return MicrosoftCalendarAuthModel.getOAuthConfig();
  }

  /**
   * Ensure valid token, refresh if expired. Returns a fresh access_token.
   */
  static async ensureValidToken(email) {
    const tokens = await MicrosoftCalendarAuthModel.getUserTokens(email);
    if (!tokens || !tokens.access_token) {
      throw new Error('No valid access token. Complete Microsoft OAuth authorization first.');
    }

    if (!MicrosoftCalendarAuthModel.isTokenExpired(tokens.expiry_date)) {
      logger.debug(`[MicrosoftCalendar] Token valid for ${email}`);
      return tokens.access_token;
    }

    if (!tokens.refresh_token) {
      logger.error(`[MicrosoftCalendar] Token expired for ${email} but no refresh_token available`);
      throw new Error('Token expired and no refresh_token available. Re-authorize required.');
    }

    logger.info(`[MicrosoftCalendar] Token expired for ${email}, attempting refresh`);
    try {
      const config = await this.getConfig();
      const body = new URLSearchParams({
        client_id: config.client_id,
        client_secret: config.client_secret,
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        scope: (config.scopes || []).join(' ')
      });

      const { data } = await axios.post(config.token_uri, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const newExpiry = Date.now() + (Number(data.expires_in || 3600) * 1000);
      await MicrosoftCalendarAuthModel.saveUserTokens(email, {
        access_token: data.access_token,
        // Microsoft only returns a new refresh_token when it rotates one;
        // fall back to the existing refresh_token when it doesn't.
        refresh_token: data.refresh_token || tokens.refresh_token,
        expiry_date: newExpiry
      });

      logger.info(`[MicrosoftCalendar] Token refreshed for ${email}, new expiry: ${new Date(newExpiry).toISOString()}`);

      // A successful refresh proves the connection is still valid.
      await CalendarUsersModel.markVerifiedByEmail(email);

      return data.access_token;
    } catch (err) {
      logger.error(`[MicrosoftCalendar] Token refresh failed for ${email}:`, err.response?.data || err.message);
      throw new Error('Token refresh failed. Re-authorize required.');
    }
  }

  /**
   * Normalize a Microsoft Graph event into the same shape
   * CalendarHelper/CalendarSyncController already expect from Google Calendar
   * events (id, summary, description, location, start{dateTime,timeZone},
   * end{...}, hangoutLink-equivalent join link), so the rest of the sync
   * pipeline (utils/calendarHelper.js) can be reused unchanged.
   */
  static _normalizeEvent(item) {
    const joinUrl = (item.onlineMeeting && item.onlineMeeting.joinUrl)
      || item.onlineMeetingUrl
      || null;
    return {
      id: item.id,
      summary: item.subject || 'Untitled',
      description: (item.body && item.body.content) || item.bodyPreview || '',
      location: (item.location && item.location.displayName) || '',
      start: item.start || {},
      end: item.end || {},
      hangoutLink: joinUrl
    };
  }

  /**
   * Get calendar events for a user (Microsoft Graph /me/calendarview).
   * @param {string} email
   * @param {Object} options - { timeMin, timeMax, maxResults }
   */
  static async getEvents(email, options = {}) {
    const tokens = await MicrosoftCalendarAuthModel.getUserTokens(email);
    if (!tokens || !tokens.access_token) {
      logger.info(`[MicrosoftCalendar] No tokens for ${email} - returning empty events`);
      return [];
    }

    const accessToken = await this.ensureValidToken(email);
    const config = await this.getConfig();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDateTime = options.timeMin || today.toISOString();
    const endDateTime = options.timeMax || new Date(today.getTime() + 30 * 24 * 3600000).toISOString();
    const top = options.maxResults || 10;

    const url = `${config.graph_base_url}/me/calendarview`;
    const { data } = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="UTC"'
      },
      params: {
        startDateTime,
        endDateTime,
        $orderby: 'start/dateTime',
        $top: top
      }
    });

    const items = data.value || [];
    return items.map(item => this._normalizeEvent(item));
  }

  /**
   * Create a calendar event (Microsoft Graph POST /me/events).
   */
  static async createEvent(email, eventData) {
    const accessToken = await this.ensureValidToken(email);
    const config = await this.getConfig();

    const event = {
      subject: eventData.summary,
      body: { contentType: 'text', content: eventData.description || '' },
      start: { dateTime: eventData.start.dateTime, timeZone: 'Asia/Kolkata' },
      end: { dateTime: eventData.end.dateTime, timeZone: 'Asia/Kolkata' }
    };

    const { data } = await axios.post(`${config.graph_base_url}/me/events`, event, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    });

    logger.info(`[MicrosoftCalendar] Event created for ${email}: ${event.subject}`);
    return data;
  }

  /**
   * Get the Microsoft OAuth authorize URL for a user.
   * @param {string} email
   * @param {string|null} redirectUriOverride
   * @param {string|null} stateOverride - pass an already-signed state token
   *   (e.g. the instructor verify JWT) so the callback can look up the exact
   *   same calendar_connections row the verification step created, instead
   *   of a freshly-signed one. When omitted, a fresh calendar-link state is
   *   signed here.
   */
  static async getAuthUrl(email, redirectUriOverride = null, stateOverride = null) {
    const config = await this.getConfig();
    const redirectUri = redirectUriOverride || (config.redirect_uris && config.redirect_uris[0]);
    let state = stateOverride;
    if (!state) {
      const { signCalendarLink } = require('../../utils/calendarLinkToken');
      state = signCalendarLink({ email });
    }

    const params = new URLSearchParams({
      client_id: config.client_id,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: (config.scopes || []).join(' '),
      state,
      prompt: 'consent'
    });

    return `${config.auth_uri}?${params.toString()}`;
  }

  /**
   * Authorize user with OAuth code (exchange code -> tokens, save them).
   */
  static async authorize(email, code, redirectUri) {
    const config = await this.getConfig();

    const body = new URLSearchParams({
      client_id: config.client_id,
      client_secret: config.client_secret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      scope: (config.scopes || []).join(' ')
    });

    const { data } = await axios.post(config.token_uri, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const expiryDate = Date.now() + (Number(data.expires_in || 3600) * 1000);
    const tokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expiry_date: expiryDate
    };

    // Save tokens to database — same "find or create instructor user" pattern
    // as CalendarEventController.authorize() (Google's version).
    const UsersModel = require('../../models/users/UsersModel');
    const crypto = require('crypto');

    let user = await UsersModel.getUserByEmail(email);
    if (!user) {
      const created = await UsersModel.createUser({
        user_uuid: email,
        email,
        role_id: 3,
        first_name: null,
        last_name: null,
        password_hash: MicrosoftCalendarEventController._hashPassword(email),
        status: 'active',
        company_id: null
      });
      user = { id: created.id, ...created };
    } else if (user.role_id !== 3) {
      await UsersModel.updateUser(user.id, { role_id: 3 });
      user.role_id = 3;
    }

    await MicrosoftCalendarAuthModel.saveUserTokens(email, tokens);
    return tokens;
  }

  /**
   * Process events and store meetings — delegates to the same
   * CalendarHelper used by Google, since getEvents() above already
   * normalizes Graph events into the same shape.
   */
  static async processAndStoreEvents(email, events, calendarAccountId = null) {
    const stored = [];
    for (const e of events) {
      const link = e.hangoutLink || CalendarHelper.extractMeetingLink(e.description, e.location || '');
      if (link) {
        const platformType = CalendarHelper.detectPlatform(link, e.location || '');
        if (platformType && platformType !== 'unknown') {
          const result = await CalendarHelper.storeMeetingFromEvent(e, email, platformType, link, calendarAccountId);
          if (result) stored.push(e.id);
        }
      }
    }
    return stored;
  }

  static _hashPassword(password) {
    const crypto = require('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derived}`;
  }
}

module.exports = MicrosoftCalendarEventController;
