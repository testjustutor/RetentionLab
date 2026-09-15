/**
 * root/models/bot/ChromeProfileModel.js
 *
 * Data access layer for the chrome_profiles table. Every profile directory
 * created under storage/chrome-profiles is tracked here so it can be cleaned
 * up reliably even after Chrome crashes or the Node server restarts.
 *
 * SQL lives in this model (never in controllers/services), and every write is
 * a single autocommit statement - no transaction is ever held across slow
 * file-system work (Chrome lock waits / directory deletion).
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

// Promisified run helper matching the MySQL shim's callback style.
const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) return reject(err);
    resolve({ lastID: this.lastID, changes: this.changes });
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
});

const STATUSES = ['CREATING', 'ACTIVE', 'CLOSING', 'CLEANUP_PENDING', 'CLEANED', 'FAILED'];

class ChromeProfileModel {
  /**
   * Insert a row in CREATING state BEFORE the profile directory is created,
   * so no directory can ever exist on disk without a DB record behind it.
   */
  static async create({ profileName, profilePath, botInstanceId = null, meetingId = null }) {
    const result = await run(
      `INSERT INTO chrome_profiles (profile_name, profile_path, status, browser_pid, bot_instance_id, meeting_id, cleanup_attempts)
       VALUES (?, ?, 'CREATING', NULL, ?, ?, 0)`,
      [profileName, profilePath, botInstanceId, meetingId]
    );
    logger.info(`Model(ChromeProfileModel): row created id=${result.lastID} (${profilePath})`);
    return result.lastID;
  }

  static async getById(id) {
    return get('SELECT * FROM chrome_profiles WHERE id = ?', [id]);
  }

  static async findByPath(profilePath) {
    return get('SELECT * FROM chrome_profiles WHERE profile_path = ?', [profilePath]);
  }

  /** Atomic compare-and-swap so two writers can never double-transition. */
  static async transitionStatus(id, expected, next) {
    const result = await run(
      'UPDATE chrome_profiles SET status = ? WHERE id = ? AND status = ?',
      [next, id, expected]
    );
    return (result.changes || 0) === 1;
  }

  static async updateBrowserPid(id, browserPid) {
    await run('UPDATE chrome_profiles SET browser_pid = ? WHERE id = ?', [browserPid, id]);
  }

  static async updateLastError(id, message) {
    await run('UPDATE chrome_profiles SET last_error = ? WHERE id = ?',
      [String(message || '').slice(0, 2000), id]);
  }

  /** Rows that still need attention on startup (everything except CLEANED). */
  static async getNonCleaned() {
    return all("SELECT * FROM chrome_profiles WHERE status <> 'CLEANED' ORDER BY id ASC");
  }

  static async getCleanupPending() {
    return all("SELECT * FROM chrome_profiles WHERE status = 'CLEANUP_PENDING' ORDER BY id ASC");
  }

  static async getAllProfilePaths() {
    const rows = await all('SELECT profile_path FROM chrome_profiles');
    return rows.map(r => r.profile_path);
  }

  static async countByStatus(status) {
    const row = await get('SELECT COUNT(*) AS n FROM chrome_profiles WHERE status = ?', [status]);
    return Number((row && row.n) || 0);
  }

  /**
   * Mark CLEANED - the ONLY transition that requires the directory to have
   * been verified as gone. cleanup_completed_at records when it happened.
   */
  static async markCleaned(id) {
    const result = await run(
      `UPDATE chrome_profiles
         SET status = 'CLEANED', cleanup_completed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status IN ('CREATING', 'ACTIVE', 'CLOSING', 'CLEANUP_PENDING', 'FAILED')`,
      [id]
    );
    if ((result.changes || 0) === 1) {
      logger.info(`Model(ChromeProfileModel): profile id=${id} marked CLEANED`);
    }
    return (result.changes || 0) === 1;
  }

  /**
   * Record a failed cleanup attempt. Stays CLEANUP_PENDING (so a later sweep /
   * restart can retry) until cleanup_attempts reaches maxRetries, after which
   * the profile becomes FAILED and is no longer auto-retried.
   */
  static async recordCleanupFailure(id, errorMessage, maxRetries = 5) {
    const row = await get('SELECT cleanup_attempts, status FROM chrome_profiles WHERE id = ?', [id]);
    if (!row || row.status === 'CLEANED') return false;

    const attempts = Number(row.cleanup_attempts || 0) + 1;
    const nextStatus = attempts >= maxRetries ? 'FAILED' : 'CLEANUP_PENDING';

    await run(
      `UPDATE chrome_profiles
         SET status = ?, cleanup_attempts = ?, last_error = ?
       WHERE id = ? AND status <> 'CLEANED'`,
      [nextStatus, attempts, String(errorMessage || 'unknown cleanup error').slice(0, 2000), id]
    );
    logger.warn(`Model(ChromeProfileModel): profile id=${id} cleanup failed (attempt ${attempts}/${maxRetries}) - status ${nextStatus}: ${errorMessage}`);
    return true;
  }

  static async deleteByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    const placeholders = ids.map(() => '?').join(', ');
    const result = await run(`DELETE FROM chrome_profiles WHERE id IN (${placeholders})`, ids);
    return result.changes || 0;
  }
}

ChromeProfileModel.STATUSES = STATUSES;

module.exports = ChromeProfileModel;
