/**
 * Bot Model
 * Data access layer for bot operations
 */
const botManager = require('../../services/shared/botManager');
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class BotModel {
  /**
   * Get bot statistics
   */
  static async getStats() {
    try {
      return botManager.getStats();
    } catch (err) {
      logger.error('Model(Bot): Error getting stats:', err);
      throw err;
    }
  }

  /**
   * Get all bot instances
   */
  static async getInstances() {
    try {
      const stats = botManager.getStats();
      return stats.instances || [];
    } catch (err) {
      logger.error('Model(Bot): Error getting instances:', err);
      throw err;
    }
  }

  /**
   * Get bot status by meeting ID
   * @param {string} meetingId - Meeting ID
   */
  static async getBotStatus(meetingId) {
    try {
      return botManager.getStatus(meetingId);
    } catch (err) {
      logger.error(`Model(Bot): Error getting status for ${meetingId}:`, err);
      throw err;
    }
  }

  /**
   * Start a bot for a meeting
   * @param {string} platform - Platform (zoom, google-meet, teams)
   * @param {string} meetingId - Meeting ID
   * @param {string} passcode - Optional passcode
   * @param {string} webhookUrl - Optional webhook URL
   * @param {string} meetingUrl - Optional meeting URL
   */
  static async startBot(platform, meetingId, passcode, webhookUrl, meetingUrl) {
    try {
      return await botManager.startBot(platform, meetingId, passcode, webhookUrl, meetingUrl);
    } catch (err) {
      logger.error(`Model(Bot): Error starting bot for ${meetingId}:`, err);
      throw err;
    }
  }

  /**
   * Stop a bot by meeting ID
   * @param {string} meetingId - Meeting ID
   */
  static async stopBot(meetingId) {
    try {
      return await botManager.stopBot(meetingId);
    } catch (err) {
      logger.error(`Model(Bot): Error stopping bot for ${meetingId}:`, err);
      throw err;
    }
  }

  /**
   * Get queued meetings
   */
  static async getQueuedMeetings() {
    try {
      // This would typically query the database for queued meetings
      // For now, return empty array as placeholder
      return [];
    } catch (err) {
      logger.error('Model(Bot): Error getting queued meetings:', err);
      throw err;
    }
  }

  /**
   * Get active bot count
   */
  static async getActiveCount() {
    try {
      const stats = botManager.getStats();
      return stats.activeCount || 0;
    } catch (err) {
      logger.error('Model(Bot): Error getting active count:', err);
      return 0;
    }
  }

  /**
   * Get max concurrent bots allowed
   */
  static async getMaxConcurrent() {
    try {
      const stats = botManager.getStats();
      return stats.maxConcurrent || 50;
    } catch (err) {
      logger.error('Model(Bot): Error getting max concurrent:', err);
      return 50;
    }
  }

  /**
   * Get database size and connection stats
   */
  static async getDatabaseStats() {
    try {
      const result = await new Promise((resolve, reject) => {
        db.get("SELECT table_schema AS db_name, SUM(data_length + index_length) AS size FROM information_schema.tables WHERE table_schema = DATABASE()", (err, row) => err ? reject(err) : resolve(row));
      });
      const sizeBytes = result?.size || 0;
      const size = (sizeBytes / (1024 * 1024)).toFixed(2) + ' MB';
      let connections = 0;
      try {
        const connResult = await new Promise((resolve, reject) => {
          db.get("SHOW STATUS LIKE 'Threads_connected'", (err, row) => err ? reject(err) : resolve(row));
        });
        connections = parseInt(connResult?.Value) || 0;
      } catch (err) { connections = 0; }
      return { size, sizeBytes, connections };
    } catch (err) {
      return { size: '0 MB', sizeBytes: 0, connections: 0 };
    }
  }
}

module.exports = BotModel;