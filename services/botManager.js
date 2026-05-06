const { logger } = require('../utils/logger');
const SocraticBot = require('./socraticbot');
const TranscriptModel = require('../models/transcriptModel');
const MeetingModel = require('../models/MeetingModel');
const settings = require('../config/settings');

/**
 * BotManager - Manages multiple bot instances using existing SocraticBot
 * Each bot runs in its own process or context
 */
class BotManager {
  constructor() {
    this.instances = new Map(); // meetingId -> { bot, status, startedAt, config, sessionId }
    this.maxConcurrent = process.env.MAX_CONCURRENT_BOTS || 5;
  }

  /**
   * Get all active instances
   */
  listInstances() {
    return Array.from(this.instances.values()).map(instance => ({
      meetingId: instance.config.meetingId,
      currentStatus: instance.status,
      duration: instance.startedAt ? Math.floor((Date.now() - instance.startedAt) / 1000) : 0,
      createdAt: instance.startedAt,
      config: {
        passcode: instance.config.passcode ? '***hidden***' : undefined,
        webhookUrl: instance.config.webhookUrl
      }
    }));
  }

  buildMeetingLink(platform, meetingId, passcode = '') {
    const platformConfig = settings.platforms[platform];

    if (!platformConfig) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    if (!meetingId) {
      throw new Error('Meeting ID required');
    }

    let link;

    if (platform === 'zoom') {
      link = passcode
        ? `${platformConfig.baseUrl}join/${meetingId}?pwd=${encodeURIComponent(passcode)}`
        : `${platformConfig.baseUrl}${meetingId}`;
    } 
    else if (platform === 'google-meet') {
      link = `${platformConfig.baseUrl}${meetingId}`;
    } 
    else if (platform === 'teams') {
      link = `${platformConfig.baseUrl}${meetingId}`;
      try {
        link = this.prepareTeamsUrl(link);
      } catch {}
    }

    return link;
  }

  /**
   * NEW: Launch queued meeting from DB (for polling)

   */
  async launchFromDb(meetingRecord) {
    try {
      const meetingId = meetingRecord.meeting_id;
      const platform = meetingRecord.platform; 
      const passcode = meetingRecord.passcode || ''; 

      logger.info(`DefaultAdapter(botManager): Launching queued ${meetingId}`);

      // Update DB status
      await MeetingModel.updateMeetingStatus(meetingId, 'launching');

      // Create transcript session
      const session = await TranscriptModel.createSession(meetingId);
      await MeetingModel.updateMeetingStatus(meetingId, 'starting', session.id);

      // 🔥 BUILD YOUR OWN LINK (NOT FROM DB)
      const meetingLink = this.buildMeetingLink(platform, meetingId, passcode);

      logger.info(`DefaultAdapter(botManager): meetingLink ${meetingLink}`);

      const platformConfig = settings.platforms[platform];

      // Create SocraticBot
      const bot = new SocraticBot({
        platform,
        meetingUrl: meetingLink,
        meetingId,
        sessionId: session.id,
        passcode,
        botName: platformConfig?.botName || process.env.BOT_NAME,
        webhookUrl: meetingRecord.webhook_url || ''
      });

      // Store instance
      this.instances.set(meetingId, {
        bot,
        status: 'starting',
        startedAt: Date.now(),
        config: { meetingId, platform },
        sessionId: session.id,
        dbRecord: meetingRecord
      });

      // Launch async
      bot.run()
        .then(() => {
          this.instances.get(meetingId).status = 'completed';
          MeetingModel.updateMeetingStatus(meetingId, 'completed');
        })
        .catch(err => {
          logger.error(`DefaultAdapter(botManager): Launch error ${meetingId}:`, err);
          this.instances.get(meetingId).status = 'error';
          MeetingModel.updateMeetingStatus(meetingId, 'error');
        });

      return { success: true, meetingId };

    } catch (err) {
      logger.error('DefaultAdapter(botManager): Launch from DB failed:', err);
      await MeetingModel.updateMeetingStatus(meetingRecord.meeting_id, 'failed');
      return { success: false };
    }
  }

  /**
   * Stop a bot instance
   */
  async stopBot(meetingId) {
    try {
      if (!this.instances.has(meetingId)) {
        return {
          success: false,
          error: `No bot found for meeting ${meetingId}`,
          meetingId
        };
      }

      const instance = this.instances.get(meetingId);
      logger.info(`DefaultAdapter(botManager): Stopping bot for meeting ${meetingId}`);

      if (instance.bot && typeof instance.bot.stop === 'function') {
        await instance.bot.stop();
      }

      instance.status = 'stopped';

      return {
        success: true,
        message: `Bot stopped for meeting ${meetingId}`,
        meetingId,
        status: 'stopped'
      };
    } catch (err) {
      logger.error('DefaultAdapter(botManager): Error stopping bot:', err);
      return {
        success: false,
        error: err.message,
        meetingId
      };
    }
  }

