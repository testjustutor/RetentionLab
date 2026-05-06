const { google } = require('googleapis');
const path = require('path');
const { logger } = require('../../utils/logger');
const fs = require('fs');
const CredentialsResolver = require('./auth/credentialsResolver');
const TokenManager = require('./auth/tokenManager');
const EventService = require('./events/EventService');
const { SCOPES } = require('./config/paths');

class CalendarService {
  constructor(accountName = 'default') {
    this.accountName = accountName;
    this.credentialsResolver = new CredentialsResolver(accountName);
    this.tokenManager = null;
    this.oauth2Client = null;
    this.auth = null;
    this.calendar = null;
    this.eventService = null;
    this.tokenPath = path.join(__dirname, `../../uploads/google-calendar-json/calendar-token-${accountName}.json`);
    this.tokenManager = new TokenManager(this.tokenPath);
  }

  setCredentialsFile(filename) {
    this.credentialsResolver.setCredentialsFile(filename);
  }

  async ensureAuth() {
    if (this.auth && this.calendar) {
      return;
    }

    let tokens = await this.tokenManager.loadTokens();
    if (!tokens) {
      throw new Error(`No tokens file for '${this.accountName}'. Complete auth `);
    }
    
    // Softer check - allow access_token only (no warning - expected during initial auth)
    if (!tokens.refresh_token) {
      // Silent - read-only mode OK
    }

    this.oauth2Client = this.getOAuth2Client();
    this.oauth2Client.setCredentials(tokens);
    const refreshedTokens = await this.tokenManager.refreshTokens(this.oauth2Client, tokens).catch(() => {
      return tokens; // Silent fallback - no refresh_token expected
    });
    this.oauth2Client.setCredentials(refreshedTokens);

    this.auth = this.oauth2Client;
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    this.eventService = new EventService(this.calendar);
  }

  getOAuth2Client() {
    try {
      const credentialsPath = this.resolveCredentialsPath();
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
    return this.credentialsResolver.resolveCredentialsPath();
  }

  getAuthUrl() {
    try {
      const oauth2Client = this.getOAuth2Client();
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        state: this.accountName
      });
      return authUrl;
    } catch (err) {
      logger.error('Error generating auth URL:', err);
      throw err;
    }
  }

  async authorize(code) {
    try {
      const oauth2Client = this.getOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code);

      await this.tokenManager.saveTokens(tokens);

      this.auth = oauth2Client;
      oauth2Client.setCredentials(tokens);
      this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      this.eventService = new EventService(this.calendar);

      return tokens;
    } catch (err) {
      logger.error('Error during authorization:', err);
      throw err;
    }
  }

  // Event methods - delegate to EventService
  async getEvents(options = {}) {
    await this.ensureAuth();
    return this.eventService.getEvents(options);
  }

  async getEventById(calendarId, eventId) {
    await this.ensureAuth();
    return this.eventService.getEventById(calendarId, eventId);
  }

  async getCalendars() {
    await this.ensureAuth();
    return this.eventService.getCalendars();
  }

  async createEvent(calendarId, event) {
    await this.ensureAuth();
    return this.eventService.createEvent(calendarId, event);
  }

  async updateEvent(calendarId, eventId, event) {
    await this.ensureAuth();
    return this.eventService.updateEvent(calendarId, eventId, event);
  }

  async loadTokens() {
    return this.tokenManager.loadTokens();
  }
}

module.exports = CalendarService;

