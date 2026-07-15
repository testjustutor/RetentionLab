/**
 * controllers/calendarIntegrationController.js
 * CRUD controller for calendar_providers + calendar_credentials (joined for UI)
 */

const CalendarProvidersModel = require('../models/CalendarProvidersModel');
const CalendarCredentialsModel = require('../models/CalendarCredentialsModel');

function pickCredentialsFields(body) {
  return {
    provider_id: body.provider_id,
    client_id: body.client_id,
    client_secret: body.client_secret,
    tenant_id: body.tenant_id ?? null,
    redirect_uris: body.redirect_uris ?? undefined,
    javascript_origins: body.javascript_origins ?? undefined,
    extra_config: body.extra_config ?? null,
    is_active: body.is_active
  };
}


// Helper wrapper similar to other controllers
function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  };
}

// -------------------- Providers --------------------

const listProviders = async (req, res) => {
  const includeInactive = req.query.includeInactive === '1';
  const providers = await CalendarProvidersModel.getAll({ includeInactive });
  res.json({ success: true, data: providers });
};

const createProvider = async (req, res) => {
  const { provider_id, name, display_name, auth_url, token_url, scopes, is_active } = req.body || {};
  const created = await CalendarProvidersModel.create({
    provider_id,
    name,
    display_name,
    auth_url,
    token_url,
    scopes,
    is_active: is_active !== undefined ? is_active : 1
  });
  res.status(201).json({ success: true, data: created });
};

const updateProvider = async (req, res) => {
  const { id } = req.params;
  const allowed = ['provider_id', 'name', 'display_name', 'auth_url', 'token_url', 'scopes', 'is_active'];
  const updates = {};
  for (const k of allowed) {
    if (req.body && req.body[k] !== undefined) updates[k] = req.body[k];
  }
  const updated = await CalendarProvidersModel.update(id, updates);
  res.json({ success: true, data: updated });
};

const deleteProvider = async (req, res) => {
  const { id } = req.params;
  await CalendarProvidersModel.deleteById(id);
  res.json({ success: true, message: 'Provider deleted' });
};

// -------------------- Credentials --------------------

const listCredentialsByProvider = async (req, res) => {
  const provider_id = req.query.provider_id;
  if (!provider_id) {
    return res.status(400).json({ success: false, error: 'provider_id is required' });
  }

  const creds = await CalendarCredentialsModel.getByProviderId(parseInt(provider_id, 10), {
    includeInactive: req.query.includeInactive === '1'
  });

  // Attach provider info (for UI convenience)
  const providerRow = await CalendarProvidersModel.getById(provider_id).catch(() => null);

  res.json({
    success: true,
    data: {
      provider: providerRow || { id: provider_id },
      credentials: creds
    }
  });
};

const createCredential = async (req, res) => {
  const body = req.body || {};
  const payload = pickCredentialsFields(body);

  const created = await CalendarCredentialsModel.create({
    provider_id: payload.provider_id,
    client_id: payload.client_id,
    client_secret: payload.client_secret,
    tenant_id: payload.tenant_id,
    redirect_uris: payload.redirect_uris,
    javascript_origins: payload.javascript_origins,
    extra_config: payload.extra_config,
    is_active: payload.is_active !== undefined ? payload.is_active : 1
  });

  res.status(201).json({ success: true, data: created });
};

const updateCredential = async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};

  const updates = {};
  for (const k of ['provider_id', 'client_id', 'client_secret', 'tenant_id', 'redirect_uris', 'javascript_origins', 'extra_config', 'is_active']) {
    if (body[k] !== undefined) updates[k] = body[k];
  }

  const updated = await CalendarCredentialsModel.update(id, updates);
  res.json({ success: true, data: updated });
};

const deleteCredential = async (req, res) => {
  const { id } = req.params;
  await CalendarCredentialsModel.deleteById(id);
  res.json({ success: true, message: 'Credential deleted' });
};

module.exports = {
  listProviders: handle(listProviders),
  createProvider: handle(createProvider),
  updateProvider: handle(updateProvider),
  deleteProvider: handle(deleteProvider),

  listCredentialsByProvider: handle(listCredentialsByProvider),
  createCredential: handle(createCredential),
  updateCredential: handle(updateCredential),
  deleteCredential: handle(deleteCredential)
};

