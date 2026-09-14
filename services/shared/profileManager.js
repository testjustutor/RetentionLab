/**
 * root/services/shared/profileManager.js
 *
 * Reliable Chrome profile lifecycle: every profile directory created under
 * storage/chrome-profiles is tracked in the chrome_profiles table so profiles
 * can be cleaned up even after Chrome crashes or the server restarts.
 *
 * Statuses: CREATING -> ACTIVE -> CLOSING -> CLEANED   (normal close)
 *           ACTIVE   -> CLEANUP_PENDING -> CLEANED     (unexpected disconnect)
 *           CLEANUP_PENDING + retries exhausted -> FAILED
 *
 * A profile is never marked CLEANED unless its directory has actually been
 * deleted and verified as gone from disk.
 *
 * Guarantees:
 *  - Intentional browser close (BrowserManager.close) is distinguished from an
 *    unexpected disconnect (browser 'disconnected' without close() having been
 *    called) so crashes always funnel into CLEANUP_PENDING.
 *  - Cleanup is idempotent and safe to run multiple times (in-memory lock set +
 *    atomic DB status transitions prevent concurrent cleanup of one profile).
 *  - No DB transaction is ever held while waiting for Chrome locks or deleting
 *    files - every write is a single autocommit statement.
 *
 * browserOps is injectable so tests can stub the OS-level Chrome operations
 * (kill / lock-wait / process check) without launching a real browser.
 */
const fs = require('fs');
const path = require('path');
const { exec: execCb } = require('child_process');
const { promisify } = require('util');
const exec = promisify(execCb);
const { logger } = require('../../utils/logger');
const ChromeProfileModel = require('../../models/bot/ChromeProfileModel');

const DEFAULT_PROFILES_ROOT = path.resolve(__dirname, '..', '..', 'storage', 'chrome-profiles');

// Default OS-level browser operations - reuse the exact patterns from
// BrowserManager (wmic command-line match + taskkill fallback). browserManager
// is required lazily to avoid a module-load cycle (browserManager imports this
// module).
function createDefaultBrowserOps() {
  const BrowserManager = require('./browserManager');
  const opsInstance = new BrowserManager();
  return {
    isChromeUsingProfile: (dir) => opsInstance.isChromeUsingProfile(dir),
    waitForNoChromeLock: (dir) => opsInstance.waitForNoChromeLock(dir),
    forceTerminateChromeProcesses: (dir) => opsInstance.forceTerminateChromeProcesses(dir),
    killPid: async (pid) => {
      if (!pid) return;
      try {
        await exec(`taskkill /PID ${pid} /F`, { windowsHide: true });
        logger.info(`ProfileManager: Force killed Chrome PID=${pid} (browser_pid)`);
      } catch (err) {
        logger.warn(`ProfileManager: Failed to kill Chrome PID=${pid}: ${err.message}`);
      }
    }
  };
}

class ProfileManager {
  constructor() {
    this.profilesRoot = DEFAULT_PROFILES_ROOT;
    this.browserOps = null; // created lazily on first use
    this.maxRetries = parseInt(process.env.CHROME_PROFILE_CLEANUP_MAX_RETRIES || '5', 10);

    // In-process guards: paths currently being cleaned / registered as live,
    // preventing concurrent cleanup of the same profile.
    this._cleaning = new Set();
    this._live = new Set();
  }

  /** Override root/ops for tests. */
  configure(options = {}) {
    if (options.profilesRoot) this.profilesRoot = path.resolve(options.profilesRoot);
    if (options.browserOps) this.browserOps = options.browserOps;
    if (options.maxRetries != null) this.maxRetries = options.maxRetries;
    return this;
  }

  get ops() {
    if (!this.browserOps) this.browserOps = createDefaultBrowserOps();
    return this.browserOps;
  }

  _normalize(p) {
    return path.resolve(String(p)).replace(/\\/g, '/');
  }

  /** True when a directory lives inside the managed chrome-profiles root. */
  isManagedProfileDir(dirPath) {
    const root = this._normalize(this.profilesRoot);
    const dir = this._normalize(dirPath);
    if (dir === root) return false; // the root itself is not a profile
    const rel = path.relative(root, dir);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  }

  _ensureRoot() {
    if (!fs.existsSync(this.profilesRoot)) {
      fs.mkdirSync(this.profilesRoot, { recursive: true });
    }
  }

  // ------------------------------------------------------------------
  // LIFECYCLE
  // ------------------------------------------------------------------

  /**
   * Step 1 of creation: insert a CREATING row BEFORE the directory is created,
   * so no directory can ever exist without a DB record. The profile directory
   * NAME is never generated here - it mirrors the caller-provided path (such
   * as profile_6 / profile_7 from socraticbot).
   */
  async registerProfile({ profilePath, botInstanceId = null, meetingId = null }) {
    const normalized = path.resolve(String(profilePath));
    const profileName = path.basename(normalized);
    const normKey = this._normalize(normalized);

    let existing = null;
    try {
      existing = await ChromeProfileModel.findByPath(normalized);
    } catch (err) {
      logger.warn(`ProfileManager: findByPath failed for ${normalized}: ${err.message}`);
    }
    if (existing) {
      // Idempotent re-registration - reuse the row instead of a duplicate.
      if (existing.status === 'CLEANED') {
        await ChromeProfileModel.transitionStatus(existing.id, 'CLEANED', 'CREATING').catch(() => false);
      }
      this._live.add(normKey);
      return { id: existing.id, reused: true };
    }

    this._ensureRoot();
    const id = await ChromeProfileModel.create({
      profileName,
      profilePath: normalized,
      botInstanceId,
      meetingId
    });
    this._live.add(normKey);
    logger.info(`ProfileManager: Profile ${profileName} registered as CREATING (id=${id})`);
    return { id, reused: false };
  }

