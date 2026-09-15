/**
 * services/shared/browserManager.js
 *
 */
const path = require('path');
const puppeteer = require('puppeteer');
const { logger } = require('../../utils/logger');
const settings = require('../../config/settings');
const fs = require('fs');
const { promisify } = require('util');
const { exec: execCb } = require('child_process');
const exec = promisify(execCb);
const ProfileManager = require('./profileManager');

class BrowserManager {
  constructor(config = {}) {
    this.browser = null;
    this.page = null;
    this.profileDir = null;
    this.deleteProfileOnClose = false;

    // Chrome profile lifecycle tracking (services/shared/profileManager.js).
    this.profileRecordId = null;   // chrome_profiles.id when this profile is DB-tracked
    this.intentionalClose = false; // true once close() is called - distinguishes normal close from crash
    this._browserPid = null;

    // Lock-wait knobs (defaults preserve the original behaviour).
    this.lockWaitMaxAttempts = config.lockWaitMaxAttempts ?? 5;
    this.lockWaitDelayMs = config.lockWaitDelayMs ?? 1000;
  }

  async init(config = {}) {
    logger.info('Shared(browserManager): INIT: Launching Chrome (Stealth Mode, Persistent Profile)');

    const launchOptions = {
      ...settings.puppeteer,
      args: settings.puppeteer.args,
      dumpio: true
    };

    const profileDir = config.userDataDir || settings.puppeteer.userDataDir;

    if (profileDir) {
      // DB-tracked lifecycle applies ONLY to explicitly-requested profile dirs
      // under the managed chrome-profiles root (legacy paths like ./user_data
      // stay untouched). The existing profile_<id> naming is never changed -
      // the directory is registered in the chrome_profiles table as-is.
      if (config.userDataDir && ProfileManager.isManagedProfileDir(profileDir)) {
        try {
          const registration = await ProfileManager.registerProfile({
            profilePath: profileDir,
            botInstanceId: config.botInstanceId || null,
            meetingId: config.meetingId || null
          });
          this.profileRecordId = registration.id;
        } catch (err) {
          logger.error(`Shared(browserManager): Failed to register Chrome profile in DB: ${err.message}`);
        }
      }

      if (!fs.existsSync(profileDir)) {
        fs.mkdirSync(profileDir, { recursive: true });
      }

      launchOptions.userDataDir = profileDir;
      this.profileDir = profileDir;
      this.deleteProfileOnClose = config.deleteProfileOnClose ?? false;

      // Every DB-tracked profile must end up cleaned reliably (crash-safe),
      // so force deletion for tracked profiles regardless of the flag.
      if (this.profileRecordId) {
        this.deleteProfileOnClose = true;
      }

      logger.info(
        `Shared(browserManager): INIT: Using Chrome profile -> ${profileDir}`
      );
    } else {
      logger.info(
        'Shared(browserManager): INIT: Using temporary Chrome profile'
      );
    }

    try {
      this.browser = await puppeteer.launch(launchOptions);
    } catch (launchErr) {
      // If the launch failed after the DB row was registered, leave cleanup
      // to the profile sweeper (CLEANUP_PENDING -> retried -> CLEANED).
      if (this.profileRecordId) {
        await ProfileManager.onLaunchError(this.profileRecordId, launchErr).catch(() => {});
      }
      throw launchErr;
    }

    this._browserPid = this.browser.process() ? this.browser.process().pid : null;

    // DB: ACTIVE once Chrome is actually running with this profile.
    try {
      await ProfileManager.markActive(this.profileRecordId, this._browserPid);
    } catch (err) {
      logger.warn(`Shared(browserManager): Failed to mark Chrome profile ACTIVE: ${err.message}`);
    }

    this.browser.on('disconnected', () => {
      logger.error('Shared(browserManager): Chrome browser disconnected');

      // If this was NOT an intentional close(), Chrome died on its own -
      // funnel it into the CLEANUP_PENDING lifecycle immediately.
      if (this.profileRecordId && !this.intentionalClose) {
        ProfileManager.onUnexpectedDisconnect(this.profileRecordId, {
          profilePath: this.profileDir,
          browserPid: this._browserPid
        }).catch(err => {
          logger.error('Shared(browserManager): Unexpected-disconnect cleanup failed:', err);
        });
      }
    });

    this.pages = await this.browser.pages();

    this.page =
      this.pages.length > 0
        ? this.pages[0]
        : await this.browser.newPage();

    this.page.setDefaultTimeout(30000);
    this.page.setDefaultNavigationTimeout(60000);

    this.page.on('pageerror', err => {
      if (!err) return;
      logger.error(
        `PAGE ERROR: ${err?.stack || err?.message || JSON.stringify(err)}`
      );
    });

    await this.page.setRequestInterception(true);

    this.page.on('request', req => {
      const url = req.url();

      if (
        url.includes('skype.com') ||
        url.includes('edge.skype.com') ||
        url.includes('telemetry') ||
        url.includes('statics.teams.cdn.live.net')
      ) {
        return req.abort();
      }

      req.continue();
    });

    this.page.on('requestfailed', req => {
      logger.warn(
        `Shared(browserManager): REQUEST FAILED: ${req.url()} -> ${req.failure()?.errorText}`
      );
    });

    // Stealth patch
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      window.chrome = { runtime: {} };

      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3],
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });

    return this;
  }

  async close() {
    // Intentional shutdown - the 'disconnected' handler must treat the
    // upcoming browser.close() as expected, not as a crash.
    this.intentionalClose = true;

    if (this.profileRecordId) {
      // Normal-close lifecycle: ACTIVE -> CLOSING -> (kill/wait/delete/verify)
      // -> CLEANED.
      try {
        await ProfileManager.beginClose(this.profileRecordId);
      } catch (err) {
        logger.error(`Shared(browserManager): Failed to mark profile CLOSING: ${err.message}`);
      }
    }

    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        logger.info('Shared(browserManager): Browser session closed.');
      }
    } catch (err) {
      // Browser already gone (e.g. it crashed) - cleanup below still runs.
      this.browser = null;
      this.page = null;
      logger.warn(`Shared(browserManager): Browser close error (continuing cleanup): ${err.message}`);
    }

    if (this.profileRecordId && this.profileDir) {
      // Cleanup is idempotent; if a crash-cleanup already handled it, this
      // resolves as a no-op (CLEANED skip / in-flight lock).
      try {
        await ProfileManager.cleanupProfile(this.profileRecordId, {
          profilePath: this.profileDir,
          browserPid: this._browserPid
        });
        logger.info('Shared(browserManager): Profile cleanup done (DB lifecycle).');
      } catch (err) {
        logger.error(`Shared(browserManager): Profile cleanup failed: ${err.message}`);
      }
      return;
    }

    // Legacy non-DB path (e.g. standalone adapters using ./user_data).
    if (this.deleteProfileOnClose && this.profileDir) {
      await this.cleanupProfileDir();
    }
  }

  async cleanupProfileDir() {
    const profileDir = this.profileDir;
    if (!profileDir || !fs.existsSync(profileDir)) {
      return;
    }

    logger.info(`Shared(browserManager): Cleaning up Chrome profile directory -> ${profileDir}`);

    try {
      await this.waitForNoChromeLock(profileDir);
      await fs.promises.rm(profileDir, { recursive: true, force: true });
      logger.info(`Shared(browserManager): Removed Chrome profile directory -> ${profileDir}`);
    } catch (err) {
      logger.error(`Shared(browserManager): Failed to remove Chrome profile directory -> ${profileDir}`, err);
      await this.forceTerminateChromeProcesses(profileDir);
      try {
        await fs.promises.rm(profileDir, { recursive: true, force: true });
        logger.info(`Shared(browserManager): Removed Chrome profile directory after forced termination -> ${profileDir}`);
      } catch (innerErr) {
        logger.error(`Shared(browserManager): Still failed to remove Chrome profile directory -> ${profileDir}`, innerErr);
      }
    }
  }

  async waitForNoChromeLock(profileDir) {
    const maxAttempts = this.lockWaitMaxAttempts;
    const delayMs = this.lockWaitDelayMs;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const running = await this.isChromeUsingProfile(profileDir);
      if (!running) {
        return;
      }

      logger.warn(
        `Shared(browserManager): Chrome profile still in use, waiting before deletion (attempt ${attempt}/${maxAttempts})`
      );
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw new Error('Chrome profile directory still in use after waiting.');
  }

  async isChromeUsingProfile(profileDir) {
    try {
      const processes = await listChromeProcesses(exec);
      return processes.some(p => commandLineUsesProfile(p.commandLine, profileDir));
    } catch (err) {
      logger.warn('Shared(browserManager): Failed to query Chrome processes for profile lock, assuming no lock.', err);
      return false;
    }
  }

  async forceTerminateChromeProcesses(profileDir) {
    try {
      const processes = await listChromeProcesses(exec);
      const matches = processes.filter(p => commandLineUsesProfile(p.commandLine, profileDir));

      for (const { pid } of matches) {
        try {
          await exec(`taskkill /PID ${pid} /F`, { windowsHide: true });
          logger.info(`Shared(browserManager): Force killed Chrome process PID=${pid}`);
        } catch (killErr) {
          logger.warn(`Shared(browserManager): Failed to kill Chrome process PID=${pid}`, killErr);
        }
      }
    } catch (err) {
      logger.warn('Shared(browserManager): Failed to query Chrome processes for forced termination.', err);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// FIX: isChromeUsingProfile()/forceTerminateChromeProcesses() previously
// embedded the profile directory directly into a WQL `LIKE` clause
// (`CommandLine like '%--user-data-dir=<path>%'`), after normalizing the
// path to forward slashes. Two problems with that:
//
//   1. Puppeteer launches Chrome with the OS-native path, so on Windows the
//      REAL --user-data-dir in a running process's CommandLine uses
//      backslashes - the forward-slash-normalized LIKE pattern this file
//      was searching for could never match it, so this could never reliably
//      detect a truly-active profile.
//   2. WQL's LIKE treats backslash as its own escape character, so an
//      unescaped path (or a query wmic otherwise chokes on) can make the
//      whole `wmic ... get ProcessId` call fail or emit non-tabular
//      error/help text - and the old check (`/\d+/.test(line)` - "does this
//      line contain ANY digit") would misread a numeric error/HRESULT code
//      in that error text as a matching PID, i.e. a false "still in use".
//      That false positive is what was seen after the ProfileManager
//      startup-recovery fix started actually running this cleanup for the
//      first time: three already-dead profiles ("process PID not found")
//      still failed `waitForNoChromeLock` for all 5 attempts and were
//      marked FAILED.
//
// FIX: query ALL chrome.exe processes with a trivial, always-valid WQL
// clause (`Name='chrome.exe'`, no path/interpolation involved at all), then
// do the "does this process belong to this profile" match in plain JS
// against the process's own CommandLine, normalizing BOTH sides
// (backslash/forward-slash + case) before comparing - sidestepping WQL
// LIKE/escaping entirely - and only ever treat a line as a PID when it is
// (after trimming) purely digits, not "contains a digit somewhere".
// ──────────────────────────────────────────────────────────────────────────

/** True when `commandLine` looks like it was launched against `profileDir`. */
function commandLineUsesProfile(commandLine, profileDir) {
  return normalizeForCompare(commandLine).includes(normalizeForCompare(profileDir));
}

function normalizeForCompare(p) {
  return String(p || '').replace(/\\/g, '/').toLowerCase();
}

/**
 * Returns every currently-running chrome.exe process as {pid, commandLine}.
 * `execFn` is injectable (tests stub it instead of shelling out to wmic).
 * Uses /VALUE output (`Prop=Value` blocks separated by blank lines) rather
 * than the default table format - far easier to parse reliably than
 * column-aligned or CSV-with-embedded-commas output, since a Chrome command
 * line can itself contain commas.
 */
async function listChromeProcesses(execFn) {
  const command = 'wmic process where "Name=\'chrome.exe\'" get ProcessId,CommandLine /VALUE';
  const { stdout } = await execFn(command, { windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
  return parseWmicValueOutput(stdout);
}

/** Exported for unit testing - pure parsing, no process access. */
function parseWmicValueOutput(stdout) {
  const blocks = String(stdout || '').split(/\r?\n\s*\r?\n/);
  const processes = [];

  for (const block of blocks) {
    const pidMatch = block.match(/^ProcessId=(\d+)\s*$/m);
    if (!pidMatch) continue; // header/blank/malformed block - not a process row

    const cmdMatch = block.match(/^CommandLine=(.*)$/m);
    processes.push({
      pid: pidMatch[1],
      commandLine: cmdMatch ? cmdMatch[1].trim() : '',
    });
  }

  return processes;
}

module.exports = BrowserManager;
module.exports._internal = { commandLineUsesProfile, normalizeForCompare, listChromeProcesses, parseWmicValueOutput };
