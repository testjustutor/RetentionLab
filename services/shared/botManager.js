/**
 * root/services/shared/botManager.js
 *
 */
const { logger } = require('../../utils/logger');
const SocraticBot = require('../socraticbot');
const settings = require('../../config/settings');

const MeetingSessionController = require('../../controllers/meetings/meeting-session/meetingSessionController');

const ACTIVE_STATUSES = ['running', 'joining', 'starting', 'launching', 'live'];

/**
 * BotManager - Manages multiple bot instances using existing SocraticBot
 * Each bot runs in its own process or context.
 *
 * Instances are keyed by sessionId (not meetingId), because a single meeting
 * can have multiple sessions over time (retries, reconnects, re-launches).
 * A secondary index (meetingSessions) maps meetingId -> Set(sessionId) so we
 * can still answer "what's happening for this meeting" without losing older
 * session references.
 */
class BotManager {
  constructor() {
    this.instances = new Map(); // sessionId -> { bot, status, startedAt, config, meetingId, sessionId, dbRecord? }
    this.meetingSessions = new Map(); // meetingId -> Set<sessionId>
    this.maxConcurrent = process.env.MAX_CONCURRENT_BOTS || 5;
  }

 // ---------- internal helpers ----------

  _registerInstance(meetingId, sessionId, instance) {
    this.instances.set(sessionId, { ...instance, meetingId, sessionId });

    if (!this.meetingSessions.has(meetingId)) {
      this.meetingSessions.set(meetingId, new Set());
    }
    this.meetingSessions.get(meetingId).add(sessionId);
  }

  /** All sessions (active or not) tracked in-memory for a meeting, newest first */
  getSessionsForMeeting(meetingId) {
    const ids = this.meetingSessions.get(meetingId) || new Set();
    return Array.from(ids)
      .map(id => this.instances.get(id))
      .filter(Boolean)
      .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
  }

  /** Currently active session (if any) for a meeting */
  getActiveSessionForMeeting(meetingId) {
    return this.getSessionsForMeeting(meetingId)
      .find(s => ACTIVE_STATUSES.includes(s.status)) || null;
  }

  // ---------- public API ----------

  /**
   * Get all active instances (flat list across all meetings/sessions)
   */
  listInstances() {
    return Array.from(this.instances.values()).map(instance => ({
      meetingId: instance.meetingId,
      sessionId: instance.sessionId,
      currentStatus: instance.status,
      duration: instance.startedAt ? Math.floor((Date.now() - instance.startedAt) / 1000) : 0,
      createdAt: instance.startedAt,
      config: {
        passcode: instance.config?.passcode ? '***hidden***' : undefined,
        webhookUrl: instance.config?.webhookUrl
      }
    }));
  }

