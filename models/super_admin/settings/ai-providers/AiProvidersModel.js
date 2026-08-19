/**
 * models/super_admin/settings/ai-providers/AiProvidersModel.js
 * Data access for the Super Admin AI Providers feature.
 * All SQL lives in models — never in controllers/routes.
 *
 * The Super Admin "AI Providers" page is driven by the dedicated `ai_providers`
 * table (migration 059 + seeder 019). Each row holds provider metadata
 * (label, icon, icon_bg, description, base_url) PLUS the configurable values
 * (enabled, default_model, default_temperature, default_max_tokens) and the
 * model dropdown options (model_options JSON).
 */

const { db } = require('../../../../database/db');

class AiProvidersModel {
  /**
   * Get all AI providers ordered by sort_order.
   * Returns full provider objects ready for the front-end to render cards.
   */
  static getAllProviders() {
    const sql = `SELECT
        id, provider_key, label, icon, icon_bg, description, base_url,
        enabled, default_model, default_temperature, default_max_tokens,
        model_options, is_editable, sort_order, created_at, updated_at
      FROM ai_providers
      ORDER BY sort_order ASC, provider_key ASC`;

    return new Promise((resolve, reject) => {
      db.all(sql, [], (err, rows) => {
        if (err) return reject(err);
        resolve((rows || []).map(AiProvidersModel.mapRow));
      });
    });
  }

  /**
   * Normalize a raw DB row into a front-end-friendly object.
   * model_options is stored as JSON (mysql2 auto-parses it, but we also guard
   * against it arriving as a string from other adapters).
   */
  static mapRow(row) {
    let modelOptions = row.model_options;
    if (typeof modelOptions === 'string') {
      try {
        modelOptions = JSON.parse(modelOptions);
      } catch (e) {
        modelOptions = [];
      }
    }
    return {
      id: row.id,
      provider_key: row.provider_key,
      label: row.label,
      icon: row.icon,
      icon_bg: row.icon_bg,
      description: row.description,
      base_url: row.base_url,
      enabled: !!row.enabled,
      default_model: row.default_model,
      default_temperature: Number(row.default_temperature),
      default_max_tokens: Number(row.default_max_tokens),
      model_options: Array.isArray(modelOptions) ? modelOptions : [],
      is_editable: !!row.is_editable,
      sort_order: row.sort_order
    };
  }

  /**
   * Bulk update provider configurable values.
   * @param {Array} settings - [{ provider_key, enabled, default_model,
   *   default_temperature, default_max_tokens, base_url }]
   */
  static bulkUpdateProviders(settings) {
    const list = Array.isArray(settings) ? settings : [];
    const queries = list
      .filter((s) => s && s.provider_key)
      .map((s) => {
        const sql = `UPDATE ai_providers
          SET enabled = ?,
              default_model = ?,
              default_temperature = ?,
              default_max_tokens = ?,
              base_url = ?,
              updated_at = NOW()
          WHERE provider_key = ?`;
        const params = [
          s.enabled ? 1 : 0,
          s.default_model || '',
          Number(s.default_temperature) || 0.2,
          Number(s.default_max_tokens) || 2048,
          s.base_url != null ? s.base_url : null,
          s.provider_key
        ];
        return new Promise((resolve, reject) => {
          db.run(sql, params, (err) => (err ? reject(err) : resolve({ provider_key: s.provider_key })));
        });
      });

    return Promise.all(queries);
  }
}

module.exports = AiProvidersModel;