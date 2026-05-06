/**
 * Platform Factory
 * Creates the appropriate platform adapter based on platform type
 */

const { logger } = require('../../utils/logger');
const ZoomAdapter = require('./zoom/ZoomAdapter');
const TeamsAdapter = require('./teams/TeamsAdapter');
const GoogleMeetAdapter = require('./google-meet/GoogleMeetAdapter');
const WebexAdapter = require('./webex/WebexAdapter');
const GoToMeetingAdapter = require('./goto-meeting/GoToMeetingAdapter');
const botManager = require('../shared/botManager');

class PlatformFactory {
  static async startBot(config) {
    const { platform, meetingId, meetingUrl, passcode, botName, webhookUrl } = config;

    logger.info(`PlatformFactory: Creating bot for platform: ${platform}`);

    let adapter;

    switch (platform.toLowerCase()) {
      case 'zoom':
        adapter = new ZoomAdapter(config);
        break;

      case 'teams':
        adapter = new TeamsAdapter(config);
        break;

      case 'google-meet':
        adapter = new GoogleMeetAdapter(config);
        break;

      case 'webex':
        adapter = new WebexAdapter(config);
        break;

      case 'gotomeeting':
        adapter = new GoToMeetingAdapter(config);
        break;

      default:
        throw new Error(`Unsupported platform: ${platform}. Supported: zoom, teams, google-meet, webex, gotomeeting`);
    }

    // Start the bot using the adapter
    return await adapter.startBot();
  }

  static async stopBot(meetingId) {
    return await botManager.stopBot(meetingId);
  }

  static listActiveBots() {
    return botManager.listInstances();
  }

  static getBot(meetingId) {
    return botManager.getInstance(meetingId);
  }

  static getSupportedPlatforms() {
    return ['zoom', 'teams', 'google-meet', 'webex', 'gotomeeting'];
  }

  static isPlatformSupported(platform) {
    return this.getSupportedPlatforms().includes(platform.toLowerCase());
  }
}

module.exports = PlatformFactory;