  /**
   * Get status of a specific bot
   */
  getStatus(meetingId) {
    if (!this.instances.has(meetingId)) {
      return {
        meetingId,
        status: 'not_found',
        error: 'Bot instance not found'
      };
    }

    const instance = this.instances.get(meetingId);
    return {
      meetingId,
      currentStatus: instance.status,
      duration: instance.startedAt ? Math.floor((Date.now() - instance.startedAt) / 1000) : 0,
      createdAt: instance.startedAt,
      sessionId: instance.sessionId
    };
  }

  /**
   * Monitor bot status changes
   */
  monitorBotStatus(meetingId) {
    // Poll to check if bot picked up status changes from SocraticBot
    const checkInterval = setInterval(() => {
      const instance = this.instances.get(meetingId);
      if (!instance) {
        clearInterval(checkInterval);
        return;
      }

      // Bot will naturally update status via its internal state
      if (instance.status === 'completed' || instance.status === 'error' || instance.status === 'stopped') {
        clearInterval(checkInterval);
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Get summary stats
   */
  getStats() {
    const instances = Array.from(this.instances.values());
    const activeCount = instances.filter(i => 
      ['running', 'joining', 'live', 'starting'].includes(i.status)
    ).length;
    const errorCount = instances.filter(i => i.status === 'error').length;

    return {
      activeCount,
      errorCount,
      maxConcurrent: this.maxConcurrent,
      totalInstances: instances.length,
      instances: this.listInstances()
    };
  }

  /**
   * Get a specific bot instance
   */
  getInstance(meetingId) {
    return this.instances.get(meetingId);
  }

  prepareTeamsUrl(url) {
    const teamsUrl = new URL(url);
    // These parameters force Teams to bypass the "Open App" popup
    teamsUrl.searchParams.set('msLaunch', 'false');
    teamsUrl.searchParams.set('directDl', 'true');
    teamsUrl.searchParams.set('suppressPrompt', 'true');
    teamsUrl.searchParams.set('enableMobilePage', 'false');
    return teamsUrl.toString();
  }

  /**
   * IMMEDIATE LAUNCH: Start bot directly (no DB queue)
   * Used by dashboard /bot/start-bot endpoint
   */
  async startBot(platform, meetingId, passcode, webhookUrl, meetingUrl = null) {
    try {
      // Check concurrent limit
      if (this.instances.size >= this.maxConcurrent) {
        return { success: false, error: `Max concurrent (${this.maxConcurrent}) reached` };
      }

      // Check already running
      if (this.instances.has(meetingId)) {
        const instance = this.instances.get(meetingId);
        if (instance.status === 'running' || instance.status === 'joining' || instance.status === 'starting') {
          return { success: false, error: `Bot already ${instance.status} for ${meetingId}` };
        }
      }

      const platformConfig = settings.platforms[platform];
      if (!platformConfig) {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      const meetingLink = this.buildMeetingLink(platform, meetingId, passcode);

      logger.info(`DefaultAdapter(botManager): IMMEDIATE LAUNCH: ${meetingId} (pass:${!!passcode}, webhook:${!!webhookUrl})`);

      // Create transcript session
      const session = await TranscriptModel.createSession(meetingId);
      logger.info(`DefaultAdapter(botManager): Session created: ${session.id} for immediate ${meetingId}`);

      // Create SocraticBot
      const bot = new SocraticBot({
        platform,
        meetingUrl: meetingLink,
        meetingId,
        sessionId: session.id,
        passcode: passcode || '',
        botName: settings.platforms[platform]?.botName || process.env.BOT_NAME,
        webhookUrl: webhookUrl || ''
      });


      // Store instance
      this.instances.set(meetingId, {
        bot,
        status: 'starting',
        startedAt: Date.now(),
        config: { meetingId, passcode: !!passcode, webhookUrl: !!webhookUrl },
        sessionId: session.id,
        type: 'immediate' // Mark as immediate (no DB record)
      });

      // Launch async
      bot.run().then(() => {
        logger.info(`DefaultAdapter(botManager): Immediate ${meetingId} completed`);
        this.instances.get(meetingId).status = 'completed';
      }).catch(err => {
        logger.error(`DefaultAdapter(botManager): Immediate ${meetingId} failed:`, err);
        this.instances.get(meetingId).status = 'error';
      });

      return { 
        success: true, 
        meetingId, 
        sessionId: session.id,
        status: 'starting',
        message: 'Bot launched immediately (no queue)',
        link: meetingLink
      };
    } catch (err) {
      logger.error('DefaultAdapter(botManager): Immediate launch failed:', err);
      return { success: false, error: err.message, meetingId };
    }
  }
}

module.exports = new BotManager();
