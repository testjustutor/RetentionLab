/**
 * controllers/calendarIntegrationController.js
 * Read-only integration status for admin settings display, plus dynamic
 * DB-backed connection stats/accounts and a disconnect action.
 * All provider/credential CRUD has been removed for security.
 * OAuth credentials must be configured via .env file only.
 */
const CalendarProvidersModel = require('../../models/calendar/CalendarProvidersModel');
const CalendarUsersModel = require('../../models/calendar/CalendarUsersModel');

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

// Parse the provider config_json into a usable object (fall back to {}).
function parseConfig(provider) {
  if (!provider || !provider.config_json) return {};
  if (typeof provider.config_json === 'object') return provider.config_json;
  try {
    return JSON.parse(provider.config_json);
  } catch (e) {
    return {};
  }
}

// Get integration status for admin settings page (providers + dynamic connection stats)
const getIntegrationStatus = async (req, res) => {
  try {
    // Get all active providers
    const providers = await CalendarProvidersModel.getAll({ includeInactive: false });

    // Per-provider dynamic counts scoped to the logged-in admin's company
    const adminId = req.user ? req.user.id : null;
    const stats = await CalendarUsersModel.getProviderStats(adminId);
    const statsByProvider = {};
    for (const s of stats || []) statsByProvider[s.provider_id] = s;

    // Providers are configured via .env (has_credentials flag), but we pull the
    // real connection/verification counts from the DB.
    const integrations = providers.map(provider => {
      const config = parseConfig(provider);
      const stat = statsByProvider[provider.id] || {};
      return {
        id: provider.id,
        name: provider.name,
        display_name: provider.display_name,
        is_active: provider.is_active,
        // config.json details (usable/manageable info)
        auth_url: config.auth_url || null,
        token_url: config.token_url || null,
        scopes: config.scopes || [],
        join_strategy: config.join_strategy || null,
        requires_passcode: config.requires_passcode || false,
        // dynamic connection data
        connected_count: Number(stat.connected_count || 0),
        active_connections: Number(stat.active_connections || 0),
        verified_connections: Number(stat.verified_connections || 0)
      };
    });

    res.json({
      success: true,
      data: integrations
    });
  } catch (err) {
    console.error('Error fetching integration status:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch integration status' });
  }
};

// Get connected accounts (users) for a given provider, scoped to the admin's company.
// Query: provider_id (required), status (optional: active/disconnected/all)
const getConnectedAccounts = async (req, res) => {
  const providerId = Number(req.query.provider_id);
  if (!providerId) {
    return res.status(400).json({ success: false, error: 'provider_id is required' });
  }
  const adminId = req.user ? req.user.id : null;
  const statusQuery = (req.query.status || 'all').toLowerCase();
  const connectionStatus = statusQuery && statusQuery !== 'all' ? statusQuery : null;

  const accounts = await CalendarUsersModel.getConnectedAccounts(providerId, adminId, connectionStatus);
  const provider = await CalendarProvidersModel.getById(providerId);

  res.json({
    success: true,
    data: {
      provider: provider
        ? { id: provider.id, name: provider.name, display_name: provider.display_name }
        : null,
      status: connectionStatus || 'all',
      accounts: accounts || []
    }
  });
};

// Disconnect a connected account (scoped to the admin's company).
// Body: { connection_id }
const disconnectConnection = async (req, res) => {
  const connectionId = Number(req.body && req.body.connection_id);
  if (!connectionId) {
    return res.status(400).json({ success: false, error: 'connection_id is required' });
  }
  const adminId = req.user ? req.user.id : null;
  const result = await CalendarUsersModel.disconnectConnection(connectionId, adminId);

  if (!result.changes) {
    return res.status(404).json({ success: false, error: 'Connection not found or not authorized' });
  }
  res.json({ success: true, message: 'Connection disconnected', changes: result.changes });
};

module.exports = {
  getIntegrationStatus: handle(getIntegrationStatus),
  getConnectedAccounts: handle(getConnectedAccounts),
  disconnectConnection: handle(disconnectConnection)
};