/**
 * root/services/platforms/zoom/ZoomAdapter.js
 *
 */
/**
 * Zoom Platform Adapter
 * Implements platform-agnostic interface using existing SocraticBot
 */

const { logger } = require('../../../utils/logger');
const SocraticBot = require('../../socraticbot');
const TranscriptModel = require('../../../models/transcripts/transcriptModel');
const botManager = require('../../shared/botManager');
const settings = require('../../../config/settings');

class ZoomAdapter {
  constructor(config) {
    this.config = {
      platform: 'zoom',
      meetingId: config.meetingId,
      meetingUrl: config.meetingUrl,
      passcode: config.passcode || '',
      botName: config.botName,
      webhookUrl: config.webhookUrl
    };
    this.bot = null;
  }

  async startBot() {
    try {
      // Check if already running
      if (botManager.instances.has(this.config.meetingId)) {
        const existing = botManager.instances.get(this.config.meetingId);
        if (existing.status === 'running' || existing.status === 'joining') {
          return {
            success: false,
            error: `Bot already running for meeting ${this.config.meetingId}`,
            meetingId: this.config.meetingId,
            status: existing.status
          };
        }
      }

      logger.info(`ZoomAdapter(ZoomAdapter): Starting bot for meeting ${this.config.meetingId}`);

      // Create session
      const session = await TranscriptModel.createSession(this.config.meetingId);

      // Build meeting URL from config if not provided
      let meetingUrl = this.config.meetingUrl;
      if (!meetingUrl) {
        meetingUrl = this.config.passcode
          ? `${settings.zoom.baseUrl}join/${this.config.meetingId}?pwd=${encodeURIComponent(this.config.passcode)}`
          : `${settings.zoom.baseUrl}${this.config.meetingId}/join`;
      }

      // Create bot instance
      this.bot = new SocraticBot({
        meetingUrl,
        meetingId: this.config.meetingId,
        sessionId: session.id,
        passcode: this.config.passcode,
        botName: this.config.botName,
        webhookUrl: this.config.webhookUrl
      });

      // Track in botManager
      botManager.instances.set(this.config.meetingId, {
        bot: this.bot,
        status: 'joining',
        startedAt: Date.now(),
        config: this.config,
        sessionId: session.id,
        adapter: this
      });

      // Start bot asynchronously
      this.bot.run().then(() => {
        logger.info(`ZoomAdapter(ZoomAdapter): Bot finished for meeting ${this.config.meetingId}`);
        botManager.instances.delete(this.config.meetingId);
      }).catch(err => {
        logger.error(`ZoomAdapter(ZoomAdapter): Bot error for meeting ${this.config.meetingId}:`, err);
        botManager.instances.delete(this.config.meetingId);
      });

      return {
        success: true,
        meetingId: this.config.meetingId,
        sessionId: session.id,
        platform: 'zoom',
        status: 'joining'
      };
    } catch (err) {
      logger.error('ZoomAdapter(ZoomAdapter): Error starting bot:', err);
      return {
        success: false,
        error: err.message,
        meetingId: this.config.meetingId
      };
    }
  }

  async stopBot() {
    try {
      if (this.bot) {
        await this.bot.stop();
        logger.info(`ZoomAdapter(ZoomAdapter): Bot stopped for meeting ${this.config.meetingId}`);
      }
      return {
        success: true,
        message: `Bot stopped for meeting ${this.config.meetingId}`
      };
    } catch (err) {
      logger.error('ZoomAdapter(ZoomAdapter): Error stopping bot:', err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  async getStatus() {
    const instance = botManager.instances.get(this.config.meetingId);
    if (!instance) {
      return { status: 'not_found' };
    }

    return {
      meetingId: this.config.meetingId,
      status: instance.status,
      platform: 'zoom',
      duration: instance.startedAt ? Math.floor((Date.now() - instance.startedAt) / 1000) : 0,
      startedAt: instance.startedAt
    };
  }
}

module.exports = ZoomAdapter;
