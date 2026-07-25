/**
 * controllers/calendarIntegrationController.js
 * Read-only integration status for admin settings display.
 * All provider/credential CRUD has been removed for security.
 * OAuth credentials must be configured via .env file only.
 */
const CalendarProvidersModel = require('../../models/calendar/CalendarProvidersModel');
const CalendarCredentialsModel = require('../../models/calendar/CalendarCredentialsModel');

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

// Get integration status for admin settings page
const getIntegrationStatus = async (req, res) => {
  try {
    // Get all active providers
    const providers = await CalendarProvidersModel.getAll({ includeInactive: false });
    
    // Get all active credentials
    const credentials = await CalendarCredentialsModel.getAll({ includeInactive: false });
    
    // Create a map of provider_id -> credential for quick lookup
    const credentialMap = new Map();
    credentials.forEach(cred => {
      credentialMap.set(cred.provider_id, cred);
    });
    
    // Join providers with their credentials
    const integrations = providers.map(provider => ({
      id: provider.id,
      provider_id: provider.provider_id,
      name: provider.name,
      display_name: provider.display_name,
      auth_url: provider.auth_url,
      token_url: provider.token_url,
      scopes: provider.scopes,
      is_active: provider.is_active,
      has_credentials: credentialMap.has(provider.id),
      credential: credentialMap.get(provider.id) || null
    }));
    
    res.json({ 
      success: true, 
      data: integrations 
    });
  } catch (err) {
    console.error('Error fetching integration status:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch integration status' });
  }
};

module.exports = {
  getIntegrationStatus: handle(getIntegrationStatus)
};