/**
 * controllers/settings/settingsController.js
 * Business logic for system settings CRUD operations.
 */

const SystemSettingsModel = require('../../../models/super_admin/settings/SystemSettingsModel');
const UserSettingsModel = require('../../../models/super_admin/settings/UserSettingsModel');

function ok(data, message) {
  return { success: true, message: message || null, ...(data || {}) };
}

function err(message, statusCode) {
  return { success: false, error: message, statusCode: statusCode || 500 };
}

/**
 * Recursively remove sensitive keys from JSON objects.
 * Prevents credential leakage from JSON blob settings (e.g., `ai`, `google`, `puppeteer`).
 */
function removeSensitiveJsonValues(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const SENSITIVE_JSON_KEYS = [
    'api_key', 'apikey', 'client_secret', 'client_id', 'secret',
    'password', 'token', 'hf_token', 'gemini_api_key', 'openai_api_key',
    'cloude_api_key', 'geminiApiKey', 'openaiApiKey',
    'cloudeApiKey', 'CLIENT_ID', 'CLIENT_SECRET',
    'HF_TOKEN', 'jwt_secret', 'JWT_SECRET', 'webhookUrl', 'webhook_url'
  ];
  
  if (Array.isArray(obj)) {
    return obj.map(removeSensitiveJsonValues);
  }
  
  const sanitized = { ...obj };
  for (const key of Object.keys(sanitized)) {
    const keyLower = key.toLowerCase();
    const isSensitive = SENSITIVE_JSON_KEYS.some(pattern => {
      const p = pattern.toLowerCase().replace(/[._]/g, '');
      const k = keyLower.replace(/[._]/g, '');
      return k === p || k.includes(p);
    });
    
    if (isSensitive) {
      delete sanitized[key];
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = removeSensitiveJsonValues(sanitized[key]);
    }
  }
  return sanitized;
}

/**
 * Check if a setting key is sensitive (API keys, secrets, tokens, passwords).
 */
function isSensitiveKey(key) {
  const SENSITIVE_PATTERNS = [
    'api_key', 'api.secret', 'client_secret', 'client_id', 
    'secret', 'token', 'password', 'hf_token', 'jwt_secret',
    'gemini_api_key', 'openai_api_key', 'cloude_api_key', 'xai_api_key',
    'webhookurl', 'webhook_url'
  ];
  const k = key.toLowerCase().replace(/[._]/g, '');
  return SENSITIVE_PATTERNS.some(pattern => {
    const p = pattern.toLowerCase().replace(/[._]/g, '');
    return k.includes(p);
  });
}

/**
 * Sanitize a single setting's value by removing sensitive data.
 * Handles both plain string secrets and JSON blobs with nested secrets.
 */
function sanitizeSettingValue(setting) {
  if (!setting || !setting.setting_value) return setting;
  
  // Direct sensitive key check - remove the value entirely
  if (isSensitiveKey(setting.setting_key)) {
    return { ...setting, setting_value: '' };
  }
  
  // JSON blobs may contain nested API keys (e.g., `ai`, `google`, `puppeteer` settings)
  if (setting.setting_type === 'json' || setting.setting_type === 'string') {
    try {
      const parsed = JSON.parse(setting.setting_value);
      const sanitized = removeSensitiveJsonValues(parsed);
      return { ...setting, setting_value: JSON.stringify(sanitized) };
    } catch {}
  }
  
  return setting;
}

