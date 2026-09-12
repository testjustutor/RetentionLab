/**
 * services/platforms/teams/TeamsAdapter.js
 *
 */
 /**
 * Microsoft Teams Platform Adapter
 * Basic implementation using Puppeteer for Teams meetings
 */

const puppeteer = require('puppeteer');
const { logger } = require('../../../utils/logger');
const MeetingSessionController = require('../../../controllers/meetings/meeting-session/meetingSessionController');
const MeetingAssetModel = require('../../../models/meetings/assets/meetingAssetModel');
const MeetingModel = require('../../../models/meetings/MeetingModel');
const botManager = require('../../shared/botManager');
const { hasHumanJoined } = require('./monitor');

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
    this.meetingDbId = null;
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

      // meeting_sessions = human/conversation lifecycle - NOT created at join
      // time. Created later only when a real human participant is detected
      // (see ensureConversationSession()).
      this.sessionId = null;
      this.meetingDbId = null;
      try {
        const mRes = await MeetingAssetModel.ensureMeetingByExternalId(this.config.meetingId, { platform: 'teams', title: 'Bot: ' + this.config.meetingId });
        this.meetingDbId = mRes.id ? Number(mRes.id) : null;
      } catch (mErr) {
        logger.warn(`TeamsAdapter: Could not ensure meetings row: ${mErr.message}`);
      }
      if (this.meetingDbId) {
        MeetingModel.updateMeetingStatusById(this.meetingDbId, 'bot_launching', { force: true }).catch(e =>
          logger.warn(`TeamsAdapter: Failed to mark meeting bot_launching: ${e.message}`)
        );
      }

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

      // Create the conversation session only when a real human is present.
      await this.ensureConversationSession();

      // Start transcript monitoring
      this.monitorTranscript();

    } catch (err) {
      logger.error('TeamsAdapter: Error joining Teams meeting:', err);
      throw err;
    }
  }

  /**
   * Create a meeting_sessions row ONLY when a real human participant is
   * detected (meeting_sessions = human/conversation lifecycle, not bot join).
   */
  async ensureConversationSession() {
    try {
      const deadline = Date.now() + 30000; // up to 30 s to spot a human
      while (Date.now() < deadline) {
        try {
          if (await hasHumanJoined(this.page, this.config.botName)) {
            if (!this.sessionId) {
              const session = await MeetingSessionController.createSession(this.meetingDbId, 'human_detected');
              this.sessionId = session.id;
              logger.info(`TeamsAdapter: Session ${this.sessionId} created (human detected) for meeting ${this.meetingDbId}`);
            }
            return;
          }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 3000));
      }
      logger.info(`TeamsAdapter: No human participant within 30s - no session created (meeting ${this.meetingDbId} stays in bot-join lifecycle).`);
    } catch (err) {
      logger.warn(`TeamsAdapter: ensureConversationSession failed: ${err.message}`);
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
