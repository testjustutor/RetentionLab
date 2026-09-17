/**
 * root/database/seedHelpers.js
 */
const crypto = require('crypto');
const { db } = require('./db');
const { logger } = require('../utils/logger');

// Collapse multi-line SQL into a single, single-spaced line for log output.
function oneLine(sql) {
  return String(sql).replace(/\s+/g, ' ').trim();
}

function safeParams(params) {
  try {
    return JSON.stringify(params);
  } catch (e) {
    return String(params);
  }
}

const runAsync = (sql, params = []) => {
    const startedAt = Date.now();
    logger.info(`[DB Query START] runAsync | SQL: ${oneLine(sql)} | Params: ${safeParams(params)}`);
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            const elapsed = Date.now() - startedAt;
            if (err) {
                logger.error(`[DB Query END] runAsync FAILED (${elapsed}ms) | SQL: ${oneLine(sql)} | Error: ${err.message}`);
                return reject(err);
            }
            logger.info(`[DB Query END] runAsync OK (${elapsed}ms) | lastID=${this.lastID} changes=${this.changes}`);
            resolve(this);
        });
    });
};

const getAsync = (sql, params = []) => {
    const startedAt = Date.now();
    logger.info(`[DB Query START] getAsync | SQL: ${oneLine(sql)} | Params: ${safeParams(params)}`);
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            const elapsed = Date.now() - startedAt;
            if (err) {
                logger.error(`[DB Query END] getAsync FAILED (${elapsed}ms) | SQL: ${oneLine(sql)} | Error: ${err.message}`);
                return reject(err);
            }
            logger.info(`[DB Query END] getAsync OK (${elapsed}ms) | Rows returned: ${row ? 1 : 0}`);
            resolve(row);
        });
    });
};

const allAsync = (sql, params = []) => {
    const startedAt = Date.now();
    logger.info(`[DB Query START] allAsync | SQL: ${oneLine(sql)} | Params: ${safeParams(params)}`);
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            const elapsed = Date.now() - startedAt;
            if (err) {
                logger.error(`[DB Query END] allAsync FAILED (elapsed=${elapsed}ms) | SQL: ${oneLine(sql)} | Error: ${err.message}`);
                return reject(err);
            }
            logger.info(`[DB Query END] allAsync OK (${elapsed}ms) | Row count: ${rows.length}`);
            resolve(rows);
        });
    });
};

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
    const secretKey = process.env.PASSWORD_SECRET_KEY || '';
    const pepperedPassword = secretKey + password;
    const derived = crypto.scryptSync(pepperedPassword, salt, 64).toString('hex');
    return `${salt}:${derived}`;
};

module.exports = { db, runAsync, getAsync, allAsync, hashPassword };
