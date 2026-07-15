/**
 * root/models/GoogleOAuthCredentialsModel.js
 * Manages Google OAuth 2.0 client credentials stored in the database
 */
const { getAsync, runAsync, allAsync } = require('../database/db');

class GoogleOAuthCredentialsModel {
  /**
   * Get the active Google OAuth credentials
   * @returns {Promise<Object|null>} Credentials object or null
   */
  static async getActiveCredentials() {
    const row = await getAsync(
      `SELECT client_id, project_id, auth_uri, token_uri, auth_provider_x509_cert_url,
              client_secret, redirect_uris, javascript_origins
       FROM google_oauth_credentials
       WHERE is_active = 1
       ORDER BY id ASC
       LIMIT 1`
    );
    
    if (!row) return null;
    
    // Parse JSON fields
    const credentials = {
      client_id: row.client_id,
      project_id: row.project_id,
      auth_uri: row.auth_uri,
      token_uri: row.token_uri,
      auth_provider_x509_cert_url: row.auth_provider_x509_cert_url,
      client_secret: row.client_secret,
      redirect_uris: typeof row.redirect_uris === 'string' ? JSON.parse(row.redirect_uris) : row.redirect_uris,
      javascript_origins: row.javascript_origins ? (typeof row.javascript_origins === 'string' ? JSON.parse(row.javascript_origins) : row.javascript_origins) : null
    };
    
    return { web: credentials, installed: credentials };
  }

  /**
   * Get raw config object (web or installed)
   * @returns {Promise<Object|null>}
   */
  static async getConfig() {
    const creds = await this.getActiveCredentials();
    if (!creds) return null;
    return creds.web || creds.installed || creds;
  }

  /**
   * Save OAuth credentials to database
   * @param {Object} config - The credentials object (from web or installed key)
   * @returns {Promise<Object>}
   */
  static async saveCredentials(config) {
    const data = config.web || config.installed || config;
    
    // Deactivate all existing credentials first
    await runAsync(`UPDATE google_oauth_credentials SET is_active = 0`);
    
    const result = await runAsync(
      `INSERT INTO google_oauth_credentials
       (client_id, project_id, auth_uri, token_uri, auth_provider_x509_cert_url,
        client_secret, redirect_uris, javascript_origins, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        data.client_id,
        data.project_id || null,
        data.auth_uri || null,
        data.token_uri || null,
        data.auth_provider_x509_cert_url || null,
        data.client_secret,
        JSON.stringify(data.redirect_uris || []),
        data.javascript_origins ? JSON.stringify(data.javascript_origins) : null
      ]
    );
    
    return { id: result.insertId, ...data };
  }

  /**
   * Seed credentials from a JSON file path
   * @param {string} filePath - Path to credentials JSON file
   * @returns {Promise<Object>}
   */
  static async seedFromFile(filePath) {
    const fs = require('fs/promises');
    const raw = await fs.readFile(filePath, 'utf8');
    const config = JSON.parse(raw);
    return this.saveCredentials(config);
  }

  /**
   * Get all credential records
   */
  static async getAll() {
    return allAsync(
      `SELECT * FROM google_oauth_credentials ORDER BY created_at DESC`
    );
  }
}

module.exports = GoogleOAuthCredentialsModel;