/**
 * Migration: Create subscriptions table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_subscriptions_table';

const up = async () => {
  console.log('[Migration subscriptions] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS subscriptions`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT,
    plan_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    start_date DATETIME,
    end_date DATETIME,
    features_json JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sub_company (company_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration subscriptions] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS subscriptions`);
  console.log('[Migration subscriptions] Rolled back — subscriptions dropped.');
};

module.exports = { up, down, migrationName };