  /** Step 3 of creation: Chrome started - mark ACTIVE and store its pid. */
  async markActive(profileId, browserPid = null) {
    if (!profileId) return;
    if (browserPid) await ChromeProfileModel.updateBrowserPid(profileId, browserPid);
    await ChromeProfileModel.transitionStatus(profileId, 'CREATING', 'ACTIVE').catch(() => false);
    logger.info(`ProfileManager: Profile row ${profileId} -> ACTIVE (pid=${browserPid || 'n/a'})`);
  }

  /** Launch failed before Chrome came up - leave cleanup to the sweeper. */
  async onLaunchError(profileId, error) {
    if (!profileId) return;
    await ChromeProfileModel.updateLastError(profileId, (error && error.message) || String(error));
    await ChromeProfileModel.transitionStatus(profileId, 'CREATING', 'CLEANUP_PENDING').catch(() => false);
    logger.warn(`ProfileManager: Launch failed for profile row ${profileId} - left CLEANUP_PENDING`);
  }

  /** Normal close: ACTIVE -> CLOSING (atomic; no-op if already past ACTIVE). */
  async beginClose(profileId) {
    if (!profileId) return;
    const ok = await ChromeProfileModel.transitionStatus(profileId, 'ACTIVE', 'CLOSING');
    if (ok) logger.info(`ProfileManager: Profile row ${profileId} -> CLOSING`);
  }

  /**
   * Unexpected disconnect (Chrome crashed / killed): ACTIVE -> CLEANUP_PENDING
   * and immediately attempt cleanup. Idempotent - repeated calls are safe.
   */
  async onUnexpectedDisconnect(profileId, { profilePath = null, browserPid = null } = {}) {
    if (!profileId) return null;
    const row = await ChromeProfileModel.getById(profileId);
    if (!row) {
      logger.warn(`ProfileManager: onUnexpectedDisconnect unknown profile row ${profileId}`);
      return null;
    }
    if (row.status === 'CLEANED') return null;

    if (row.status === 'ACTIVE' || row.status === 'CREATING') {
      await ChromeProfileModel.transitionStatus(profileId, row.status, 'CLEANUP_PENDING');
      logger.warn(`ProfileManager: Unexpected Chrome disconnect for ${row.profile_name} -> CLEANUP_PENDING`);
    }
    return this.cleanupProfile(profileId, {
      profilePath: profilePath || row.profile_path,
      browserPid: browserPid || row.browser_pid
    });
  }

  // ------------------------------------------------------------------
  // CLEANUP
  // ------------------------------------------------------------------

  /**
   * The single idempotent cleanup routine: kill leftover Chrome, wait for the
   * profile lock to be released, delete the directory, VERIFY it is gone, and
   * only then mark CLEANED. Any failure leaves the row CLEANUP_PENDING (or
   * FAILED once retries are exhausted) so a later sweep can retry.
   */
  async cleanupProfile(profileId, { profilePath = null, browserPid = null } = {}) {
    if (!profileId) return { skipped: true };

    let row = await ChromeProfileModel.getById(profileId);
    if (!row) {
      logger.warn(`ProfileManager: cleanup unknown profile row ${profileId}`);
      return { skipped: true };
    }
    if (row.status === 'CLEANED') return { skipped: true };

    const dir = path.resolve(String(profilePath || row.profile_path));
    const lockKey = this._normalize(dir);

    if (this._cleaning.has(lockKey)) {
      logger.warn(`ProfileManager: Cleanup already in progress for ${dir} - skipping concurrent call.`);
      return { skipped: true };
    }
    this._cleaning.add(lockKey);
    try {
      // 1) Terminate any Chrome process still bound to this profile.
      try { await this.ops.forceTerminateChromeProcesses(dir); }
      catch (err) { logger.warn(`ProfileManager: forceTerminate error for ${dir}: ${err.message}`); }
      try { await this.ops.killPid(browserPid || row.browser_pid); }
      catch (err) { logger.warn(`ProfileManager: killPid error for ${dir}: ${err.message}`); }

      // 2) Wait until Chrome's profile lock is released.
      try {
        await this.ops.waitForNoChromeLock(dir);
      } catch (err) {
        await ChromeProfileModel.recordCleanupFailure(profileId, `lock not released: ${err.message}`, this.maxRetries);
        return { cleaned: false, error: err.message };
      }

      // 3) Delete the directory (if it still exists).
      if (fs.existsSync(dir)) {
        try {
          await fs.promises.rm(dir, { recursive: true, force: true });
          logger.info(`ProfileManager: Removed profile directory ${dir}`);
        } catch (err) {
          await ChromeProfileModel.recordCleanupFailure(profileId, `delete failed: ${err.message}`, this.maxRetries);
          return { cleaned: false, error: err.message };
        }
      } else {
        logger.warn(`ProfileManager: Profile dir already gone ${dir}`);
      }

      // 4) Never mark CLEANED unless the directory is verified gone.
      if (fs.existsSync(dir)) {
        await ChromeProfileModel.recordCleanupFailure(profileId, 'directory still exists after delete', this.maxRetries);
        return { cleaned: false, error: 'directory still exists after delete' };
      }

      await ChromeProfileModel.markCleaned(profileId);
      this._live.delete(lockKey);
      logger.info(`ProfileManager: Profile ${dir} cleaned -> CLEANED`);
      return { cleaned: true };
    } finally {
      this._cleaning.delete(lockKey);
    }
  }

