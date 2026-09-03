/**
 * models/calendar/GoogleOAuthCredentialsModel.js
 * Google OAuth credentials management
 * Sensitive data (client_id, client_secret) comes from .env file
 * Non-sensitive config stored in database
 */

const { getAsync, runAsync, allAsync } = require('../../../database/db');
const { logger } = require('../../../utils/logger');

class GoogleOAuthCredentialsModel {
  /**
   * Get Google OAuth config from .env ONLY
   * ALL credentials come from .env for security - nothing stored in database
   */
  static async getConfig() {
    const settings = require('../../../config/settings');
    
    if (!settings.google?.CLIENT_ID || !settings.google?.CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured in .env file. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
    }
    
    // All config from .env - no database queries for security
    return {
      client_id: settings.google.CLIENT_ID,
      client_secret: settings.google.CLIENT_SECRET,
      project_id: process.env.GOOGLE_PROJECT_ID || null,
      auth_uri: process.env.GOOGLE_AUTH_URI || 'https://accounts.google.com/o/oauth2/v2/auth',
      token_uri: process.env.GOOGLE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_x509_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
      redirect_uris: process.env.GOOGLE_REDIRECT_URIS 
        ? process.env.GOOGLE_REDIRECT_URIS.split(',').map(uri => uri.trim())
        : ['http://localhost:3000/api/calendar/callback'],
      javascript_origins: process.env.GOOGLE_JAVASCRIPT_ORIGINS
        ? process.env.GOOGLE_JAVASCRIPT_ORIGINS.split(',').map(uri => uri.trim())
        : []
    };
  }

  /**
   * Get active credentials from database (non-sensitive fields only)
   */
  static async getActiveCredentials() {
    return getAsync(
      `SELECT * FROM google_oauth_credentials WHERE is_active = 1 ORDER BY id DESC LIMIT 1`
    );
  }

  /**
   * Get all credentials from database
   */
  static async getAll() {
    return allAsync(
      `SELECT * FROM google_oauth_credentials ORDER BY created_at DESC, id DESC`
    );
  }

  /**
   * Save/update OAuth configuration
   * DEPRECATED: For security, all OAuth config should come from .env
   * This method is kept for backward compatibility but should not be used
   */
  static async saveCredentials(config) {
    console.warn('GoogleOAuthCredentialsModel.saveCredentials() is deprecated. Use .env file instead.');
    throw new Error('For security reasons, Google OAuth credentials should not be stored in database. Please use .env file.');
  }

  /**
   * Get credential by ID
   */
  static async getById(id) {
    return getAsync(
      `SELECT * FROM google_oauth_credentials WHERE id = ?`,
      [id]
    );
  }

  /**
   * Update credential
   */
  static async update(id, updates) {
    const fields = [];
    const params = [];
    
    const allowedFields = {
      project_id: 'project_id',
      auth_uri: 'auth_uri',
      token_uri: 'token_uri',
      redirect_uris: 'redirect_uris',
      scopes: 'scopes',
      is_active: 'is_active'
    };

    for (const [key, col] of Object.entries(allowedFields)) {
      if (updates[key] !== undefined) {
        fields.push(`${col} = ?`);
        if (key === 'redirect_uris' || key === 'scopes') {
          params.push(JSON.stringify(updates[key]));
        } else {
          params.push(updates[key]);
        }
      }
    }

    if (!fields.length) return this.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await runAsync(
      `UPDATE google_oauth_credentials SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
    return this.getById(id);
  }

  /**
   * Delete credential
   */
  static async deleteById(id) {
    await runAsync(`DELETE FROM google_oauth_credentials WHERE id = ?`, [id]);
    return { success: true };
  }
}

module.exports = GoogleOAuthCredentialsModel;