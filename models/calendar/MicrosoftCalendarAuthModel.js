/**
 * models/calendar/MicrosoftCalendarAuthModel.js
 * Mirrors models/calendar/CalendarAuthModel.js, but for the Microsoft
 * (Azure AD / Microsoft Graph) calendar connection instead of Google.
 * Handles OAuth token storage/retrieval against the same shared
 * calendar_connections table, scoped to the 'teams' calendar_providers row
 * (see database/seeders/016_calendar_providers.js — 'teams' / 'Microsoft
 * Teams' already ships with Microsoft's own auth_url/token_url/scopes).
 */

const { logger } = require('../../utils/logger');
const MicrosoftOAuthCredentialsModel = require('./MicrosoftOAuthCredentialsModel');
const CalendarUsersModel = require('./CalendarUsersModel');

// The calendar_providers.name this integration is stored under. Reuses the
// existing seeded 'teams' provider (display_name 'Microsoft Teams') rather
// than creating a second, redundant provider row — see
// CalendarUsersModel.createOrUpdateUserCalendar()'s providerNameMap, which
// already maps both 'teams' and 'microsoft-teams' to this same row.
const PROVIDER_NAME = 'teams';

class MicrosoftCalendarAuthModel {
  /**
   * Get Microsoft OAuth config (from .env only, via MicrosoftOAuthCredentialsModel)
   */
  static async getOAuthConfig() {
    const settings = require('../../config/settings');

    if (!settings.microsoft?.CLIENT_ID || !settings.microsoft?.CLIENT_SECRET) {
      throw new Error('Microsoft OAuth credentials not configured in .env file. Please set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.');
    }

    return MicrosoftOAuthCredentialsModel.getConfig();
  }

  /**
   * Get user tokens from database (calendar_connections, provider='teams')
   * @param {number|string} userIdOrEmail - User ID or email address
   */
  static async getUserTokens(userIdOrEmail) {
    if (!userIdOrEmail) return null;

    let user;
    if (typeof userIdOrEmail === 'number' || /^\d+$/.test(String(userIdOrEmail))) {
      user = await CalendarUsersModel.getUserByProviderName(Number(userIdOrEmail), PROVIDER_NAME);
    } else {
      user = await CalendarUsersModel.getUserByEmailAndProviderName(userIdOrEmail, PROVIDER_NAME);
    }

    if (!user || !user.access_token) {
      logger.warn(`[MicrosoftCalendarAuthModel] No tokens found for ${userIdOrEmail}`);
      return null;
    }

    return {
      access_token: user.access_token,
      refresh_token: user.refresh_token,
      expiry_date: user.token_expires_at
    };
  }

  /**
   * Save user tokens to database (calendar_connections, provider='teams')
   * Accepts either a numeric user id or an email (resolved to the user id).
   */
  static async saveUserTokens(userIdOrEmail, tokens) {
    if (!userIdOrEmail) throw new Error('Missing userId');

    let userId = userIdOrEmail;
    if (typeof userIdOrEmail === 'string' && userIdOrEmail.includes('@')) {
      const UsersModel = require('../users/UsersModel');
      const user = await UsersModel.getUserByEmail(userIdOrEmail);
      if (!user) throw new Error(`User not found for email ${userIdOrEmail}`);
      userId = user.id;
    }

    let providerId = null;
    try {
      const CalendarProvidersModel = require('./CalendarProvidersModel');
      const providerResult = await CalendarProvidersModel.getByName(PROVIDER_NAME);
      if (providerResult && providerResult.length > 0) {
        providerId = providerResult[0].id;
      }
    } catch (err) {
      logger.warn(`[MicrosoftCalendarAuthModel] Could not lookup provider_id for ${PROVIDER_NAME}:`, err.message);
    }

    await CalendarUsersModel.createOrUpdateUserCalendar(userId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      provider: PROVIDER_NAME,
      provider_id: providerId
    });
  }

  /**
   * Delete user tokens
   */
  static async deleteUserTokens(userId) {
    if (!userId) throw new Error('Missing userId');
    await CalendarUsersModel.deleteUser(userId);
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(expiryDate) {
    if (!expiryDate) return true;
    return new Date(expiryDate).getTime() < Date.now() + 60000; // 1 minute buffer
  }
}

module.exports = MicrosoftCalendarAuthModel;
module.exports.PROVIDER_NAME = PROVIDER_NAME;