const settingsController = {
  /**
   * GET /api/settings/system
   * Get all system settings (super admin only)
   */
  async getSystemSettings(req) {
    try {
      const { category, search } = req.query;
      
      let sql = 'SELECT *, (is_static = 1) as is_editable FROM system_settings WHERE 1=1';
      const params = [];
      
      if (category) {
        sql += ' AND setting_key LIKE ?';
        params.push(`${category}%`);
      }
      
      if (search) {
        sql += ' AND (setting_key LIKE ? OR setting_value LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }
      
      sql += ' ORDER BY setting_key ASC';
      
      const settings = await new Promise((resolve, reject) => {
        req.app.locals.db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });
      
      // Remove all sensitive values - secrets must only come from .env file
      const sanitizedSettings = settings.map(sanitizeSettingValue);
      
      return ok({ data: sanitizedSettings });
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * GET /api/settings/system/:key
   * Get single system setting by key
   */
  async getSystemSetting(req) {
    try {
      const { key } = req.params;
      const companyId = req.user?.company_id || null;
      
      const setting = await SystemSettingsModel.getSetting(companyId, key);
      if (!setting) return ok({ data: null });
      
      const sanitized = sanitizeSettingValue(setting);
      return ok({ data: sanitized });
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * POST /api/settings/system
   * Create or update system setting
   */
  async upsertSystemSetting(req) {
    try {
      const { key, value, type = 'string', company_id = null } = req.body;
      
      if (!key) return err('Setting key is required', 400);
      if (value === undefined) return err('Setting value is required', 400);
      
      const validTypes = ['string', 'number', 'boolean', 'json'];
      if (!validTypes.includes(type)) {
        return err(`Invalid type. Must be one of: ${validTypes.join(', ')}`, 400);
      }
      
      if (type === 'number' && isNaN(value)) {
        return err('Value must be a valid number', 400);
      }
      
      if (type === 'boolean' && !['true', 'false', '1', '0'].includes(String(value))) {
        return err('Value must be a boolean (true/false)', 400);
      }
      
      if (type === 'json') {
        try { JSON.parse(value); } catch {
          return err('Value must be valid JSON', 400);
        }
      }
      
      const result = await SystemSettingsModel.upsertSetting(company_id, key, value, type);
      return ok({ data: result }, 'Setting saved successfully');
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * DELETE /api/settings/system/:key
   * Delete system setting
   */
  async deleteSystemSetting(req) {
    try {
      const { key } = req.params;
      const companyId = req.user?.company_id || null;
      
      const sql = 'DELETE FROM system_settings WHERE company_id = ? AND setting_key = ?';
      
      const result = await new Promise((resolve, reject) => {
        req.app.locals.db.run(sql, [companyId, key], function(err) {
          if (err) return reject(err);
          resolve({ deleted: this.changes > 0 });
        });
      });
      
      if (!result.deleted) return err('Setting not found', 404);
      return ok({ data: result }, 'Setting deleted successfully');
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * POST /api/settings/system/filter
   * Get system settings filtered by category/search from request body
   * Super admin only - all data sent via payload, no query params
   */
  async getSystemSettingsByFilter(req) {
    try {
      const { category, search } = req.body;
      
      let sql = 'SELECT *, (is_static = 1) as is_editable FROM system_settings WHERE 1=1';
      const params = [];
      
      if (category) {
        sql += ' AND setting_key LIKE ?';
        params.push(`${category}%`);
      }
      
      if (search) {
        sql += ' AND (setting_key LIKE ? OR setting_value LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }
      
      sql += ' ORDER BY setting_key ASC';
      
      const settings = await new Promise((resolve, reject) => {
        req.app.locals.db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });
      
      // Remove all sensitive values - secrets must only come from .env file
      const sanitizedSettings = settings.map(sanitizeSettingValue);
      
      return ok({ data: sanitizedSettings });
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * GET /api/settings/system/categories
   * Get all setting categories
   */
  async getCategories(req) {
    try {
      const sql = `
        SELECT DISTINCT 
          SUBSTRING_INDEX(setting_key, '.', 1) as category,
          COUNT(*) as count
        FROM system_settings
        GROUP BY category
        ORDER BY category ASC
      `;
      
      const categories = await new Promise((resolve, reject) => {
        req.app.locals.db.all(sql, [], (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });
      
      return ok({ data: categories });
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * POST /api/settings/system/bulk
   * Bulk update multiple settings
   */
  async bulkUpdateSystemSettings(req) {
    try {
      const { settings } = req.body;
      
      if (!Array.isArray(settings)) {
        return err('Settings must be an array', 400);
      }
      
      const results = [];
      
      for (const setting of settings) {
        const { key, value, type = 'string' } = setting;
        
        if (!key || value === undefined) {
          results.push({ key, success: false, error: 'Key and value required' });
          continue;
        }
        
        try {
          const result = await SystemSettingsModel.upsertSetting(null, key, value, type);
          results.push({ key, success: true, data: result });
        } catch (e) {
          results.push({ key, success: false, error: e.message });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      
      return ok({ 
        data: results,
        summary: {
          total: results.length,
          success: successCount,
          failed: results.length - successCount
        }
      }, `Updated ${successCount} of ${results.length} settings`);
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * GET /api/settings/user
   * Get user-specific settings
   * Super admin can pass user_id query param to view any user's settings
   */
  async getUserSettings(req) {
    try {
      const isSuperAdmin = req.user?.role_name === 'super_admin';
      const requestedUserId = req.query.user_id ? parseInt(req.query.user_id) : null;
      
      // Only super admin can view other users' settings
      if (requestedUserId && !isSuperAdmin) {
        return err('Unauthorized: only super admin can view other users settings', 403);
      }
      
      const userId = requestedUserId || req.user.id;
      const { category } = req.query;
      
      let sql = 'SELECT * FROM user_settings WHERE user_id = ?';
      const params = [userId];
      
      if (category) {
        sql += ' AND setting_key LIKE ?';
        params.push(`${category}%`);
      }
      
      sql += ' ORDER BY setting_key ASC';
      
      const settings = await new Promise((resolve, reject) => {
        req.app.locals.db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });
      
      return ok({ data: settings });
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * POST /api/settings/user
   * Create or update user setting
   */
  async upsertUserSetting(req) {
    try {
      const { key, value } = req.body;
      const userId = req.user.id;
      
      if (!key) return err('Setting key is required', 400);
      if (value === undefined) return err('Setting value is required', 400);
      
      const result = await UserSettingsModel.upsertSetting(userId, key, value);
      return ok({ data: result }, 'User setting saved successfully');
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * POST /api/settings/user/bulk
   * Bulk update user-specific settings
   */
  async bulkUpdateUserSettings(req) {
    try {
      const { settings, user_id } = req.body;
      
      if (!Array.isArray(settings)) {
        return err('Settings must be an array', 400);
      }
      
      if (!user_id) {
        return err('user_id is required', 400);
      }
      
      const results = [];
      
      for (const setting of settings) {
        const { key, value, type = 'string' } = setting;
        
        if (!key || value === undefined) {
          results.push({ key, success: false, error: 'Key and value required' });
          continue;
        }
        
        try {
          const result = await UserSettingsModel.upsertSetting(user_id, key, value, type);
          results.push({ key, success: true, data: result });
        } catch (e) {
          results.push({ key, success: false, error: e.message });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      
      return ok({ 
        data: results,
        summary: {
          total: results.length,
          success: successCount,
          failed: results.length - successCount
        }
      }, `Updated ${successCount} of ${results.length} user settings`);
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * GET /api/settings/export
   * Export all settings (for backup)
   */
  async exportSettings(req) {
    try {
      const systemSettings = await new Promise((resolve, reject) => {
        req.app.locals.db.all('SELECT * FROM system_settings', [], (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });
      
      // Remove all sensitive values in exported data
      const sanitizedSettings = systemSettings.map(sanitizeSettingValue);
      
      const exportData = {
        exported_at: new Date().toISOString(),
        system_settings: sanitizedSettings,
        version: '1.0'
      };
      
      return ok({ data: exportData });
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * POST /api/settings/import
   * Import settings (for restore)
   */
  async importSettings(req) {
    try {
      const { settings, merge = false } = req.body;
      
      if (!settings || !settings.system_settings) {
        return err('Invalid import data', 400);
      }
      
      const results = [];
      
      for (const setting of settings.system_settings) {
        const { setting_key, setting_value, setting_type } = setting;
        
        if (merge) {
          const existing = await SystemSettingsModel.getSetting(null, setting_key);
          if (existing) {
            await SystemSettingsModel.upsertSetting(null, setting_key, setting_value, setting_type);
            results.push({ key: setting_key, action: 'updated' });
          } else {
            await SystemSettingsModel.upsertSetting(null, setting_key, setting_value, setting_type);
            results.push({ key: setting_key, action: 'created' });
          }
        } else {
          await SystemSettingsModel.upsertSetting(null, setting_key, setting_value, setting_type);
          results.push({ key: setting_key, action: 'upserted' });
        }
      }
      
      return ok({ 
        data: results,
        summary: {
          total: results.length,
          created: results.filter(r => r.action === 'created').length,
          updated: results.filter(r => r.action === 'updated').length
        }
      }, 'Settings imported successfully');
    } catch (e) {
      return err(e.message);
    }
  }
};

module.exports = settingsController;