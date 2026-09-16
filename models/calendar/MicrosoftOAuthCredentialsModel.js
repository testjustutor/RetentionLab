/**
 * models/calendar/MicrosoftOAuthCredentialsModel.js
 * Microsoft (Azure AD / Microsoft Graph) OAuth credentials management.
 * Mirrors models/calendar/GoogleOAuthCredentialsModel.js exactly — sensitive
 * data (client_id, client_secret, tenant_id) comes from .env file only;
 * non-sensitive config is stored in the database.
 */

const { getAsync, runAsync, allAsync } = require('../../database/db');
const { logger } = require('../../utils/logger');

class MicrosoftOAuthCredentialsModel {
  /**
   * Get Microsoft OAuth config from .env ONLY
   * ALL credentials come from .env for security - nothing stored in database
   */
  static async getConfig() {
    const settings = require('../../config/settings');

    if (!settings.microsoft?.CLIENT_ID || !settings.microsoft?.CLIENT_SECRET) {
      throw new Error('Microsoft OAuth credentials not configured in .env file. Please set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.');
    }

    const tenantId = settings.microsoft.TENANT_ID || 'common';

    // All config from .env - no database queries for security
    return {
      client_id: settings.microsoft.CLIENT_ID,
      client_secret: settings.microsoft.CLIENT_SECRET,
      tenant_id: tenantId,
      auth_uri: process.env.MICROSOFT_AUTH_URI || `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
      token_uri: process.env.MICROSOFT_TOKEN_URI || `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      graph_base_url: process.env.MICROSOFT_GRAPH_BASE_URL || 'https://graph.microsoft.com/v1.0',
      redirect_uris: process.env.MICROSOFT_REDIRECT_URIS
        ? process.env.MICROSOFT_REDIRECT_URIS.split(',').map(uri => uri.trim())
        : ['http://localhost:3000/api/instructor/microsoft-calendar/callback'],
      scopes: process.env.MICROSOFT_SCOPES
        ? process.env.MICROSOFT_SCOPES.split(',').map(s => s.trim())
        : ['offline_access', 'User.Read', 'Calendars.ReadWrite']
    };
  }

  /**
   * Get active credentials from database (non-sensitive fields only)
   */
  static async getActiveCredentials() {
    return getAsync(
      `SELECT * FROM microsoft_oauth_credentials WHERE is_active = 1 ORDER BY id DESC LIMIT 1`
    );
  }

  /**
   * Get all credentials from database
   */
  static async getAll() {
    return allAsync(
      `SELECT * FROM microsoft_oauth_credentials ORDER BY created_at DESC, id DESC`
    );
  }

  /**
   * Save/update OAuth configuration
   * DEPRECATED: For security, all OAuth config should come from .env
   * This method is kept for backward compatibility but should not be used
   */
  static async saveCredentials(config) {
    console.warn('MicrosoftOAuthCredentialsModel.saveCredentials() is deprecated. Use .env file instead.');
    throw new Error('For security reasons, Microsoft OAuth credentials should not be stored in database. Please use .env file.');
  }

  /**
   * Get credential by ID
   */
  static async getById(id) {
    return getAsync(
      `SELECT * FROM microsoft_oauth_credentials WHERE id = ?`,
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
      `UPDATE microsoft_oauth_credentials SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
    return this.getById(id);
  }

  /**
   * Delete credential
   */
  static async deleteById(id) {
    await runAsync(`DELETE FROM microsoft_oauth_credentials WHERE id = ?`, [id]);
    return { success: true };
  }
}

module.exports = MicrosoftOAuthCredentialsModel;
