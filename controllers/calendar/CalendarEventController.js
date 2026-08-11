/**
 * Calendar Event Controller
 * Handles calendar event operations using Google Calendar API
 */

const { google } = require('googleapis');
const { logger } = require('../../utils/logger');
const CalendarAuthModel = require('../../models/calendar/CalendarAuthModel');
const CalendarHelper = require('../../utils/calendarHelper');
const MeetingModel = require('../../models/meetings/MeetingModel');

class CalendarEventController {
  /**
   * Create an OAuth2 client for a user
   */
  static async createOAuth2Client(email, redirectUriOverride = null) {
    const config = await CalendarAuthModel.getOAuthConfig();
    const redirectUri = redirectUriOverride || (config.redirect_uris && config.redirect_uris[0]);
    
    const oauth2Client = new google.auth.OAuth2(
      config.client_id,
      config.client_secret,
      redirectUri
    );

    const tokens = await CalendarAuthModel.getUserTokens(email);
    if (tokens) {
      oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date
      });
    }

    return { oauth2Client, redirectUri };
  }

  /**
   * Ensure valid token, refresh if expired
   */
  static async ensureValidToken(oauth2Client, email) {
    const tokens = oauth2Client.credentials;
    if (!tokens || !tokens.access_token) {
      throw new Error('No valid access token. Complete Google OAuth authorization first.');
    }
    if (CalendarAuthModel.isTokenExpired(tokens.expiry_date)) {
      if (!tokens.refresh_token) {
        logger.error(`Token expired for ${email} but no refresh_token available in database`);
        throw new Error('Token expired and no refresh_token available. Re-authorize required.');
      }

      logger.info(`Token expired for ${email}, attempting refresh with refresh_token from calendar_integrations table`);
      logger.debug(`Refresh token for ${email}: ${tokens.refresh_token.substring(0, 20)}...`);
      
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        logger.info(`Token refreshed successfully for ${email}, new expiry: ${new Date(credentials.expiry_date).toISOString()}`);
        
        await CalendarAuthModel.saveUserTokens(email, credentials);
        oauth2Client.setCredentials(credentials);
        
        logger.info(`Updated tokens saved to calendar_integrations table for ${email}`);
      } catch (err) {
        logger.error(`Token refresh failed for ${email}:`, err.message);
        logger.error(`Full error:`, err);
        throw new Error('Token refresh failed. Re-authorize required.');
      }
    } else {
      logger.debug(`Token valid for ${email}, expires at: ${new Date(tokens.expiry_date).toISOString()}`);
    }
  }

  /**
   * Get calendar events for a user
   */
  static async getEvents(email, options = {}) {
    const { oauth2Client } = await CalendarEventController.createOAuth2Client(email);
    
    if (!oauth2Client.credentials.access_token) {
      logger.info(`No tokens for ${email} - returning empty events`);
      return [];
    }

    await CalendarEventController.ensureValidToken(oauth2Client, email);
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const defaultOptions = {
      calendarId: 'primary',
      timeMin: today.toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime'
    };

    const params = { ...defaultOptions, ...options };

    // console.log(calendar.events.list(params));
    const response = await calendar.events.list(params);
    return response.data.items || [];
  }

  /**
   * Create a calendar event
   */
  static async createEvent(email, eventData) {
    const { oauth2Client } = await CalendarEventController.createOAuth2Client(email);
    await CalendarEventController.ensureValidToken(oauth2Client, email);
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const event = {
      summary: eventData.summary,
      description: eventData.description,
      start: {
        dateTime: eventData.start.dateTime,
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: eventData.end.dateTime,
        timeZone: 'Asia/Kolkata',
      },
      ...eventData
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      sendUpdates: 'all'
    });

    logger.info(`Event created for ${email}: ${event.summary}`);
    return response.data;
  }

  /**
   * Get auth URL for user
   */
  static async getAuthUrl(email) {
    const { oauth2Client } = await CalendarEventController.createOAuth2Client(email);
    const { signCalendarLink } = require('../../utils/calendarLinkToken');
    const signedState = signCalendarLink({ email });

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      state: signedState
    });
  }

  /**
   * Authorize user with OAuth code
   */
  static async authorize(email, code, redirectUri) {
    const { oauth2Client } = await CalendarEventController.createOAuth2Client(email, redirectUri);
    
    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri: redirectUri
    });

    oauth2Client.setCredentials(tokens);
    
    // Save tokens to database
    const UsersModel = require('../../models/users/UsersModel');
    const crypto = require('crypto');

    let user = await UsersModel.getUserByEmail(email);
    if (!user) {
      const created = await UsersModel.createUser({
        user_uuid: email,
        email: email,
        role_id: 3,
        first_name: null,
        last_name: null,
        password_hash: CalendarEventController._hashPassword(email),
        status: 'active',
        company_id: null,
      });
      user = { id: created.id, ...created };
    } else if (user.role_id !== 3) {
      await UsersModel.updateUser(user.id, { role_id: 3 });
      user.role_id = 3;
    }

    await CalendarAuthModel.saveUserTokens(email, tokens, user.id);
    return tokens;
  }

  /**
   * Process events and store meetings
   */
  static async processAndStoreEvents(email, events) {
    const stored = [];
    for (const e of events) {
      const link = e.hangoutLink || CalendarHelper.extractMeetingLink(e.description, e.location || '');
      if (link) {
        const platformType = CalendarHelper.detectPlatform(link, e.location || '');
        if (platformType && platformType !== 'unknown') {
          const result = await CalendarHelper.storeMeetingFromEvent(e, email, platformType, link);
          if (result) stored.push(e.id);
        }
      }
    }
    return stored;
  }

  /**
   * Hash password for user creation
   */
  static _hashPassword(password) {
    const crypto = require('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derived}`;
  }
}

module.exports = CalendarEventController;