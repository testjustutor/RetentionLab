/**
 * root/database/db-header-config.js
 */
const { db } = require('./db');
const { logger } = require('../utils/logger');

const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) return reject(err);
    resolve(this);
  });
});

const createHeaderConfigTable = async () => {
  await runAsync(`
    CREATE TABLE IF NOT EXISTS header_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_key TEXT UNIQUE NOT NULL,
      config_json TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

module.exports = { createHeaderConfigTable };
