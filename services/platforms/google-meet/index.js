/**
 * root/services/platforms/google-meet/index.js
 *
 */
const { logger } = require('../../../utils/logger');

const handlePreJoinScreen                        = require('./preJoinMedia');
const { enterMeeting, waitForJoinConfirmation }  = require('./meetingNavigation');
const enableCaptionsIfPossible                   = require('./captionManager');

const {
  startTranscriptMonitor,
  stopTranscriptMonitor,
  getTranscript,
} = require('./transcriptEngine');

class MeetJoiner {

  // ─────────────────────────────────────────────
  // CONSTRUCTOR
  // ─────────────────────────────────────────────

  constructor(page, botName, meetingUrl) {
    this.page        = page;
    this.botName     = botName;
    this.meetingUrl  = meetingUrl;

    // transcript state
    this.captionInterval  = null;
    this.isStopping       = false;
    this.transcriptBuffer = [];
    this.seenRows         = new Set();

    // external services
    this.captionMonitor     = null;
    Object.defineProperty(this, 'filePath', {
      get: () => this.captionMonitor?.filePath
    });
    this.participantTracker = null;

    // ── transcript bindings (ctx = this) ──
    this.startTranscriptMonitor = () => startTranscriptMonitor(this);
    this.stopTranscriptMonitor  = () => stopTranscriptMonitor(this);
    this.getTranscript          = () => getTranscript(this);
  }

  // ─────────────────────────────────────────────
  // SETTERS
  // ─────────────────────────────────────────────

  setCaptionMonitor(monitor) {
    this.captionMonitor = monitor;
  }

  setParticipantTracker(tracker) {
    this.participantTracker = tracker;
  }

  // ─────────────────────────────────────────────
  // JOIN FLOW
  // ─────────────────────────────────────────────

  async joinMeeting() {
    logger.info('GoogleMeetJoiner(index): STAGE 1: Navigating to Google Meet...');

    await this.page.goto(this.meetingUrl, { waitUntil: 'networkidle2' });

    // 1. Turn off mic and camera
    await this.handlePreJoinScreen();

    // 2. Type name and click Join
    await this.enterMeeting();

    // 3. Wait to be admitted from lobby
    const confirmed = await this.waitForJoinConfirmation();
    if (!confirmed.success) {
      await this.page.screenshot({ path: 'meet_stuck.png' });
      logger.error(`GoogleMeetJoiner(index): Join confirmation failed (${confirmed.state})`);
      throw new Error(`Google Meet join confirmation failed (${confirmed.state})`);
    }

    // 4. Enable captions
    await this.enableCaptionsIfPossible();

    logger.info('GoogleMeetJoiner(index): Join flow completed successfully.');
  }
}

// ─────────────────────────────────────────────
// PROTOTYPE BINDINGS
// ─────────────────────────────────────────────

MeetJoiner.prototype.handlePreJoinScreen      = handlePreJoinScreen;
MeetJoiner.prototype.enterMeeting             = enterMeeting;
MeetJoiner.prototype.waitForJoinConfirmation  = waitForJoinConfirmation;
MeetJoiner.prototype.enableCaptionsIfPossible = enableCaptionsIfPossible;

module.exports = MeetJoiner;