  // ------------------------------------------------------------------
  // STARTUP RECOVERY / RETRIES / ORPHANS
  // ------------------------------------------------------------------

  /**
   * On startup: every row not CLEANED is inspected. If its Chrome process is
   * still running the profile is left alone; otherwise it is cleaned and (if
   * the directory is actually gone) marked CLEANED.
   */
  async startupRecovery() {
    const rows = await ChromeProfileModel.getNonCleaned();
    logger.info(`ProfileManager: Startup recovery - ${rows.length} non-CLEANED profile(s) to inspect.`);

    const results = { inspected: rows.length, cleaned: 0, leftAlive: 0, failed: 0 };
    for (const row of rows) {
      const dir = row.profile_path;
      const chromeAlive = await this.ops.isChromeUsingProfile(dir).catch(() => false);
      const pidAlive = await this._isPidAlive(row.browser_pid);

      if (row.status === 'ACTIVE' && (chromeAlive || pidAlive)) {
        logger.info(`ProfileManager: Recovery - ${dir} still has Chrome running, leaving ACTIVE.`);
        results.leftAlive += 1;
        continue;
      }

      const outcome = await this.cleanupProfile(row.id, { profilePath: dir, browserPid: row.browser_pid });
      if (outcome.cleaned) results.cleaned += 1;
      else if (!outcome.skipped) results.failed += 1;
    }
    logger.info(`ProfileManager: Startup recovery done - ${JSON.stringify(results)}`);
    return results;
  }

  /** Periodic sweep: retry CLEANUP_PENDING rows (and clean orphans). */
  async runPeriodicSweep() {
    await this.retryPendingCleanups();
    await this.scanAndCleanOrphans();
  }

  /** Retry every profile that previously failed to be deleted. */
  async retryPendingCleanups() {
    const rows = await ChromeProfileModel.getCleanupPending();
    if (rows.length === 0) return { attempted: 0, cleaned: 0 };
    logger.info(`ProfileManager: Retrying ${rows.length} CLEANUP_PENDING profile(s).`);
    let cleaned = 0;
    for (const row of rows) {
      const outcome = await this.cleanupProfile(row.id, { profilePath: row.profile_path, browserPid: row.browser_pid });
      if (outcome.cleaned) cleaned += 1;
    }
    return { attempted: rows.length, cleaned };
  }

  /**
   * Remove directories under the profiles root that have NO DB record behind
   * them, as long as they are not in use by a Chrome process and are not
   * registered as live in this process.
   */
  async scanAndCleanOrphans() {
    if (!fs.existsSync(this.profilesRoot)) {
      logger.info('ProfileManager: No profiles root yet - skipping orphan scan.');
      return { orphaned: [], removed: 0 };
    }

    const knownPaths = new Set(
      (await ChromeProfileModel.getAllProfilePaths()).map(p => this._normalize(p))
    );
    const protectedPaths = new Set([...knownPaths, ...Array.from(this._live)]);

    const orphans = [];
    for (const entry of fs.readdirSync(this.profilesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = path.join(this.profilesRoot, entry.name);
      const norm = this._normalize(full);
      if (protectedPaths.has(norm)) continue;

      const inUse = await this.ops.isChromeUsingProfile(full).catch(() => false);
      if (inUse) {
        logger.warn(`ProfileManager: Orphan dir ${full} still in use by Chrome - kept.`);
        continue;
      }

      orphans.push(entry.name);
      try {
        await fs.promises.rm(full, { recursive: true, force: true });
        logger.warn(`ProfileManager: Removed orphan Chrome profile dir ${full}`);
      } catch (err) {
        logger.warn(`ProfileManager: Failed to remove orphan dir ${full}: ${err.message}`);
      }
    }

    logger.info(`ProfileManager: Orphan scan - ${orphans.length} orphan(s) removed.`);
    return { orphaned: orphans, removed: orphans.length };
  }

  async _isPidAlive(pid) {
    if (!pid) return false;
    try {
      const { stdout } = await exec(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { windowsHide: true });
      return /^\s*"[\w.]+\"/m.test(stdout);
    } catch (err) {
      return false;
    }
  }
}

module.exports = new ProfileManager();
