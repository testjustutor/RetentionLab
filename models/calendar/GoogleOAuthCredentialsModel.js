/**
 * models/calendar/GoogleOAuthCredentialsModel.js
 * Google OAuth credentials management
 * Sensitive data (client_id, client_secret) comes from .env file
 * Non-sensitive config stored in database
 */

const { getAsync, runAsync, allAsync } = require('../../database/db');
const { logger } = require('../../utils/logger');

class GoogleOAuthCredentialsModel {
  /**
   * Get Google OAuth config from .env + database
   * client_id and client_secret ALWAYS come from .env
   */
  static async getConfig() {
    const settings = require('../../config/settings');
    
    if (!settings.google?.CLIENT_ID || !settings.google?.CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured in .env file. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
    }
    
    // Get non-sensitive config from database
    const dbConfig = await this.getActiveCredentials().catch(() => ({}));
    
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
   * Save/update OAuth configuration (non-sensitive fields only)
   * client_id and client_secret are NOT stored in database
   */
  static async saveCredentials(config) {
    const web = config?.web || config || {};
    
    // Check if record exists
    const existing = await this.getActiveCredentials().catch(() => null);
    
    if (existing) {
      // Update existing record
      await runAsync(
        `UPDATE google_oauth_credentials SET
         project_id = ?,
         auth_uri = ?,
         token_uri = ?,
         auth_provider_x509_cert_url = ?,
         redirect_uris = ?,
         javascript_origins = ?,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          web.project_id || null,
          web.auth_uri || 'https://accounts.google.com/o/oauth2/v2/auth',
          web.token_uri || 'https://oauth2.googleapis.com/token',
          web.auth_provider_x509_cert_url || 'https://www.googleapis.com/oauth2/v1/certs',
          JSON.stringify(web.redirect_uris || []),
          JSON.stringify(web.javascript_origins || []),
          existing.id
        ]
      );
      return this.getActiveCredentials();
    } else {
      // Insert new record
      const result = await runAsync(
        `INSERT INTO google_oauth_credentials
         (project_id, auth_uri, token_uri, auth_provider_x509_cert_url, redirect_uris, javascript_origins, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [
          web.project_id || null,
          web.auth_uri || 'https://accounts.google.com/o/oauth2/v2/auth',
          web.token_uri || 'https://oauth2.googleapis.com/token',
          web.auth_provider_x509_cert_url || 'https://www.googleapis.com/oauth2/v1/certs',
          JSON.stringify(web.redirect_uris || []),
          JSON.stringify(web.javascript_origins || [])
        ]
      );
      return this.getById(result.insertId);
    }
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
      auth_provider_x509_cert_url: 'auth_provider_x509_cert_url',
      redirect_uris: 'redirect_uris',
      javascript_origins: 'javascript_origins',
      is_active: 'is_active'
    };

    for (const [key, col] of Object.entries(allowedFields)) {
      if (updates[key] !== undefined) {
        fields.push(`${col} = ?`);
        if (key === 'redirect_uris' || key === 'javascript_origins') {
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