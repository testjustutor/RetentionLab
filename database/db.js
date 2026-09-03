/**
 * root/database/db.js
 *
 * Central database access layer (MySQL via mysql2).
 *
 * Exposes a mysql/sqlite-compatible `db` facade used by models:
 *   db.get(sql, params?, cb?)   -> single row
 *   db.all(sql, params?, cb?)   -> array of rows
 *   db.run(sql, params?, cb?)   -> execute; cb bound to { lastID, changes }
 *   db.prepare(sql)             -> statement object (.run/.get/.all/.finalize)
 *
 * These match the calling conventions actually used across the models, so
 * models do NOT need to change. Both callback style (with `this.lastID` /
 * `this.changes` available inside the callback) and promise fallback (when no
 * callback is supplied) are supported.
 */

const mysql = require('mysql2'); // Standard mysql2 to natively support legacy callbacks
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

// Normalise (sql, params, cb) OR (sql, cb) OR (sql, params)
function normalizeArgs(params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = [];
    }
    if (params == null) params = [];
    return { params, callback };
}

/**
 * 3. Build the mysql/sqlite-compatible `db` facade.
 * All methods support callback style; when no callback is provided they
 * return a Promise (safe for both fire-and-forget and await usage).
 */
const db = {
    /**
     * db.get(sql, params?, cb?) -> single row (first row) or null.
     * Callback signature: (err, row).
     */
    get: function (sql, params, callback) {
        const n = normalizeArgs(params, callback);
        const hasCb = typeof n.callback === 'function';

        const runQuery = (done) => {
            pool.query(sql, n.params, (err, rows) => {
                if (err) return done(err);
                done(null, rows && rows.length > 0 ? rows[0] : null);
            });
        };

        if (!hasCb) {
            return new Promise((resolve, reject) => {
                runQuery((err, row) => (err ? reject(err) : resolve(row)));
            });
        }
        runQuery(n.callback);
    },

    /**
     * db.all(sql, params?, cb?) -> array of rows.
     * Callback signature: (err, rows).
     */
    all: function (sql, params, callback) {
        const n = normalizeArgs(params, callback);
        const hasCb = typeof n.callback === 'function';

        const runQuery = (done) => {
            pool.query(sql, n.params, (err, rows) => {
                if (err) return done(err);
                done(null, rows || []);
            });
        };

        if (!hasCb) {
            return new Promise((resolve, reject) => {
                runQuery((err, rows) => (err ? reject(err) : resolve(rows)));
            });
        }
        runQuery(n.callback);
    },
/**
     * db.run(sql, params?, cb?) -> execute statement.
     * Callback is invoked as a NORMAL function so `this.lastID` and
     * `this.changes` are available (matches models that read them).
     * Callback signature: (err).
     */
    run: function (sql, params, callback) {
        const n = normalizeArgs(params, callback);
        const hasCb = typeof n.callback === 'function';

        const runQuery = (done) => {
            pool.query(sql, n.params, (err, result) => {
                if (err) return done(err);
                const context = {
                    lastID: result ? result.insertId : null,
                    changes: result ? result.affectedRows : 0
                };
                done(null, context);
            });
        };

        if (!hasCb) {
            return new Promise((resolve, reject) => {
                runQuery((err, context) => (err ? reject(err) : resolve(context)));
            });
        }

        runQuery((err, context) => {
            if (err) return n.callback(err);
            n.callback.call(context, null);
        });
    },
/**
     * db.prepare(sql) -> statement object compatible with the way models use it:
     *   stmt.run(param1, param2, ..., cb)   variadic params + optional trailing cb
     *   stmt.run([p1, p2, ...])             single array (fire-and-forget)
     *   stmt.get/all(...)                   row(s) reads
     *   stmt.finalize(cb?)                  waits for pending run()s, then calls cb(lastError)
     *
     * `finalize(cb)` resolves only after all pending async run() calls finish,
     * which faithfully emulates the synchronous better-sqlite3 pattern that the
     * models were written against (e.g. RubricModel.saveMeetingScores).
     */
    prepare: function (sql) {
        const stmt = {
            _pending: 0,
            _started: false,
            _finalized: false,
            _latestError: null,
            _finalizeCb: null,

            _maybeFinalize: function () {
                if (stmt._started && stmt._finalized && stmt._pending === 0 && stmt._finalizeCb) {
                    const cb = stmt._finalizeCb;
                    stmt._finalizeCb = null;
                    cb();
                }
            },

            run: function () {
                const args = Array.prototype.slice.call(arguments);
                const cb = (args.length && typeof args[args.length - 1] === 'function') ? args.pop() : null;
                const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;

                stmt._pending++;
                return db.run(sql, params, function (err) {
                    if (err) stmt._latestError = err;
                    stmt._pending--;
                    if (cb) return cb.call(this, err);
                    stmt._maybeFinalize();
                });
            },

            get: function () {
                const args = Array.prototype.slice.call(arguments);
                const cb = (args.length && typeof args[args.length - 1] === 'function') ? args.pop() : null;
                const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
                return db.get(sql, params, cb);
            },

            all: function () {
                const args = Array.prototype.slice.call(arguments);
                const cb = (args.length && typeof args[args.length - 1] === 'function') ? args.pop() : null;
                const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
                return db.all(sql, params, cb);
            },

            finalize: function (cb) {
                stmt._started = true;
                stmt._finalized = true;
                if (typeof cb === 'function') {
                    stmt._finalizeCb = () => cb(stmt._latestError || null);
                }
                stmt._maybeFinalize();
                return undefined;
            },

            reset: function () { return this; },
            close: function () { return undefined; }
        };
        return stmt;
    },

    // mysql2/sqlite3 compatibility for models that group statements with
    // db.serialize(fn). MySQL uses per-statement transactions, so this is a
    // passthrough that runs fn() so those models don't crash. (A pool cannot
    // guarantee one connection across statements; full transaction isolation
    // would require an explicit connection checkout.)
    serialize: function (fn) {
        if (typeof fn === 'function') fn();
        return this;
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