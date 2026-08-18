/**
 * controllers/settings/tableControlsController.js
 * Per-table visibility controls for the centralized table component.
 * Lets a super admin show/hide: Search, "Entries per page", "Showing X-Y of Z",
 * and pagination for each table independently.
 */
const SystemSettingsModel = require('../../../models/super_admin/settings/SystemSettingsModel');

const DEFAULT_CONTROLS = { showSearch: true, showEntries: true, showInfo: true, showPagination: true };
const CONTROL_KEYS = ['showSearch', 'showEntries', 'showInfo', 'showPagination'];
const PREFIX = 'table_controls.';

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

/** Parse a stored setting row into a controls object (defaulting to true). */
function parseControls(setting) {
  const result = { ...DEFAULT_CONTROLS };
  if (!setting || !setting.setting_value) return result;
  try {
    const parsed = JSON.parse(setting.setting_value);
    CONTROL_KEYS.forEach(k => {
      if (typeof parsed[k] === 'boolean') result[k] = parsed[k];
    });
  } catch (e) { /* ignore malformed value, use defaults */ }
  return result;
}

const tableControlsController = {
  /** GET /api/tables/controls/:tableId - controls for one table (any authenticated user) */
  async get(req) {
    try {
      const tableId = (req.params.tableId || '').trim();
      if (!tableId) return err('Table ID required', 400);
      const setting = await SystemSettingsModel.getSetting(null, PREFIX + tableId);
      return ok({ tableId, controls: parseControls(setting) });
    } catch (e) { return err(e.message); }
  },

  /** GET /api/tables/controls - all stored table controls (any authenticated user) */
  async list(req) {
    try {
      const db = req.app.locals.db;
      const rows = await new Promise((resolve, reject) => {
        db.all("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE '" + PREFIX + "%'", [], (e, r) => e ? reject(e) : resolve(r || []));
      });
      const items = (rows || []).map(r => ({
        tableId: r.setting_key.slice(PREFIX.length),
        controls: parseControls(r)
      }));
      return ok({ items, defaults: DEFAULT_CONTROLS });
    } catch (e) { return err(e.message); }
  },

  /** PUT/POST /api/tables/controls/:tableId - set controls for a table (super admin only) */
  async update(req) {
    try {
      const tableId = (req.params.tableId || '').trim();
      if (!tableId) return err('Table ID required', 400);
      const controls = parseControls({ setting_value: JSON.stringify(req.body || {}) });
      const value = JSON.stringify({
        showSearch: controls.showSearch,
        showEntries: controls.showEntries,
        showInfo: controls.showInfo,
        showPagination: controls.showPagination
      });
      await SystemSettingsModel.upsertSetting(null, PREFIX + tableId, value, 'json');
      return ok({ tableId, controls }, 'Table controls saved');
    } catch (e) { return err(e.message); }
  }
};

module.exports = tableControlsController;