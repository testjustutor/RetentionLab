/**
 * root/database/db.js
 */

const mysql = require('mysql2'); // Use standard mysql2 to natively support legacy callbacks
require('dotenv').config();

// 1. Create a base callback-ready pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'retention_lab',
    waitForConnections: true,
    connectionLimit: 10
});

// Handle pool-level fatal errors to prevent uncaught exceptions crashing the process
pool.on('error', (err) => {
    console.error('[db.js] MySQL pool fatal error:', err.message);
    // The pool will automatically remove/recreate connections as needed
});

// 2. Derive a promise-ready pool for our async helper methods
const promisePool = pool.promise();

// 3. Build a custom compatibility object to act as 'db'
const db = {
    // Maps exactly to SQLite's db.get(sql, params, callback)
    get: function (sql, params, callback) {
        // normalize args: (sql, cb) OR (sql, params, cb) OR (sql, params)
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        const hasCb = typeof callback === 'function';
        pool.query(sql, params || [], (err, rows) => {
            if (err) {
                if (hasCb) return callback(err);
                return;
            }
            const row = rows && rows.length > 0 ? rows[0] : null;
            if (hasCb) return callback(null, row);
        });
    },

    // Maps exactly to SQLite's db.all(sql, params, callback)
    all: function (sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        const hasCb = typeof callback === 'function';
        pool.query(sql, params || [], (err, rows) => {
            if (err) {
                if (hasCb) return callback(err);
                return;
            }
            if (hasCb) return callback(null, rows);
        });
    },

    // Maps exactly to SQLite's db.run(sql, params, callback)
    // Simulates SQLite's `this.lastID` and `this.changes` using MySQL's result metadata
    run: function (sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        const hasCb = typeof callback === 'function';
        pool.query(sql, params || [], function (err, result) {
            if (err) {
                if (hasCb) return callback(err);
                return;
            }

            // SQLite binds metadata to `this` context inside the callback.
            // We map MySQL's metadata fields to match what SQLite code expects.
            const context = {
                lastID: result ? result.insertId : null,
                changes: result ? result.affectedRows : 0
            };

            if (hasCb) return callback.call(context, null);
        });
    },

    // SQLite compatibility: db.prepare(sql)
    // Some code paths are written for sqlite3's prepared statements API.
    // We provide a minimal shim for MySQL so `db.prepare(...).run/get/all` works.
    prepare: function (sql) {
        return {
            get: function (params, callback) {
                // allow get(callback) style
                if (typeof params === 'function') {
                    callback = params;
                    params = [];
                }
                return db.get(sql, params, callback);
            },
            all: function (params, callback) {
                if (typeof params === 'function') {
                    callback = params;
                    params = [];
                }
                return db.all(sql, params, callback);
            },
            run: function (params, callback) {
                if (typeof params === 'function') {
                    callback = params;
                    params = [];
                }
                return db.run(sql, params, callback);
            },
            // sqlite3 prepared statements sometimes support .finalize/.close
            finalize: function () {},
            close: function () {}
        };
    }
};

// ─── Shared helpers (using the promisePool) ──────────────────────────────────

const runAsync = async (sql, params = []) => {
    const [result] = await promisePool.query(sql, params);
    return result;
};

const allAsync = async (sql, params = []) => {
    const [rows] = await promisePool.query(sql, params);
    return rows;
};

const getAsync = async (sql, params = []) => {
    const [rows] = await promisePool.query(sql, params);
    return rows[0] || null;
};

// ─── Utilities ──────────────────────────────────────────────────────────────

const closeDB = () => {
    return new Promise((resolve, reject) => {
        pool.end((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

const initDB = async () => {
    // For MySQL, just verify connection - tables should already exist
    try {
        const result = await promisePool.query('SELECT 1');
        console.log('✓ MySQL connection verified');
        return result;
    } catch (err) {
        console.error('✗ MySQL connection failed:', err.message);
        throw err;
    }
};

const migrateDB = async () => {
    // Placeholder for future migrations
    console.log('No pending migrations');
};

module.exports = { 
    db, 
    initDB, 
    closeDB, 
    runAsync, 
    allAsync, 
    getAsync, 
    migrateDB 
};