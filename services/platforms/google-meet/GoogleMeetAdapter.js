/**
 * Google Meet Platform Adapter
 * Basic implementation using Puppeteer for Google Meet
 */

const puppeteer = require('puppeteer');
const { logger } = require('../../../utils/logger');
const TranscriptModel = require('../../../models/transcriptModel');
const botManager = require('../../shared/botManager');
const { monitorMeeting } = require('./monitor');

class GoogleMeetAdapter {
  constructor(config) {
    this.config = {
      platform: 'google-meet',
      meetingId: config.meetingId,
      meetingUrl: config.meetingUrl,
      botName: config.botName || 'GoogleMeetBot',
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
            error: `Google Meet bot already running for meeting ${this.config.meetingId}`,
            meetingId: this.config.meetingId,
            status: existing.status
          };
        }
      }

      logger.info(`GoogleMeetAdapter(GoogleMeetAdapter): Starting bot for goole meet meeting ${this.config.meetingId}`);

      // Create session
      const session = await TranscriptModel.createSession(this.config.meetingId);
      this.sessionId = session.id;

      // Launch browser
      this.browser = await puppeteer.launch({
        headless: false, // Meet requires visible browser for joining
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--use-fake-ui-for-media-stream', // Allow camera/microphone access
          '--use-fake-device-for-media-stream'
        ]
      });

      this.page = await this.browser.newPage();

      // Set user agent
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

      // Start Google Meet joining process
      this.joinGoogleMeet().catch(err => {
        logger.error(`GoogleMeetAdapter(GoogleMeetAdapter): Error joining meeting ${this.config.meetingId}:`, err);
        this.cleanup();
      });

      return {
        success: true,
        meetingId: this.config.meetingId,
        sessionId: this.sessionId,
        platform: 'google-meet',
        status: 'joining',
        message: 'Google Meet bot started - joining meeting...'
      };
    } catch (err) {
      logger.error('GoogleMeetAdapter(GoogleMeetAdapter): Error starting bot:', err);
      this.cleanup();
      return {
        success: false,
        error: err.message,
        meetingId: this.config.meetingId
      };
    }
  }

  async joinGoogleMeet() {
    try {
      logger.info(`GoogleMeetAdapter(GoogleMeetAdapter): Navigating to ${this.config.meetingUrl}`);

      // Navigate to Google Meet
      await this.page.goto(this.config.meetingUrl, { waitUntil: 'networkidle2' });

      // Handle "Turn on camera/microphone" prompts
      try {
        // Click "Continue without microphone and camera" or similar
        await this.page.waitForSelector('[data-mdc-dialog-action="accept"]', { timeout: 10000 });
        await this.page.click('[data-mdc-dialog-action="accept"]');
      } catch (e) {
        logger.info('GoogleMeetAdapter(GoogleMeetAdapter): No camera/microphone prompt');
      }

      // Enter name if required
      try {
        await this.page.waitForSelector('input[type="text"]', { timeout: 5000 });
        await this.page.type('input[type="text"]', this.config.botName);

        // Click join button
        await this.page.waitForSelector('[data-mdc-dialog-action="accept"]', { timeout: 5000 });
        await this.page.click('[data-mdc-dialog-action="accept"]');
      } catch (e) {
        logger.info('GoogleMeetAdapter(GoogleMeetAdapter): No name input required');
      }

      // Wait for meeting to load
      await this.page.waitForSelector('[data-meeting-id]', { timeout: 30000 });

      // Update status
      const instance = botManager.instances.get(this.config.meetingId);
      if (instance) {
        instance.status = 'running';
      }

      logger.info(`GoogleMeetAdapter(GoogleMeetAdapter): Successfully joined Google Meet ${this.config.meetingId}`);

      // Start transcript monitoring
      this.monitorTranscript();

      monitorMeeting(this.page, this.config.meetingId, this.config.botName, this.sessionId).catch(err => {
        logger.error("GoogleMeetAdapter(GoogleMeetAdapter): Monitor loop crashed:", err);
      });

    } catch (err) {
      logger.error('GoogleMeetAdapter(GoogleMeetAdapter): Error joining Google Meet:', err);
      throw err;
    }
  }

  async monitorTranscript() {
    try {
      logger.info(`GoogleMeetAdapter(GoogleMeetAdapter): Starting transcript monitoring for ${this.config.meetingId}`);

      // Google Meet transcript monitoring logic
      // This is a simplified version - real implementation would need:
      // - Enable live captions if available
      // - Monitor caption elements
      // - Extract speaker and text
      // - Save to TranscriptModel

      // Placeholder implementation
      // In practice, you'd listen for caption updates and save them

    } catch (err) {
      logger.error('GoogleMeetAdapter(GoogleMeetAdapter): Error monitoring transcript:', err);
    }
  }

  async stopBot() {
    try {
      logger.info(`GoogleMeetAdapter(GoogleMeetAdapter): Stopping bot for meeting ${this.config.meetingId}`);
      this.cleanup();

      return {
        success: true,
        meetingId: this.config.meetingId,
        message: 'Google Meet bot stopped'
      };
    } catch (err) {
      logger.error('GoogleMeetAdapter(GoogleMeetAdapter): Error stopping bot:', err);
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
      platform: 'google-meet',
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
      logger.error('GoogleMeetAdapter(GoogleMeetAdapter): Error during cleanup:', err);
    }
  }
}

module.exports = GoogleMeetAdapter;
