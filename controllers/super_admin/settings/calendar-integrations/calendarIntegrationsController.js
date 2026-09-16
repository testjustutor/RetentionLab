/**
 * controllers/super_admin/settings/calendar-integrations/calendarIntegrationsController.js
 * Super Admin enable/disable toggle for the Google/Microsoft Calendar OAuth
 * integrations. No SQL/business logic here — all data access goes through
 * CalendarProvidersModel, the same canonical model the instructor/admin
 * calendar flows already use for calendar_providers.is_active.
 *
 * NOTE: this is a different feature from the existing "Platform
 * Integrations" settings page (routes/super_admin/settings/platforms.js).
 * That page manages the meeting-bot JOIN platforms (Zoom/Google
 * Meet/Teams, via a generic key/value `settings` table) — unrelated to
 * calendar sync. This page manages calendar_providers.is_active for the
 * 'google-meet' and 'teams' rows specifically, which is what actually
 * gates the instructor "Connect Google/Microsoft Calendar" flows.
 */
const CalendarProvidersModel = require('../../../../models/calendar/CalendarProvidersModel');

// The only two calendar_providers rows this page is allowed to touch.
// 'zoom' also lives in calendar_providers but belongs to the Platform
// Integrations page above — left alone here even if a caller passes its id.
const MANAGED_PROVIDERS = [
  { name: 'google-meet', key: 'google', label: 'Google Calendar' },
  { name: 'teams', key: 'microsoft', label: 'Microsoft Calendar' }
];

const controller = {
  /**
   * GET /api/super_admin/settings/calendar-integrations/settings
   */
  async getSettings(req, res) {
    try {
      const rows = await CalendarProvidersModel.getAll({ includeInactive: true });
      const byName = {};
      for (const row of rows || []) byName[row.name] = row;

      const data = MANAGED_PROVIDERS.map(p => {
        const row = byName[p.name];
        return {
          id: row ? row.id : null,
          key: p.key,
          name: p.name,
          label: p.label,
          is_active: row ? !!row.is_active : false,
          configured: !!row
        };
      });

      return res.json({ success: true, data });
    } catch (err) {
      console.error('[CalendarIntegrations] getSettings error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * POST /api/super_admin/settings/calendar-integrations/settings/toggle
   * Body: { id, is_active }
   */
  async toggleProvider(req, res) {
    try {
      const id = Number(req.body && req.body.id);
      const isActive = !!(req.body && req.body.is_active);
      if (!id) {
        return res.status(400).json({ success: false, error: 'id is required' });
      }

      // Only allow toggling the two providers this page owns, even if a
      // valid calendar_providers id for some other row (e.g. 'zoom') is
      // passed in.
      const provider = await CalendarProvidersModel.getById(id);
      const managed = provider && MANAGED_PROVIDERS.find(p => p.name === provider.name);
      if (!provider || !managed) {
        return res.status(404).json({ success: false, error: 'Not a managed calendar integration provider' });
      }

      const updated = await CalendarProvidersModel.update(id, { is_active: isActive ? 1 : 0 });
      return res.json({
        success: true,
        data: updated,
        message: `${managed.label} ${isActive ? 'enabled' : 'disabled'}`
      });
    } catch (err) {
      console.error('[CalendarIntegrations] toggleProvider error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
};

module.exports = controller;
