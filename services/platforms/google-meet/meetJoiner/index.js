const { logger } = require('../../../../utils/logger');

logger.debug('Loading MeetJoiner dependencies');

const handlePreJoinScreen = require('./preJoinMedia');
logger.debug('Loaded preJoinMedia');

const { enterMeeting, waitForJoinConfirmation } = require('./meetingNavigation');
logger.debug('Loaded meetingNavigation');

const enableCaptionsIfPossible = require('./captionManager');
logger.debug('Loaded captionManager');

const {
  startTranscriptMonitor,
  stopTranscriptMonitor,
  getTranscript
} = require('./transcript/transcriptMonitor');
logger.debug('Loaded transcriptMonitor');

const {
  handleCaptionEvent
} = require('./transcript/participantEvents');
logger.debug('Loaded participantEvents');

class MeetJoiner {
  constructor(page, botName, meetingUrl) {
    logger.debug('MeetJoiner: constructor called');

    this.page = page;
    this.botName = botName;
    this.meetingUrl = meetingUrl;

    logger.debug(`MeetJoiner init -> botName=${botName}, url=${meetingUrl}`);

    // external services
    this.captionMonitor = null;
    this.participantTracker = null;

    logger.debug('MeetJoiner initialized with empty monitors');
  }

  setCaptionMonitor(monitor) {
    logger.debug('MeetJoiner: setCaptionMonitor called');

    this.captionMonitor = monitor;

    logger.debug('MeetJoiner: captionMonitor assigned');
  }

  setParticipantTracker(tracker) {
    logger.debug('MeetJoiner: setParticipantTracker called');

    this.participantTracker = tracker;

    logger.debug('MeetJoiner: participantTracker assigned');
  }

  async joinMeeting() {
    logger.info('MeetJoiner: joinMeeting started');

    logger.debug(`Navigating to URL: ${this.meetingUrl}`);

    await this.page.goto(this.meetingUrl, {
      waitUntil: 'networkidle2'
    });

    logger.debug('Page navigation completed');

    logger.info('MeetJoiner: handling pre-join screen');
    await this.handlePreJoinScreen();

    logger.info('MeetJoiner: entering meeting');
    await this.enterMeeting();

    logger.info('MeetJoiner: waiting for join confirmation');
    const confirmed = await this.waitForJoinConfirmation();

    logger.debug(`Join confirmation result: ${JSON.stringify(confirmed)}`);

    if (!confirmed.success) {
      logger.error(`MeetJoiner: join failed state=${confirmed.state}`);

      await this.page.screenshot({ path: 'meet_stuck.png' });
      logger.debug('Screenshot captured: meet_stuck.png');

      throw new Error(`Google Meet join failed (${confirmed.state})`);
    }

    logger.info('MeetJoiner: successfully joined meeting');

    // =========================
    // POST-JOIN STAGE
    // =========================

    logger.info('MeetJoiner: starting post-join setup');

    logger.debug('Enabling captions if possible');
    await this.enableCaptionsIfPossible();

    logger.debug('Starting transcript monitor');
    await this.startTranscriptMonitor({
      captionMonitor: this.captionMonitor,
      participantTracker: this.participantTracker,
      handleCaptionEvent
    });

    logger.info('MeetJoiner: post-join setup completed');
  }
}

// =========================
// PROTOTYPE BINDINGS
// =========================

logger.debug('Binding MeetJoiner prototype methods');

MeetJoiner.prototype.handlePreJoinScreen = handlePreJoinScreen;
MeetJoiner.prototype.enterMeeting = enterMeeting;
MeetJoiner.prototype.waitForJoinConfirmation = waitForJoinConfirmation;
MeetJoiner.prototype.enableCaptionsIfPossible = enableCaptionsIfPossible;

MeetJoiner.prototype.startTranscriptMonitor = startTranscriptMonitor;
MeetJoiner.prototype.stopTranscriptMonitor = stopTranscriptMonitor;
MeetJoiner.prototype.getTranscript = getTranscript;

logger.debug('MeetJoiner prototype bindings completed');

module.exports = MeetJoiner;