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
   */
  static async getUserTokens(email) {
    const user = await CalendarUsersModel.getUser(email);
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
  static async saveUserTokens(email, tokens, userId = null) {
    await CalendarUsersModel.createOrUpdateUser(email, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date
    }, userId);
  }

  /**
   * Delete user tokens
   */
  static async deleteUserTokens(email) {
    await CalendarUsersModel.deleteUser(email);
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