/**
 * root/services/platforms/teams/TeamsAdapter.js
 *
 */
 /**
 * Microsoft Teams Platform Adapter
 * Basic implementation using Puppeteer for Teams meetings
 */

const puppeteer = require('puppeteer');
const { logger } = require('../../../utils/logger');
const TranscriptModel = require('../../../models/transcriptModel');
const botManager = require('../../shared/botManager');

class TeamsAdapter {
  constructor(config) {
    this.config = {
      platform: 'teams',
      meetingId: config.meetingId,
      meetingUrl: config.meetingUrl,
      botName: config.botName || 'TeamsBot',
      webhookUrl: config.webhookUrl
    };
    this.browser = null;
    this.page = null;
    this.sessionId = null;
  }

  async startBot() {
    try {
      // Check if already running
      if (botManager.instances.has(this.config.meetingId)) {
        const existing = botManager.instances.get(this.config.meetingId);
        if (existing.status === 'running' || existing.status === 'joining') {
          return {
            success: false,
            error: `Teams bot already running for meeting ${this.config.meetingId}`,
            meetingId: this.config.meetingId,
            status: existing.status
          };
        }
      }

      logger.info(`TeamsAdapter: Starting bot for meeting ${this.config.meetingId}`);

      // Create session
      const session = await TranscriptModel.createSession(this.config.meetingId);
      this.sessionId = session.id;

      // Launch browser
      this.browser = await puppeteer.launch({
        headless: false, // Teams requires visible browser for joining
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      this.page = await this.browser.newPage();

      // Set user agent to appear more like a real browser
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      // Track in botManager
      botManager.instances.set(this.config.meetingId, {
        bot: this,
        status: 'joining',
        startedAt: Date.now(),
        config: this.config,
        sessionId: this.sessionId,
        adapter: this
      });

      // Start Teams joining process
      this.joinTeamsMeeting().catch(err => {
        logger.error(`TeamsAdapter: Error joining meeting ${this.config.meetingId}:`, err);
        this.cleanup();
      });

      return {
        success: true,
        meetingId: this.config.meetingId,
        sessionId: this.sessionId,
        platform: 'teams',
        status: 'joining',
        message: 'Teams bot started - joining meeting...'
      };
    } catch (err) {
      logger.error('TeamsAdapter: Error starting bot:', err);
      this.cleanup();
      return {
        success: false,
        error: err.message,
        meetingId: this.config.meetingId
      };
    }
  }

  async joinTeamsMeeting() {
    try {
      logger.info(`TeamsAdapter: Navigating to ${this.config.meetingUrl}`);

      // Navigate to Teams meeting
      await this.page.goto(this.config.meetingUrl, { waitUntil: 'networkidle2' });

      // Wait for and click join button
      await this.page.waitForSelector('[data-tid="join-button"]', { timeout: 30000 });
      await this.page.click('[data-tid="join-button"]');

      // Handle name input if required
      try {
        await this.page.waitForSelector('input[type="text"]', { timeout: 5000 });
        await this.page.type('input[type="text"]', this.config.botName);
        await this.page.keyboard.press('Enter');
      } catch (e) {
        logger.info('TeamsAdapter: No name input required');
      }

      // Wait for meeting to load
      await this.page.waitForSelector('[data-tid="calling-screen"]', { timeout: 30000 });

      // Update status
      const instance = botManager.instances.get(this.config.meetingId);
      if (instance) {
        instance.status = 'running';
      }

      logger.info(`TeamsAdapter: Successfully joined Teams meeting ${this.config.meetingId}`);

      // Start transcript monitoring
      this.monitorTranscript();

    } catch (err) {
      logger.error('TeamsAdapter: Error joining Teams meeting:', err);
      throw err;
    }
  }

  async monitorTranscript() {
    try {
      // Teams transcript monitoring logic would go here
      // This is a simplified version - real implementation would need:
      // - Detect when someone speaks
      // - Capture captions/transcript
      // - Save to database

      logger.info(`TeamsAdapter: Starting transcript monitoring for ${this.config.meetingId}`);

      // Placeholder for transcript monitoring
      // In a real implementation, you'd:
      // 1. Monitor DOM for new transcript entries
      // 2. Extract speaker and text
      // 3. Save to TranscriptModel

    } catch (err) {
      logger.error('TeamsAdapter: Error monitoring transcript:', err);
    }
  }

  async stopBot() {
    try {
      logger.info(`TeamsAdapter: Stopping bot for meeting ${this.config.meetingId}`);
      this.cleanup();

      return {
        success: true,
        meetingId: this.config.meetingId,
        message: 'Teams bot stopped'
      };
    } catch (err) {
      logger.error('TeamsAdapter: Error stopping bot:', err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  async getStatus() {
    const instance = botManager.instances.get(this.config.meetingId);
    return {
      meetingId: this.config.meetingId,
      status: instance ? instance.status : 'stopped',
      platform: 'teams',
      sessionId: this.sessionId
    };
  }

  cleanup() {
    try {
      if (this.page) {
        this.page.close();
        this.page = null;
      }
      if (this.browser) {
        this.browser.close();
        this.browser = null;
      }
      botManager.instances.delete(this.config.meetingId);
    } catch (err) {
      logger.error('TeamsAdapter: Error during cleanup:', err);
    }
  }
}

module.exports = TeamsAdapter;
