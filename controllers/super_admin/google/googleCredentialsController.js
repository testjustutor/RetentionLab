/**
 * controllers/google/googleCredentialsController.js
 * Google OAuth credentials controller
 */
const GoogleOAuthCredentialsModel = require('../../../models/super_admin/calendar/GoogleOAuthCredentialsModel');

const controller = {
  async list(req, res) {
    try {
      const credentials = await GoogleOAuthCredentialsModel.getAll();
      const maskedCredentials = credentials.map(cred => ({
        ...cred,
        project_id: cred.project_id ? '••••••••••••••••' : cred.project_id
      }));
      res.json({ success: true, data: maskedCredentials });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async save(req, res) {
    try {
      const { project_id, auth_uri, token_uri, auth_provider_x509_cert_url, redirect_uris, javascript_origins } = req.body;
      const config = { web: { project_id, auth_uri, token_uri, auth_provider_x509_cert_url, redirect_uris: redirect_uris || [], javascript_origins: javascript_origins || [] } };
      await GoogleOAuthCredentialsModel.saveCredentials(config);
      const saved = await GoogleOAuthCredentialsModel.getActiveCredentials();
      const masked = saved ? { ...saved, project_id: saved.project_id ? '••••••••••••••••' : saved.project_id } : null;
      res.status(201).json({ success: true, data: masked, message: 'Google OAuth configuration saved. Note: client_id and client_secret must be configured via .env file' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const { project_id, auth_uri, token_uri, auth_provider_x509_cert_url, redirect_uris, javascript_origins, is_active } = req.body;
      const updates = {
        project_id: project_id || null,
        auth_uri: auth_uri || null,
        token_uri: token_uri || null,
        auth_provider_x509_cert_url: auth_provider_x509_cert_url || null,
        redirect_uris: redirect_uris || [],
        javascript_origins: javascript_origins || [],
        is_active: is_active !== undefined ? is_active : 1
      };
      const updated = await GoogleOAuthCredentialsModel.update(id, updates);
      const masked = updated ? { ...updated, project_id: updated.project_id ? '••••••••••••••••' : updated.project_id } : null;
      res.json({ success: true, data: masked, message: 'Configuration updated. Note: client_id and client_secret must be configured via .env file' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await GoogleOAuthCredentialsModel.deleteById(id);
      res.json({ success: true, message: 'Credentials deleted', data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
};

module.exports = controller;