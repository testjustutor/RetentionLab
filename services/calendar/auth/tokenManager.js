/**
 * root/services/calendar/auth/tokenManager.js
 *
 */
const fsPromises = require('fs').promises;
const { logger } = require('../../../utils/logger');
const path = require('path');

class TokenManager {
  constructor(tokenPath) {
    this.tokenPath = tokenPath;
  }

async loadTokens() {
    try {
      const tokenData = await fsPromises.readFile(this.tokenPath, 'utf8');
      const tokens = JSON.parse(tokenData);
      return tokens; // Read-only OK, no warning

      return tokens;
    } catch (err) {
      logger.warn('No saved tokens found or error loading tokens:', err.message);
      return null;
    }
  }

  async saveTokens(tokens) {
    await fsPromises.writeFile(this.tokenPath, JSON.stringify(tokens, null, 2));
    logger.info(`Calendar tokens saved to: ${this.tokenPath}`);
  }

  async refreshTokens(oauth2Client, tokens) {
    if (tokens.expiry_date && tokens.expiry_date < Date.now() && tokens.refresh_token) {
      logger.info(`Token expired, refreshing using refresh_token...`);
      const { credentials } = await oauth2Client.refreshAccessToken();
      await this.saveTokens(credentials);
      oauth2Client.setCredentials(credentials);
      return credentials;
    }
    return tokens; // Use existing (read-only OK)
  }
}

module.exports = TokenManager;
