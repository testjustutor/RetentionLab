/**
 * Calendar Auth Model
 * Handles Google OAuth token management and credential storage
 */

const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');
const GoogleOAuthCredentialsModel = require('./GoogleOAuthCredentialsModel');
const CalendarUsersModel = require('./CalendarUsersModel');

class CalendarAuthModel {
  /**
   * Get Google OAuth config from database
   */
  static async getOAuthConfig() {
    // Read Google OAuth credentials from .env file only (not from database)
    const settings = require('../../config/settings');
    
    if (!settings.google?.CLIENT_ID || !settings.google?.CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured in .env file. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
    }
    
    // Return config from .env with optional database settings for non-sensitive fields
    const dbConfig = await GoogleOAuthCredentialsModel.getConfig().catch(() => ({}));
    
    return {
      client_id: settings.google.CLIENT_ID,
      client_secret: settings.google.CLIENT_SECRET,
      project_id: process.env.GOOGLE_PROJECT_ID || dbConfig?.project_id || null,
      auth_uri: dbConfig?.auth_uri || 'https://accounts.google.com/o/oauth2/v2/auth',
      token_uri: dbConfig?.token_uri || 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: dbConfig?.auth_provider_x509_cert_url || 'https://www.googleapis.com/oauth2/v1/certs',
      redirect_uris: dbConfig?.redirect_uris || [],
      javascript_origins: dbConfig?.javascript_origins || []
    };
  }

  /**
   * Get user tokens from database
   * @param {number|string} userIdOrEmail - User ID or email address
   */
  static async getUserTokens(userIdOrEmail) {
    if (!userIdOrEmail) return null;
    
    let user;
    // If it's a number, query by user_id; if it's an email, query by email
    if (typeof userIdOrEmail === 'number' || /^\d+$/.test(String(userIdOrEmail))) {
      user = await CalendarUsersModel.getUser(Number(userIdOrEmail));
    } else {
      user = await CalendarUsersModel.getUserByEmail(userIdOrEmail);
    }
    
    if (!user || !user.access_token) {
      return null;
    }
    return {
      access_token: user.access_token,
      refresh_token: user.refresh_token,
      expiry_date: user.token_expiry
    };
  }

  /**
   * Save user tokens to database
   */
  static async saveUserTokens(userId, tokens) {
    if (!userId) throw new Error('Missing userId');
    
    // Try to get provider_id from calendar_providers for Google
    let providerId = null;
    try {
      const CalendarProvidersModel = require('./CalendarProvidersModel');
      // Look up by name 'google-meet' (as stored in calendar_providers.name)
      const providerResult = await CalendarProvidersModel.getByName('google-meet');
      if (providerResult && providerResult.length > 0) {
        providerId = providerResult[0].id;
      }
    } catch (err) {
      logger.warn(`[CalendarAuthModel] Could not lookup provider_id for google:`, err.message);
    }
    
    await CalendarUsersModel.createOrUpdateUser(userId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      provider: 'google',
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
    return expiryDate < Date.now() + 60000; // 1 minute buffer
  }

  /**
   * Get all authenticated users
   */
  static async getAllUsers() {
    return CalendarUsersModel.getAllUsers();
  }
}

module.exports = CalendarAuthModel;