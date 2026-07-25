/**
 * models/CalendarCredentialsModel.js
 * CRUD for calendar_credentials
 */
const { getAsync, runAsync, allAsync } = require('../../database/db');

class CalendarCredentialsModel {
  static async getById(id) {
    return getAsync(`SELECT * FROM calendar_credentials WHERE id=?`, [id]);
  }

  static async getAll({ includeInactive = false } = {}) {
    const where = includeInactive ? '' : 'WHERE is_active = 1';
    return allAsync(`SELECT * FROM calendar_credentials ${where} ORDER BY created_at DESC, id DESC`);
  }

  static async getByProviderId(provider_id, { includeInactive = true } = {}) {
    const where = includeInactive ? 'WHERE provider_id = ?' : 'WHERE provider_id = ? AND is_active = 1';
    return allAsync(`SELECT * FROM calendar_credentials ${where} ORDER BY created_at DESC, id DESC`, [provider_id]);
  }

  static async create({ provider_id, tenant_id = null, redirect_uris, javascript_origins, extra_config = null, is_active = 1 }) {
    if (!provider_id) throw new Error('provider_id is required');

    const result = await runAsync(
      `INSERT INTO calendar_credentials
       (provider_id, tenant_id, redirect_uris, javascript_origins, extra_config, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`
      , [
        provider_id,
        tenant_id || null,
        redirect_uris ? JSON.stringify(redirect_uris) : JSON.stringify([]),
        javascript_origins ? JSON.stringify(javascript_origins) : null,
        extra_config ? JSON.stringify(extra_config) : null,
        is_active !== undefined ? is_active : 1
      ]
    );

    return this.getById(result.insertId);
  }

  static async update(id, updates) {
    const fields = [];
    const params = [];

    const map = {
      provider_id: 'provider_id',
      tenant_id: 'tenant_id',
      redirect_uris: 'redirect_uris',
      javascript_origins: 'javascript_origins',
      extra_config: 'extra_config',
      is_active: 'is_active'
    };

    for (const [key, col] of Object.entries(map)) {
      if (updates[key] !== undefined) {
        fields.push(`${col}=?`);

        if (key === 'redirect_uris' || key === 'javascript_origins' || key === 'extra_config') {
          const val = updates[key];
          params.push(val === null ? null : JSON.stringify(val));
        } else {
          params.push(updates[key]);
        }
      }
    }

    if (!fields.length) return this.getById(id);

    params.push(id);

    await runAsync(`UPDATE calendar_credentials SET ${fields.join(', ')} WHERE id=?`, params);
    return this.getById(id);
  }

  static async deleteById(id) {
    await runAsync(`DELETE FROM calendar_credentials WHERE id=?`, [id]);
    return { success: true };
  }
}

module.exports = CalendarCredentialsModel;

