const puppeteer = require('puppeteer');
const { logger } = require('../utils/logger');
const settings = require('../config/settings');
const fs = require('fs');

class BrowserManager {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async init(config) {
    logger.info('DefaultAdapter(browserManager): INIT: Launching Chrome (Stealth Mode, Persistent Profile)');
    
    this.browser = await puppeteer.launch({
      ...settings.puppeteer,
      userDataDir: config.userDataDir || settings.puppeteer.userDataDir,
      args: settings.puppeteer.args
    });
    
    this.page = await this.browser.newPage();

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
      logger.info('DefaultAdapter(browserManager): Browser session closed.');
    }
  }
}

module.exports = BrowserManager;