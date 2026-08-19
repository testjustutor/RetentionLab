/**
 * Migration: Create ai_providers table
 *
 * Stores AI provider metadata (label, icon, description, base_url) PLUS the
 * configurable values (enabled, default model, temperature, max_tokens) and
 * the model dropdown options — so the Super Admin AI Providers page renders
 * entirely from the database (no hardcoded cards/options in HTML/JS).
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_ai_providers_table';

const up = async () => {
  console.log('[Migration ai_providers] Starting...');

  await runAsync(`DROP TABLE IF EXISTS ai_providers`);

  await runAsync(`
    CREATE TABLE ai_providers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        provider_key VARCHAR(50) NOT NULL,
        label VARCHAR(100) NOT NULL,
        icon VARCHAR(10) NOT NULL DEFAULT '',
        icon_bg VARCHAR(100) NOT NULL DEFAULT '',
        description VARCHAR(255) NOT NULL DEFAULT '',
        base_url VARCHAR(255) DEFAULT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        default_model VARCHAR(100) NOT NULL DEFAULT '',
        default_temperature DECIMAL(4,2) NOT NULL DEFAULT 0.20,
        default_max_tokens INT NOT NULL DEFAULT 2048,
        model_options JSON DEFAULT NULL,
        is_editable TINYINT(1) NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_ap_provider_key (provider_key),
        INDEX idx_ap_enabled (enabled),
        INDEX idx_ap_sort (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration ai_providers] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS ai_providers`);
  console.log('[Migration ai_providers] Rolled back — ai_providers dropped.');
};

module.exports = { up, down, migrationName };
