/**
 * Google Calendar Service
 * Handles Google Calendar API integration
 */

const { google } = require('googleapis');
const { logger } = require('../utils/logger');
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const CREDENTIALS_PATHS = [
  path.join(__dirname, '../../uploads/google-calendar-json/credentials_1'),
  path.join(__dirname, '../../uploads/google-calendar-json/credentials_2')
];

class CalendarService {
  constructor(accountName = 'default') {
    this.accountName = accountName;
    this.auth = null;
    this.calendar = null;
    this.tokenPath = path.join(__dirname, `../../uploads/google-calendar-json/calendar-token-${accountName}.json`);
    this.credentialsFile = null; // Will be set when needed
  }

  /**
   * Get OAuth2 authorization URL
   */
  getAuthUrl() {
    try {
      const oauth2Client = this.getOAuth2Client();
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        state: this.accountName // Include account name in state
      });
      return authUrl;
    } catch (err) {
      logger.error('Error generating auth URL:', err);
      throw err;
    }
  }

  /**
   * Handle OAuth callback and save tokens
   */
  async authorize(code) {
    try {
      const oauth2Client = this.getOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code);

      // Save tokens to account-specific file
      await fsPromises.writeFile(this.tokenPath, JSON.stringify(tokens, null, 2));
      logger.info(`Calendar tokens saved for account: ${this.accountName}`);

      this.auth = oauth2Client;
      oauth2Client.setCredentials(tokens);
      this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      return tokens;
    } catch (err) {
      logger.error('Error during authorization:', err);
      throw err;
    }
  }

  /**
   * Load saved tokens or refresh if expired
   */
  async loadTokens() {
    try {
      const tokenData = await fsPromises.readFile(this.tokenPath, 'utf8');
      const tokens = JSON.parse(tokenData);

      const oauth2Client = this.getOAuth2Client();
      oauth2Client.setCredentials(tokens);

      // Check and refresh if needed
      if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
        logger.info(`Token expired for account ${this.accountName}, refreshing...`);
        const { credentials } = await oauth2Client.refreshAccessToken();
        await fsPromises.writeFile(this.tokenPath, JSON.stringify(credentials, null, 2));
        oauth2Client.setCredentials(credentials);
      }

      this.auth = oauth2Client;
      this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      return tokens;
    } catch (err) {
      logger.warn('No saved tokens found or error loading tokens:', err.message);
      return null;
    }
  }

  /**
   * Get events from calendar
   */
  async getEvents(options = {}) {
    try {
      await this.ensureAuth();

      const {
        calendarId = 'primary',
        maxResults = 10,
        timeMin,
        timeMax,
        singleEvents = true,
        orderBy = 'startTime'
      } = options;

      const queryOptions = {
        calendarId,
        maxResults,
        singleEvents,
        orderBy
      };

      if (timeMin) queryOptions.timeMin = new Date(timeMin).toISOString();
      if (timeMax) queryOptions.timeMax = new Date(timeMax).toISOString();

      const response = await this.calendar.events.list(queryOptions);
      return response.data.items || [];
    } catch (err) {
      logger.error('Error fetching calendar events:', err);
      throw err;
    }
  }

  /**
   * Get specific event by ID
   */
  async getEventById(calendarId, eventId) {
    try {
      await this.ensureAuth();

      const response = await this.calendar.events.get({
        calendarId,
        eventId
      });

      return response.data;
    } catch (err) {
      logger.error('Error fetching event:', err);
      throw err;
    }
  }

  /**
   * Get user's calendar list
   */
  async getCalendars() {
    try {
      await this.ensureAuth();

      const response = await this.calendar.calendarList.list();
      return response.data.items || [];
    } catch (err) {
      logger.error('Error fetching calendars:', err);
      throw err;
    }
  }

  /**
   * Create a calendar event (for future use)
   */
  async createEvent(calendarId, event) {
    try {
      await this.ensureAuth();

      const response = await this.calendar.events.insert({
        calendarId,
        resource: event
      });

      logger.info('Event created:', response.data.id);
      return response.data;
    } catch (err) {
      logger.error('Error creating event:', err);
      throw err;
    }
  }

  /**
   * Update calendar event (for future use)
   */
  async updateEvent(calendarId, eventId, event) {
    try {
      await this.ensureAuth();

      const response = await this.calendar.events.update({
        calendarId,
        eventId,
        resource: event
      });

      logger.info('Event updated:', eventId);
      return response.data;
    } catch (err) {
      logger.error('Error updating event:', err);
      throw err;
    }
  }

  /**
   * Check if authenticated, load tokens if available
   */
  async ensureAuth() {
    if (this.auth && this.calendar) {
      return;
    }

    const tokens = await this.loadTokens();
    if (!tokens) {
      throw new Error('No valid Google Calendar credentials. Please authenticate first.');
    }
  }

  /**
   * Set the credentials file to use for this account
   */
  setCredentialsFile(filename) {
    this.credentialsFile = filename;
  }

  /**
   * Get OAuth2 client
   */
  getOAuth2Client() {
    try {
      const credentialsPath = this.credentialsPath || this.resolveCredentialsPath(this.account);
      const raw = fs.readFileSync(credentialsPath, 'utf8');
      const credentials = JSON.parse(raw);
      const config = credentials.installed || credentials.web;

      if (!config) {
        throw new Error('Expected credentials JSON to contain either an installed or web object.');
      }

      const { client_id, client_secret, redirect_uris } = config;
      if (!client_id || !client_secret || !redirect_uris || !redirect_uris.length) {
        throw new Error('Missing required OAuth client fields in credentials.json.');
      }

      return new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
      );
    } catch (err) {
      logger.error('Error loading credentials:', err);
      throw new Error('Google Calendar credentials not found or invalid. Please add valid credentials.json to the config folder.');
    }
  }

  resolveCredentialsPath() {
    // If a specific credentials file is set for this account, use it first
    if (this.credentialsFile) {
      const specificPath = path.join(__dirname, '../../uploads/google-calendar-json', this.credentialsFile);
      if (fs.existsSync(specificPath)) {
        return specificPath;
      }
    }

    // Fallback to account-based naming
    const accountSpecificPaths = [
      path.join(__dirname, `../../uploads/google-calendar-json/credentials_${this.accountName}.json`),
      path.join(__dirname, `../../uploads/google-calendar-json/credentials-${this.accountName}.json`),
      path.join(__dirname, `../../uploads/google-calendar-json/credentials_${this.accountName}`),
      path.join(__dirname, `../../uploads/google-calendar-json/credentials-${this.accountName}`)
    ];

    for (const candidate of accountSpecificPaths) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    // Fallback to default paths
    for (const candidate of CREDENTIALS_PATHS) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error(`No Google credentials file found for account '${this.accountName}'. Checked: ${[...accountSpecificPaths, ...CREDENTIALS_PATHS].join(', ')}`);
  }
}

// DEPRECATED - Use services/calendar/ instead
module.exports = require('./calendar');
