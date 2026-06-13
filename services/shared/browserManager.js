/**
 * root/services/shared/browserManager.js
 *
 */
const puppeteer = require('puppeteer');
const { logger } = require('../../utils/logger');
const settings = require('../../config/settings');
const fs = require('fs');
const { promisify } = require('util');
const { exec: execCb } = require('child_process');
const exec = promisify(execCb);

class BrowserManager {
  constructor() {
    this.browser = null;
    this.page = null;
    this.profileDir = null;
    this.deleteProfileOnClose = false;
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
      if (!fs.existsSync(profileDir)) {
        fs.mkdirSync(profileDir, { recursive: true });
      }

      launchOptions.userDataDir = profileDir;
      this.profileDir = profileDir;
      this.deleteProfileOnClose = config.deleteProfileOnClose ?? false;

      logger.info(
        `Shared(browserManager): INIT: Using Chrome profile -> ${profileDir}`
      );
    } else {
      logger.info(
        'Shared(browserManager): INIT: Using temporary Chrome profile'
      );
    }

    this.browser = await puppeteer.launch(launchOptions);

    this.browser.on('disconnected', () => {
      logger.error('Shared(browserManager): Chrome browser disconnected');
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

    // ✅ Stealth patch
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
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      logger.info('Shared(browserManager): Browser session closed.');
    }

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
    }
  }

  async waitForNoChromeLock(profileDir) {
    const maxAttempts = 5;
    const delayMs = 1000;

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
    const normalizedProfileDir = profileDir.replace(/\\/g, '/');
    const command = `wmic process where "CommandLine like '%--user-data-dir=${normalizedProfileDir}%'" get ProcessId`;

    try {
      const { stdout } = await exec(command, { windowsHide: true });
      return stdout.trim().split(/\r?\n/).some(line => /\d+/.test(line));
    } catch (err) {
      logger.warn('Shared(browserManager): Failed to query Chrome processes for profile lock, assuming no lock.', err);
      return false;
    }
  }
}

module.exports = BrowserManager;