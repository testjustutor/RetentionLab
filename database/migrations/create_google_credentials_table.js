/**
 * Migration: Create google_oauth_credentials table
 * Stores Google OAuth 2.0 client credentials instead of reading from file
 */
const { db } = require('../db');

const createGoogleCredentialsTable = () => {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS google_oauth_credentials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id VARCHAR(500) NOT NULL,
        project_id VARCHAR(255) NULL,
        auth_uri VARCHAR(500) NULL,
        token_uri VARCHAR(500) NULL,
        auth_provider_x509_cert_url VARCHAR(500) NULL,
        client_secret VARCHAR(500) NOT NULL,
        redirect_uris JSON NOT NULL,
        javascript_origins JSON NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `, (err) => {
      if (err) return reject(err);
      console.log('[Migration] google_oauth_credentials table created/verified');
      resolve();
    });
  });
};

module.exports = { createGoogleCredentialsTable };