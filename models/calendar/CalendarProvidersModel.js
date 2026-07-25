/**
 * models/CalendarProvidersModel.js
 * CRUD for calendar_providers
 */
const { getAsync, runAsync, allAsync } = require('../../database/db');

class CalendarProvidersModel {
  static async getById(id) {
    return getAsync(`SELECT * FROM calendar_providers WHERE id=?`, [id]);
  }

  static async getAll({ includeInactive = false } = {}) {
    const where = includeInactive ? '' : 'WHERE is_active = 1';
    return allAsync(`SELECT * FROM calendar_providers ${where} ORDER BY display_name ASC, name ASC`);
  }

  static async create({ provider_id, name, display_name, auth_url, token_url, scopes, is_active = 1 }) {
    if (!provider_id) throw new Error('provider_id is required');
    if (!name) throw new Error('name is required');
    if (!display_name) throw new Error('display_name is required');

    const result = await runAsync(
      `INSERT INTO calendar_providers (provider_id, name, display_name, auth_url, token_url, scopes, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
      , [
        provider_id,
        name,
        display_name,
        auth_url || null,
        token_url || null,
        scopes || null,
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
      name: 'name',
      display_name: 'display_name',
      auth_url: 'auth_url',
      token_url: 'token_url',
      scopes: 'scopes',
      is_active: 'is_active'
    };

    for (const [key, col] of Object.entries(map)) {
      if (updates[key] !== undefined) {
        fields.push(`${col}=?`);
        params.push(updates[key]);
      }
    }

    if (!fields.length) return this.getById(id);

    params.push(id);

    await runAsync(`UPDATE calendar_providers SET ${fields.join(', ')} WHERE id=?`, params);
    return this.getById(id);
  }

  static async deleteById(id) {
    // ON DELETE behavior depends on FK; do explicit delete of credentials first if needed.
    await runAsync(`DELETE FROM calendar_credentials WHERE provider_id=?`, [id]);
    await runAsync(`DELETE FROM calendar_providers WHERE id=?`, [id]);
    return { success: true };
  }
}

module.exports = CalendarProvidersModel;


