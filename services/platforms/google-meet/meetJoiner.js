/**
 * services/platforms/google-meet/meetJoiner.js
 *
 * STAGE LOGGING: this.stage tracks this bot's current join/meeting lifecycle
 * stage; every transition goes through _setStage() below, which logs
 * "STAGE CHANGE: <from> -> <to>" at info level. meetingNavigation.js's
 * enterMeeting()/waitForJoinConfirmation() and captionManager.js's
 * enableCaptionsIfPossible() also call this.\_setStage(...) (they run with
 * `this` bound to this MeetJoiner instance via the prototype bindings
 * below), so the same stage timeline covers the whole join flow, not just
 * this file's own steps.
 */
const { logger } = require('../../../utils/logger');
const { HostDeniedError, WaitingRoomTimeoutError } = require('../joinErrors');

const ensureMicCameraOff                         = require('./preJoinMedia');
const { enterMeeting, waitForJoinConfirmation }  = require('./meetingNavigation');
const enableCaptionsIfPossible                   = require('./captionManager');
const featureConfig                              = require('../../featureConfig'); // moved from ./featureConfig.js — see services/featureConfig.js

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
    this.stage       = 'created';

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
  // STAGE TRACKING
  // ─────────────────────────────────────────────

  /**
   * Single choke point for every lifecycle stage transition on this joiner,
   * so the production log always has one clear line per step change.
   * meetingNavigation.js and captionManager.js call this too (see file
   * header) since they run with `this` bound to the MeetJoiner instance.
   */
  _setStage(stage, extra = '') {
    const prev = this.stage;
    this.stage = stage;
    logger.info(`GoogleMeetJoiner(index): STAGE CHANGE: ${prev} -> ${stage}${extra ? ' - ' + extra : ''}`);
  }

  // ─────────────────────────────────────────────
  // JOIN FLOW
  // ─────────────────────────────────────────────

  async joinMeeting() {
    this._setStage('navigating', this.meetingUrl);
    logger.info('GoogleMeetJoiner(index): STAGE 1: Navigating to Google Meet...');

    await this.page.goto(this.meetingUrl, { waitUntil: 'networkidle2' });

    // 1. Turn off mic and camera
    this._setStage('pre_join_media_check');
    await this.handlePreJoinScreen();

    // 2. Type name and click Join
    this._setStage('entering_meeting_form');
    await this.enterMeeting();

    // 3. Wait to be admitted from lobby
    this._setStage('waiting_for_join_confirmation');
    const confirmed = await this.waitForJoinConfirmation();
    if (!confirmed.success) {
      this._setStage('join_failed', confirmed.state);
      await this.page.screenshot({ path: 'meet_stuck.png' });
      logger.error(`GoogleMeetJoiner(index): Join confirmation failed (${confirmed.state})`);
      if (confirmed.state === 'REJECTED') {
        throw new HostDeniedError('Google Meet host rejected the bot');
      }
      throw new WaitingRoomTimeoutError('Google Meet waiting-room timeout: host never admitted the bot');
    }

    // 3.5. RECHECK mic/camera now that the bot is actually admitted into the
    // meeting (not just the pre-join/lobby screen from step 1) - parity with
    // GoogleMeetAdapter.js's own post-join recheck. Meet can reset either
    // device's state on the transition from lobby into the live call, and
    // the lobby-only check in handlePreJoinScreen() above has no visibility
    // into that. Reuses the same featureConfig.media flags as step 1.
    this._setStage('post_join_media_recheck');
    await ensureMicCameraOff(this.page, {
      label: 'post-join recheck',
      camera: featureConfig.media.disableCameraOnJoin,
      microphone: featureConfig.media.muteMicOnJoin
    });

    // 4. Enable captions
    this._setStage('enabling_captions');
    await this.enableCaptionsIfPossible();

    this._setStage('joined');
    logger.info('GoogleMeetJoiner(index): Join flow completed successfully.');
  }
}

// ─────────────────────────────────────────────
// PROTOTYPE BINDINGS
// ─────────────────────────────────────────────

// preJoinMedia.js now exports ensureMicCameraOff(page, options) directly
// (no `this` binding) so GoogleMeetAdapter.js can reuse it too - this thin
// wrapper keeps the joinMeeting() call site above (`this.handlePreJoinScreen()`)
// unchanged by supplying `this.page` explicitly. camera/microphone flags come
// from featureConfig.media, same "main page" GoogleMeetAdapter.js reads -
// these toggles apply to BOTH Google Meet bot paths.
MeetJoiner.prototype.handlePreJoinScreen      = function handlePreJoinScreenViaJoiner() {
  return ensureMicCameraOff(this.page, {
    label: 'pre-join',
    camera: featureConfig.media.disableCameraOnJoin,
    microphone: featureConfig.media.muteMicOnJoin
  });
};
MeetJoiner.prototype.enterMeeting             = enterMeeting;
MeetJoiner.prototype.waitForJoinConfirmation  = waitForJoinConfirmation;
MeetJoiner.prototype.enableCaptionsIfPossible = enableCaptionsIfPossible;

module.exports = MeetJoiner;
