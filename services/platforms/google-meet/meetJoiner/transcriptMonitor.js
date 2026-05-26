const { logger } = require('../../../../utils/logger');

// Your new transcript imports
const transcriptMonitor = require('./transcript/transcriptMonitor');
const participantEvents = require('./transcript/participantEvents');

// The navigation imports (Assuming you put them in the same folder or a navigation folder)
const handlePreJoinScreen = require('./preJoinMedia');
const { enterMeeting, waitForJoinConfirmation } = require('./meetingNavigation');
const enableCaptionsIfPossible = require('./captionManager');

class GoogleMeetJoiner {
  constructor(page, botName, meetingUrl) {
    this.page = page;
    this.botName = botName;
    this.meetingUrl = meetingUrl;

    // transcript states
    this.captionInterval = null;
    this.isStopping = false;

    // transcript storage
    this.transcriptBuffer = [];
    this.seenRows = new Set();

    // external services
    this.captionMonitor = null;
    this.participantTracker = null;

    // --- TRANSCRIPT METHODS BINDING ---
    this.startTranscriptMonitor = transcriptMonitor.startTranscriptMonitor.bind(this);
    this.stopTranscriptMonitor = transcriptMonitor.stopTranscriptMonitor.bind(this);
    this.getTranscript = transcriptMonitor.getTranscript.bind(this);
    this.handleCaptionEvent = participantEvents.handleCaptionEvent.bind(this);

    // --- NAVIGATION METHODS BINDING ---
    this.handlePreJoinScreen = handlePreJoinScreen.bind(this);
    this.enterMeeting = enterMeeting.bind(this);
    this.waitForJoinConfirmation = waitForJoinConfirmation.bind(this);
    this.enableCaptionsIfPossible = enableCaptionsIfPossible.bind(this);
  }

  setParticipantTracker(tracker) {
    this.participantTracker = tracker;
  }

  async joinMeeting() {
    logger.info('GoogleMeetJoiner: STAGE 1: Navigating to Google Meet (Deep Scan Flow)...');

    await this.page.goto(this.meetingUrl, {
      waitUntil: 'networkidle2'
    });

    // 1. Turn off Mic and Camera
    await this.handlePreJoinScreen();
    
    // 2. Type Name and click Join
    await this.enterMeeting();

    // 3. Wait to be let in from the lobby
    const confirmed = await this.waitForJoinConfirmation();
    if (!confirmed.success) {
      await this.page.screenshot({ path: 'meet_stuck.png' });
      logger.error(`GoogleMeetJoiner: join confirmation failed (${confirmed.state})`);
      throw new Error(`Google Meet join confirmation failed (${confirmed.state})`);
    }

    // 4. Turn on Captions so the scraper works
    await this.enableCaptionsIfPossible();
    
    logger.info('GoogleMeetJoiner: Join flow completed successfully.');
  }
}

module.exports = GoogleMeetJoiner;