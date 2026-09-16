/**
 * controllers/super_admin/microsoft/microsoftCredentialsController.js
 * Microsoft OAuth credentials controller — mirrors
 * controllers/google/googleCredentialsController.js exactly (super admin
 * CRUD over the non-sensitive config; client_id/client_secret always come
 * from .env, never stored in the database).
 */
const MicrosoftOAuthCredentialsModel = require('../../../models/super_admin/calendar/MicrosoftOAuthCredentialsModel');

const controller = {
  async list(req, res) {
    try {
      const credentials = await MicrosoftOAuthCredentialsModel.getAll();
      res.json({ success: true, data: credentials });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async save(req, res) {
    try {
      const { auth_uri, token_uri, redirect_uris, scopes } = req.body;
      const config = { auth_uri, token_uri, redirect_uris: redirect_uris || [], scopes: scopes || [] };
      await MicrosoftOAuthCredentialsModel.saveCredentials(config);
      const saved = await MicrosoftOAuthCredentialsModel.getActiveCredentials();
      res.status(201).json({ success: true, data: saved, message: 'Microsoft OAuth configuration saved. Note: client_id, client_secret and tenant_id must be configured via .env file' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const { auth_uri, token_uri, redirect_uris, scopes, is_active } = req.body;
      const updates = {
        auth_uri: auth_uri || null,
        token_uri: token_uri || null,
        redirect_uris: redirect_uris || [],
        scopes: scopes || [],
        is_active: is_active !== undefined ? is_active : 1
      };
      const updated = await MicrosoftOAuthCredentialsModel.update(id, updates);
      res.json({ success: true, data: updated, message: 'Configuration updated. Note: client_id, client_secret and tenant_id must be configured via .env file' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await MicrosoftOAuthCredentialsModel.deleteById(id);
      res.json({ success: true, message: 'Credentials deleted', data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
};

module.exports = controller;
