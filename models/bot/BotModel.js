/**
 * Bot Model
 * Data access layer for bot operations
 */

const botManager = require('../../services/shared/botManager');
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
}

module.exports = BotModel;