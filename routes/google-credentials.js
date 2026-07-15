/**
 * routes/google-credentials.js
 * CRUD routes for managing Google OAuth credentials (Super Admin only)
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const GoogleOAuthCredentialsModel = require('../models/GoogleOAuthCredentialsModel');

router.get('/', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const credentials = await GoogleOAuthCredentialsModel.getAll();
    res.json({ success: true, data: credentials });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const { client_id, client_secret, project_id, auth_uri, token_uri, auth_provider_x509_cert_url, redirect_uris, javascript_origins } = req.body;
    if (!client_id || !client_secret) {
      return res.status(400).json({ success: false, error: 'client_id and client_secret are required' });
    }
    const config = { web: { client_id, client_secret, project_id, auth_uri, token_uri, auth_provider_x509_cert_url, redirect_uris: redirect_uris || [], javascript_origins: javascript_origins || [] } };
    const result = await GoogleOAuthCredentialsModel.saveCredentials(config);
    const saved = await GoogleOAuthCredentialsModel.getActiveCredentials();
    res.status(201).json({ success: true, data: saved, message: 'Google OAuth credentials saved' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { client_id, client_secret, project_id, auth_uri, token_uri, auth_provider_x509_cert_url, redirect_uris, javascript_origins, is_active } = req.body;
    if (!client_id || !client_secret) {
      return res.status(400).json({ success: false, error: 'client_id and client_secret are required' });
    }
    await require('../database/db').runAsync(
      `UPDATE google_oauth_credentials SET client_id=?, client_secret=?, project_id=?, auth_uri=?, token_uri=?, auth_provider_x509_cert_url=?, redirect_uris=?, javascript_origins=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [client_id, client_secret, project_id || null, auth_uri || null, token_uri || null, auth_provider_x509_cert_url || null, JSON.stringify(redirect_uris || []), javascript_origins ? JSON.stringify(javascript_origins) : null, is_active !== undefined ? is_active : 1, id]
    );
    const updated = await require('../database/db').getAsync(`SELECT * FROM google_oauth_credentials WHERE id=?`, [id]);
    res.json({ success: true, data: updated, message: 'Credentials updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await require('../database/db').runAsync(`DELETE FROM google_oauth_credentials WHERE id=?`, [id]);
    res.json({ success: true, message: 'Credentials deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;