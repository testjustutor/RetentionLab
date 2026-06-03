const puppeteer = require('puppeteer');
const { logger } = require('../../utils/logger');
const settings = require('../../config/settings');
const fs = require('fs');

class BrowserManager {
  constructor() {
    this.browser = null;
    this.page = null;
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
  }
}

module.exports = BrowserManager;