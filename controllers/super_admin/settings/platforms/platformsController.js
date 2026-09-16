/**
 * controllers/super_admin/settings/platforms/platformsController.js
 * Platform settings controllers — no business logic/SQL here,
 * all data access goes through PlatformsModel / CalendarProvidersModel.
 */
const PlatformsModel = require('../../../../models/super_admin/settings/platforms/PlatformsModel');
const CalendarProvidersModel = require('../../../../models/calendar/CalendarProvidersModel');

const controller = {
  /**
   * GET /api/super_admin/settings/platforms/settings
   * Returns both the raw system_settings rows (values the admin has
   * configured) AND the platform list/labels straight from the
   * calendar_providers table (name, display_name) — the frontend no longer
   * hardcodes which platforms exist or what to call them; both come from
   * the database. includeInactive:true is deliberate: calendar_providers.
   * is_active drives the separate Calendar OAuth integration toggle, not
   * this bot-launch Platform Integrations page, so a platform must still
   * show up here even if its Calendar OAuth connector is turned off.
   */
  async getSettings(req, res) {
    try {
      const category = req.query.category || 'platforms';
      const rows = await PlatformsModel.listSettings(category);
      const providers = category === 'platforms'
        ? await CalendarProvidersModel.getAll({ includeInactive: true })
        : [];
      return res.json({
        success: true,
        data: rows,
        providers: providers.map(p => ({ name: p.name, display_name: p.display_name }))
      });
    } catch (err) {
      console.error('[Platforms] getSettings error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * POST /api/super_admin/settings/platforms/settings/bulk
   */
  async saveSettings(req, res) {
    try {
      const { settings } = req.body || {};
      if (!Array.isArray(settings)) {
        return res.status(400).json({ success: false, error: 'Settings must be an array' });
      }
      const result = await PlatformsModel.saveSettings(settings);
      return res.json({
        success: true,
        data: result.data,
        summary: result.summary,
        message: `Updated ${result.summary.success} of ${result.summary.total} settings`
      });
    } catch (err) {
      console.error('[Platforms] saveSettings error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
};

module.exports = controller;
