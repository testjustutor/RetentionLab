const { logger } = require('../../../../utils/logger');
const path = require('path');
const { format } = require('date-fns');

const handlePreJoinScreen = require('./preJoinMedia');

const { enterMeeting, waitForJoinConfirmation } = require('./meetingNavigation');

const enableCaptionsIfPossible = require('./captionManager');

const {
  startTranscriptMonitor,
  stopTranscriptMonitor,
  getTranscript
} = require('./transcript/transcriptMonitor');

const {
  handleCaptionEvent
} = require('./transcript/participantEvents');

class MeetJoiner {
  constructor(page, botName, meetingUrl) {

    this.page = page;
    this.botName = botName;
    this.meetingUrl = meetingUrl;
    this.filePath = this.generateTranscriptFilePath();

    // external services
    this.captionMonitor = null;
    this.participantTracker = null;

  }

  setCaptionMonitor(monitor) {

    this.captionMonitor = monitor;
  }

  setParticipantTracker(tracker) {
    this.participantTracker = tracker;
  }

  async joinMeeting() {

    await this.page.goto(this.meetingUrl, {
      waitUntil: 'networkidle2'
    });

    await this.handlePreJoinScreen();

    await this.enterMeeting();

    const confirmed = await this.waitForJoinConfirmation();

    if (!confirmed.success) {

      await this.page.screenshot({ path: 'meet_stuck.png' });

      throw new Error(`Google Meet join failed (${confirmed.state})`);
    }

    // =========================
    // POST-JOIN STAGE
    // =========================

    await this.enableCaptionsIfPossible();

    await this.startTranscriptMonitor({
      page: this.page,
      captionMonitor: this.captionMonitor,
      participantTracker: this.participantTracker,
      handleCaptionEvent,
      filePath: this.filePath,
    });

  }

  generateTranscriptFilePath() {
    const url = new URL(this.meetingUrl);
    const meetingId = url.pathname.split('/').pop();
    const date = format(new Date(), 'yyyy-MM-dd');
    const filename = `transcript-${meetingId}-${date}.txt`;
    return path.join(__dirname, '../../../../../../storage/transcripts', filename);
  }
}

// =========================
// PROTOTYPE BINDINGS
// =========================

MeetJoiner.prototype.handlePreJoinScreen = handlePreJoinScreen;
MeetJoiner.prototype.enterMeeting = enterMeeting;
MeetJoiner.prototype.waitForJoinConfirmation = waitForJoinConfirmation;
MeetJoiner.prototype.enableCaptionsIfPossible = enableCaptionsIfPossible;

MeetJoiner.prototype.startTranscriptMonitor = startTranscriptMonitor;
MeetJoiner.prototype.stopTranscriptMonitor = stopTranscriptMonitor;
MeetJoiner.prototype.getTranscript = getTranscript;

module.exports = MeetJoiner;