  buildMeetingLink(platform, meetingId, passcode = '', meetingUrl = '') {
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
        link = this.prepareTeamsUrl(link, meetingUrl);
      } catch {}
    }

    return link;
  }

  /**
   * NEW: Launch queued meeting from DB (for polling)

   */
  async launchFromDb(meetingRecord) {
    let session = null;
    try {
      const meetingId = meetingRecord.meeting_id;
      const platform = meetingRecord.platform;
      const passcode = meetingRecord.passcode || '';

      const activeSession = this.getActiveSessionForMeeting(meetingId);

      if (activeSession) {
        logger.info(`Shared(botManager): Skipping queued launch for ${meetingId}; bot already ${activeSession.status} (session ${activeSession.sessionId}).`);
        return { success: true, meetingId, sessionId: activeSession.sessionId, status: activeSession.status, skipped: true };
      }

      logger.info(`Shared(botManager): Launching queued ${meetingId}`);

      // Create transcript session
      session = await MeetingSessionController.createSession(meetingId);
      
      await MeetingSessionController.updateMeetingSessionStatus(meetingId, session.id, 'launching');

      // 🔥 BUILD YOUR OWN LINK (NOT FROM DB)
      const meetingLink = this.buildMeetingLink(platform, meetingId, passcode);

      logger.info(`Shared(botManager): meetingLink meetingLink ${meetingLink}`);

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

      // Store instance (keyed by sessionId, indexed under meetingId)
      this._registerInstance(meetingId, session.id, {
        bot,
        status: 'starting',
        startedAt: Date.now(),
        config: { meetingId, platform },
        dbRecord: meetingRecord
      });

      // Launch async
      bot.run()
        .then(() => {
          const inst = this.instances.get(session.id);
          if (inst) inst.status = 'completed';
          MeetingSessionController.updateMeetingSessionStatus(meetingId, session.id, 'completed');
        })
        .catch(err => {
          logger.error(`Shared(botManager): Launch error ${meetingId}:`, err);
          const inst = this.instances.get(session.id);
          if (inst) inst.status = 'error';
          MeetingSessionController.updateMeetingSessionStatus(meetingId, session.id, 'error');
        });

      return { success: true, meetingId, sessionId: session.id };

    } catch (err) {
      logger.error('Shared(botManager): Launch from DB failed:', err);
      await MeetingSessionController.updateMeetingSessionStatus(meetingRecord.meeting_id, session?.id ?? null, 'failed');
      return { success: false };
    }
  }

  /**
   * Stop a bot instance
   */
  async stopBot(meetingId, sessionId = null) {

    try {

      const instance = sessionId
        ? this.instances.get(sessionId)
        : this.getActiveSessionForMeeting(meetingId);

      if (!instance) {
        return {
          success: false,
          error: sessionId
            ? `No bot found for session ${sessionId}`
            : `No active bot found for meeting ${meetingId}`,
          meetingId,
          sessionId
        };
      }

      logger.info(`Shared(botManager): Stopping bot for meeting ${meetingId}, session ${instance.sessionId}`);

      if (instance.bot && typeof instance.bot.stop === 'function') {
        await instance.bot.stop();
      }

      instance.status = 'stopped';

      return {
        success: true,
        message: `Bot stopped for meeting ${meetingId}`,
        meetingId,
        sessionId: instance.sessionId,
        status: 'stopped'
      };
    } catch (err) {
      logger.error('Shared(botManager): Error stopping bot:', err);
      return {
        success: false,
        error: err.message,
        meetingId,
        sessionId
      };
    }
  }

  /**
   * Get status of a meeting's active session (or a specific session if provided)
   */
  getStatus(meetingId, sessionId = null) {
    const instance = sessionId
      ? this.instances.get(sessionId)
      : this.getActiveSessionForMeeting(meetingId);

    if (!instance) {
      return {
        meetingId,
        sessionId,
        status: 'not_found',
        error: 'Bot instance not found'
      };
    }

    return {
      meetingId,
      sessionId: instance.sessionId,
      currentStatus: instance.status,
      duration: instance.startedAt ? Math.floor((Date.now() - instance.startedAt) / 1000) : 0,
      createdAt: instance.startedAt
    };
  }


  /**
   * Get status of every session tracked in-memory for a meeting (history + active)
   */
  getAllStatusesForMeeting(meetingId) {
    return this.getSessionsForMeeting(meetingId).map(instance => ({
      meetingId,
      sessionId: instance.sessionId,
      currentStatus: instance.status,
      duration: instance.startedAt ? Math.floor((Date.now() - instance.startedAt) / 1000) : 0,
      createdAt: instance.startedAt
    }));
  }

  /**
   * Monitor bot status changes
   */
  monitorBotStatus(sessionId) {
    // Poll to check if bot picked up status changes from SocraticBot
    const checkInterval = setInterval(() => {
      const instance = this.instances.get(sessionId);
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
    const activeCount = instances.filter(i => ACTIVE_STATUSES.includes(i.status)).length;
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
   * Get a specific bot instance by sessionId
   */
  getInstance(sessionId) {
    return this.instances.get(sessionId);
  }

  prepareTeamsUrl(url, meetingUrl = null) {

    if (meetingUrl && meetingUrl.includes('teams.microsoft.com')) {
      return meetingUrl;
    }

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
      // Check concurrent limit (global, across all meetings/sessions)
      if (this.instances.size >= this.maxConcurrent) {
        return { success: false, error: `Max concurrent (${this.maxConcurrent}) reached` };
      }

      // Check already active for this meeting
      const activeSession = this.getActiveSessionForMeeting(meetingId);
      if (activeSession) {
        return { success: false, error: `Bot already ${activeSession.status} for ${meetingId}`, sessionId: activeSession.sessionId };
      }

      const platformConfig = settings.platforms[platform];
      if (!platformConfig) {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      const meetingLink = this.buildMeetingLink(platform, meetingId, passcode, meetingUrl);

      logger.info(`Shared(botManager):  IMMEDIATE LAUNCH: ${meetingId} (pass:${!!passcode}, webhook:${!!webhookUrl})`);

      // Create transcript session
      const session = await MeetingSessionController.createSession(meetingId);
      logger.info(`Shared(botManager): Session created: ${session.id} for immediate ${meetingId}`);

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

      // Store instance (keyed by sessionId, indexed under meetingId)
      this._registerInstance(meetingId, session.id, {
        bot,
        status: 'starting',
        startedAt: Date.now(),
        config: { meetingId, platform, passcode: !!passcode, webhookUrl: !!webhookUrl },
        type: 'immediate' // Mark as immediate (no DB record)
      });

      // Launch async
      bot.run().then(() => {
        logger.info(`Shared(botManager): Immediate ${meetingId} completed`);
        const inst = this.instances.get(session.id);
        if (inst) inst.status = 'completed';
      }).catch(err => {
        logger.error(`Shared(botManager): Immediate ${meetingId} failed:`, err);
        const inst = this.instances.get(session.id);
        if (inst) inst.status = 'error';
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
      logger.error('Shared(botManager): Immediate launch failed:', err);
      return { success: false, error: err.message, meetingId };
    }
  }
}

module.exports = new BotManager();
