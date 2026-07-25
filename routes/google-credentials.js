/**
 * routes/google-credentials.js
 * CRUD routes for managing Google OAuth credentials (Super Admin only)
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const GoogleOAuthCredentialsModel = require('../models/calendar/GoogleOAuthCredentialsModel');

router.get('/', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const credentials = await GoogleOAuthCredentialsModel.getAll();
    
    // Mask sensitive fields - all OAuth credentials should only come from .env file
    const maskedCredentials = credentials.map(cred => ({
      ...cred,
      project_id: cred.project_id ? '••••••••••••••••' : cred.project_id
    }));
    
    res.json({ success: true, data: maskedCredentials });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const { project_id, auth_uri, token_uri, auth_provider_x509_cert_url, redirect_uris, javascript_origins } = req.body;
    // Note: All OAuth credentials (client_id, client_secret) should be configured via .env file
    const config = { web: { project_id, auth_uri, token_uri, auth_provider_x509_cert_url, redirect_uris: redirect_uris || [], javascript_origins: javascript_origins || [] } };
    const result = await GoogleOAuthCredentialsModel.saveCredentials(config);
    const saved = await GoogleOAuthCredentialsModel.getActiveCredentials();
    
    // Mask sensitive fields before returning to client
    const masked = saved ? { ...saved, project_id: saved.project_id ? '••••••••••••••••' : saved.project_id } : null;
    
    res.status(201).json({ success: true, data: masked, message: 'Google OAuth configuration saved. Note: client_id and client_secret must be configured via .env file' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { project_id, auth_uri, token_uri, auth_provider_x509_cert_url, redirect_uris, javascript_origins, is_active } = req.body;
    // Note: All OAuth credentials (client_id, client_secret) should be configured via .env file
    await require('../database/db').runAsync(
      `UPDATE google_oauth_credentials SET project_id=?, auth_uri=?, token_uri=?, auth_provider_x509_cert_url=?, redirect_uris=?, javascript_origins=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [project_id || null, auth_uri || null, token_uri || null, auth_provider_x509_cert_url || null, JSON.stringify(redirect_uris || []), javascript_origins ? JSON.stringify(javascript_origins) : null, is_active !== undefined ? is_active : 1, id]
    );
    const updated = await require('../database/db').getAsync(`SELECT * FROM google_oauth_credentials WHERE id=?`, [id]);
    
    // Mask sensitive fields before returning to client
    const masked = updated ? { ...updated, project_id: updated.project_id ? '••••••••••••••••' : updated.project_id } : null;
    
    res.json({ success: true, data: masked, message: 'Configuration updated. Note: client_id and client_secret must be configured via .env file' });
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