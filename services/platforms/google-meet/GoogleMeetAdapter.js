/**
 * services/platforms/google-meet/GoogleMeetAdapter.js
 * Google Meet Platform Adapter
 * Basic implementation using Puppeteer for Google Meet
 *
 * MODULARIZATION: every functional piece below (media/mic-camera, joining/
 * form-filling, attendance monitoring, participant tracking, caption
 * monitoring, audio recording, screen recording) lives in its own file under
 * this folder, and featureConfig.js is the single "main page" that turns
 * the configurable ones on/off (joining/form-filling always runs - see
 * featureConfig.js). See featureConfig.js's SCOPE NOTE for why
 * captionMonitor/audioRecorder/screenRecorder below only apply to THIS path
 * (Path A) and not to the other Google Meet bot path (SocraticBot/
 * MeetJoiner), which already runs its own versions of those three
 * unconditionally.
 *
 * STAGE LOGGING: this.stage tracks the bot's current lifecycle stage and
 * every transition is logged via _setStage() below at info level, so the
 * production log has a clear, greppable record of exactly where a given
 * bot is (or got stuck) - "STAGE CHANGE [<meetingId>]: <from> -> <to>" -
 * independent of (and in addition to) the more free-form info/warn/error
 * logs already scattered through the steps themselves. getStatus() also
 * exposes the current stage.
 */

const puppeteer = require('puppeteer');
const path = require('path');
const { logger } = require('../../../utils/logger');
const MeetingSessionController = require('../../../controllers/meetings/meeting-session/meetingSessionController');
const MeetingAssetModel = require('../../../models/meetings/assets/meetingAssetModel');
const MeetingModel = require('../../../models/meetings/MeetingModel');
const botManager = require('../../shared/botManager');
const { monitorMeeting, hasHumanJoined, captureInitialParticipants } = require('./monitor');
const ParticipantTracker = require('./participantTracker');
const ensureMicCameraOff = require('./preJoinMedia');
const CaptionMonitor = require('./captionMonitor');
const AudioRecorder = require('../audioRecorder');
const ScreenRecorder = require('../screenRecorder');
const featureConfig = require('../../featureConfig'); // moved from ./featureConfig.js — see services/featureConfig.js

class GoogleMeetAdapter {
  constructor(config) {
    this.config = {
      platform: 'google-meet',
      meetingId: config.meetingId,
      meetingUrl: config.meetingUrl,
      botName: config.botName || 'GoogleMeetBot',
      webhookUrl: config.webhookUrl
    };
    this.browser = null;
    this.page = null;
    this.sessionId = null;
    this.meetingDbId = null;
    this.participantTracker = null;
    this.captionMonitor = null;
    this.audioRecorder = null;
    this.screenRecorder = null;
    this.stage = 'created';

    // Same storage layout socraticbot.js uses (services/socraticbot.js is
    // one directory up from services/platforms/google-meet, so this file
    // needs one extra '..' to land on the same <root>/storage/* folders).
    this._recordingStorageDir = path.resolve(__dirname, '..', '..', '..', 'storage', 'recordings');
    this._screenStorageDir = path.resolve(__dirname, '..', '..', '..', 'storage', 'screen-recordings');
  }

  /**
   * Single choke point for every lifecycle stage transition, so the
   * production log always has one clear line per step change instead of
   * that having to be inferred from whichever free-form log happened to be
   * nearby. Also mirrors the stage onto the shared botManager instance
   * entry (if present) so other code inspecting that entry can see it too.
   */
  _setStage(stage, extra = '') {
    const prev = this.stage;
    this.stage = stage;
    const instance = botManager.instances.get(this.config.meetingId);
    if (instance) instance.stage = stage;
    logger.info(`GoogleMeetAdapter(GoogleMeetAdapter): STAGE CHANGE [${this.config.meetingId}]: ${prev} -> ${stage}${extra ? ' - ' + extra : ''}`);
  }

  async startBot() {
    try {
      // Check if already running
      if (botManager.instances.has(this.config.meetingId)) {
        const existing = botManager.instances.get(this.config.meetingId);
        if (existing.status === 'running' || existing.status === 'joining') {
          return {
            success: false,
            error: `Google Meet bot already running for meeting ${this.config.meetingId}`,
            meetingId: this.config.meetingId,
            status: existing.status
          };
        }
      }

      logger.info(`GoogleMeetAdapter(GoogleMeetAdapter): Starting bot for goole meet meeting ${this.config.meetingId}`);
      this._setStage('launching');

      // meeting_sessions = human/conversation lifecycle - NOT created at join
      // time. Created later only when a real human participant is detected
      // (see ensureConversationSession()).
      this.sessionId = null;
      this.meetingDbId = null;
      try {
        const mRes = await MeetingAssetModel.ensureMeetingByExternalId(this.config.meetingId, { platform: 'google-meet', title: 'Bot: ' + this.config.meetingId });
        this.meetingDbId = mRes.id ? Number(mRes.id) : null;
      } catch (mErr) {
        logger.warn(`GoogleMeetAdapter(GoogleMeetAdapter): Could not ensure meetings row: ${mErr.message}`);
      }
      if (this.meetingDbId) {
        MeetingModel.updateMeetingStatusById(this.meetingDbId, 'bot_launching', { force: true }).catch(e =>
          logger.warn(`GoogleMeetAdapter(GoogleMeetAdapter): Failed to mark meeting bot_launching: ${e.message}`)
        );
      }

      // Launch browser
      this.browser = await puppeteer.launch({
        headless: false, // Meet requires visible browser for joining
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--use-fake-ui-for-media-stream', // Allow camera/microphone access
          '--use-fake-device-for-media-stream'
        ]
      });
      logger.info(`GoogleMeetAdapter(GoogleMeetAdapter): Browser launched for meeting ${this.config.meetingId}`);

      this.page = await this.browser.newPage();

      // Set user agent
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      // Track in botManager
      botManager.instances.set(this.config.meetingId, {
        bot: this,
        status: 'joining',
        stage: this.stage,
        startedAt: Date.now(),
        config: this.config,
        sessionId: this.sessionId,
        adapter: this
      });

      // Start Google Meet joining process
      this.joinGoogleMeet().catch(err => {
        logger.error(`GoogleMeetAdapter(GoogleMeetAdapter): Error joining meeting ${this.config.meetingId}:`, err);
        this._setStage('join_failed', err.message);
        this.cleanup();
      });

      return {
        success: true,
        meetingId: this.config.meetingId,
        sessionId: this.sessionId,
        platform: 'google-meet',
        status: 'joining',
        message: 'Google Meet bot started - joining meeting...'
      };
    } catch (err) {
      logger.error('GoogleMeetAdapter(GoogleMeetAdapter): Error starting bot:', err);
      this._setStage('launch_failed', err.message);
      this.cleanup();
      return {
        success: false,
        error: err.message,
        meetingId: this.config.meetingId
      };
    }
  }

  async joinGoogleMeet() {
    try {
      this._setStage('navigating', this.config.meetingUrl);
      logger.info(`GoogleMeetAdapter(GoogleMeetAdapter): Navigating to ${this.config.meetingUrl}`);

      // Navigate to Google Meet
      await this.page.goto(this.config.meetingUrl, { waitUntil: 'networkidle2' });

      // Handle "Turn on camera/microphone" prompts
      try {
        // Click "Continue without microphone and camera" or similar
        await this.page.waitForSelector('[data-mdc-dialog-action="accept"]', { timeout: 10000 });
        await this.page.click('[data-mdc-dialog-action="accept"]');
        logger.info('GoogleMeetAdapter(GoogleMeetAdapter): Camera/microphone prompt dismissed');
      } catch (e) {
        logger.info('GoogleMeetAdapter(GoogleMeetAdapter): No camera/microphone prompt');
      }

      // MUTE MIC + TURN OFF CAMERA - must happen here, on the pre-join/lobby
      // screen, BEFORE we type the name and click "Ask to join" below, so
      // the bot never even enters the waiting-for-host lobby with an active
      // mic or camera. --use-fake-ui-for-media-stream/--use-fake-device-for-
      // media-stream (see puppeteer.launch above) only auto-grant the OS
      // permission prompt with a fake device - they don't guarantee Meet's
      // own in-page toggle defaults to off. This retries and re-verifies
      // the actual DOM state rather than assuming a click worked (see
      // preJoinMedia.js) - it logs a clear warning rather than throwing if
      // it can't confirm, since failing to join at all would be worse.
      // Each control is independently toggleable via featureConfig.media.
      this._setStage('pre_join_media_check');
      await ensureMicCameraOff(this.page, {
        label: 'pre-join',
        camera: featureConfig.media.disableCameraOnJoin,
        microphone: featureConfig.media.muteMicOnJoin
      });

      // Enter name if required. Not gated via featureConfig - joining/form-
      // filling always runs, since there is no bot at all without it.
      this._setStage('name_entry');
      try {
        await this.page.waitForSelector('input[type="text"]', { timeout: 5000 });
        await this.page.type('input[type="text"]', this.config.botName);

        // Click join button
        await this.page.waitForSelector('[data-mdc-dialog-action="accept"]', { timeout: 5000 });
        await this.page.click('[data-mdc-dialog-action="accept"]');
        logger.info(`GoogleMeetAdapter(GoogleMeetAdapter): Name "${this.config.botName}" entered and join button clicked`);
      } catch (e) {
        logger.info('GoogleMeetAdapter(GoogleMeetAdapter): No name input required');
      }

      // Wait for meeting to load
      this._setStage('waiting_for_meeting_load');
      await this.page.waitForSelector('[data-meeting-id]', { timeout: 30000 });

      // RECHECK: verify mic/camera are STILL off now that the bot is
      // actually inside the meeting. Meet's in-call toolbar uses the same
      // aria-label/tooltip wording the pre-join check above already scans
      // for, so this reuses the exact same function - this is the second
      // line of defense for the case where the pre-join screen's controls
      // weren't rendered/found yet, or Meet reset either device on join.
      this._setStage('post_join_media_recheck');
      await ensureMicCameraOff(this.page, {
        label: 'post-join recheck',
        camera: featureConfig.media.disableCameraOnJoin,
        microphone: featureConfig.media.muteMicOnJoin
      });

      // Update status
      const instance = botManager.instances.get(this.config.meetingId);
      if (instance) {
        instance.status = 'running';
      }

      // This is the moment the BOT ITSELF joined the meeting - captured here,
      // before the (up to 30s) human-detection wait and the DOM roster read
      // that follow it, so anyone already in the call gets an attendance
      // timestamp anchored to when the bot actually arrived, not to
      // whichever later moment that detection/DOM-read work happens to
      // finish at. Reused below as the initial-roster snapshotTime.
      const botJoinTime = new Date();

      this._setStage('joined');
      logger.info(`GoogleMeetAdapter(GoogleMeetAdapter): Successfully joined Google Meet ${this.config.meetingId}`);

      // Create the conversation session only when a real human is present.
      this._setStage('awaiting_human_participant');
      await this.ensureConversationSession();

      // INITIAL ROSTER CAPTURE: if people were already in the meeting before
      // the bot joined, record their attendance now (participants +
      // participant_attendance_sessions) instead of waiting for
      // monitorMeeting()'s next poll to notice them. Only meaningful once a
      // conversation session exists - participants/attendance rows require a
      // sessionId, and if ensureConversationSession() never saw a human
      // within its 30s window there's nobody to capture and nowhere valid to
      // store it yet anyway (see captureInitialParticipants/
      // handleInitialRoster for the capture + persistence details). Also
      // gated on featureConfig.participantTracker.enabled.
      //
      // TIMESTAMP: uses botJoinTime (above), NOT "now" - Meet still doesn't
      // expose these participants' true original join time, but anchoring to
      // the bot's own join moment is more accurate than a timestamp that
      // drifts later depending on how long human-detection/DOM-reading took.
      let initialParticipants = [];
      if (this.sessionId && featureConfig.participantTracker.enabled) {
        this._setStage('initial_roster_capture');
        this.participantTracker = new ParticipantTracker(this.config.meetingId, this.sessionId);
        initialParticipants = await captureInitialParticipants(this.page, this.config.botName, this.participantTracker, botJoinTime);
      } else if (!featureConfig.participantTracker.enabled) {
        logger.info(`GoogleMeetAdapter(GoogleMeetAdapter): participantTracker disabled via featureConfig - skipping initial roster capture for meeting ${this.config.meetingId}`);
      } else {
        logger.info(`GoogleMeetAdapter(GoogleMeetAdapter): No conversation session yet - skipping initial roster capture for meeting ${this.config.meetingId}`);
      }

      // CAPTION MONITOR: live-caption-text-based meeting-end detection +
      // transcript file lifecycle (captionMonitor.js). Gated independently -
      // this replaces the old always-empty monitorTranscript() stub. Only
      // constructed once a real session exists, same as participantTracker
      // above (its transcript file name embeds the session id).
      if (this.sessionId && featureConfig.captionMonitor.enabled) {
        this._setStage('caption_monitor_setup');
        try {
          this.captionMonitor = new CaptionMonitor(
            this.sessionId,
            this.page,
            this.meetingDbId,
            'google-meet',
            this, // joinerInstance - stored but never read by CaptionMonitor; kept for parity/future use
            () => this.cleanup()
          );
          this.captionMonitor.startPolling();
          logger.info(`GoogleMeetAdapter(GoogleMeetAdapter): captionMonitor started for meeting ${this.config.meetingId}`);
        } catch (cmErr) {
          logger.warn(`GoogleMeetAdapter(GoogleMeetAdapter): Failed to start captionMonitor: ${cmErr.message}`);
        }
      } else if (!featureConfig.captionMonitor.enabled) {
        logger.info(`GoogleMeetAdapter(GoogleMeetAdapter): captionMonitor disabled via featureConfig for meeting ${this.config.meetingId}`);
      }

      // AUDIO / SCREEN RECORDING: whole-machine ffmpeg capture (see
      // featureConfig.js SCOPE NOTE - both default OFF here to avoid
      // conflicting with a concurrently-running recording from the other
      // Google Meet bot path on the same machine). Only started once a real
      // session exists, mirroring socraticbot.js's own gating.
      if (this.sessionId && featureConfig.audioRecorder.enabled) {
        this._setStage('audio_recorder_setup');
        try {
          this.audioRecorder = new AudioRecorder(this._recordingStorageDir, this.sessionId, this.meetingDbId);
          await this.audioRecorder.start();
          logger.info(`GoogleMeetAdapter(GoogleMeetAdapter): audioRecorder started for meeting ${this.config.meetingId}`);
        } catch (arErr) {
          logger.warn(`GoogleMeetAdapter(GoogleMeetAdapter): Failed to start audioRecorder: ${arErr.message}`);
        }
      }

      if (this.sessionId && featureConfig.screenRecorder.enabled) {
        this._setStage('screen_recorder_setup');
        try {
          this.screenRecorder = new ScreenRecorder(this._screenStorageDir, this.sessionId, this.meetingDbId);
          this.screenRecorder.start();
          logger.info(`GoogleMeetAdapter(GoogleMeetAdapter): screenRecorder started for meeting ${this.config.meetingId}`);
        } catch (srErr) {
          logger.warn(`GoogleMeetAdapter(GoogleMeetAdapter): Failed to start screenRecorder: ${srErr.message}`);
        }
      }

      // ATTENDANCE MONITOR: the stay-alive loop that both tracks join/leave/
      // rejoin into participants + participant_attendance_sessions AND
      // decides when the bot should leave an empty meeting. Gating this off
      // means BOTH of those stop - there is currently no separate "keep the
      // bot in the meeting but don't track attendance" mode, because that
      // exit-detection logic lives in the same loop (monitor.js). NOTE:
      // monitor.js falls back to constructing its own internal
      // ParticipantTracker if none is passed, so turning OFF
      // participantTracker while leaving attendanceMonitor ON will still
      // persist attendance via that fallback tracker - to fully stop
      // attendance persistence, disable attendanceMonitor too.
      if (featureConfig.attendanceMonitor.enabled) {
        this._setStage('running');
        monitorMeeting(this.page, this.config.meetingId, this.config.botName, this.sessionId, this.participantTracker, initialParticipants)
          .then(() => this._setStage('monitor_exited'))
          .catch(err => {
            logger.error("GoogleMeetAdapter(GoogleMeetAdapter): Monitor loop crashed:", err);
            this._setStage('monitor_crashed', err.message);
          });
      } else {
        this._setStage('running_without_attendance_monitor');
        logger.info(`GoogleMeetAdapter(GoogleMeetAdapter): attendanceMonitor disabled via featureConfig - bot will stay in meeting ${this.config.meetingId} with no join/leave tracking and no auto-leave-when-alone behavior.`);
      }

    } catch (err) {
      logger.error('GoogleMeetAdapter(GoogleMeetAdapter): Error joining Google Meet:', err);
      this._setStage('join_error', err.message);
      throw err;
    }
  }

  /**
   * Create a meeting_sessions row ONLY when a real human participant is
   * detected (meeting_sessions = human/conversation lifecycle, not bot join).
   */
  async ensureConversationSession() {
    try {
      const deadline = Date.now() + 30000; // up to 30 s to spot a human
      while (Date.now() < deadline) {
        try {
          if (await hasHumanJoined(this.page, this.config.botName)) {
            if (!this.sessionId) {
              const session = await MeetingSessionController.createSession(this.meetingDbId, 'human_detected');
              this.sessionId = session.id;
              this._setStage('session_created', `sessionId=${this.sessionId}`);
              logger.info(`GoogleMeetAdapter(GoogleMeetAdapter): Session ${this.sessionId} created (human detected) for meeting ${this.meetingDbId}`);
            }
            return;
          }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 3000));
      }
      this._setStage('no_human_detected');
      logger.info(`GoogleMeetAdapter(GoogleMeetAdapter): No human participant within 30s - no session created (meeting ${this.meetingDbId} stays in bot-join lifecycle).`);
    } catch (err) {
      logger.warn(`GoogleMeetAdapter(GoogleMeetAdapter): ensureConversationSession failed: ${err.message}`);
    }
  }

  async stopBot() {
    try {
      logger.info(`GoogleMeetAdapter(GoogleMeetAdapter): Stopping bot for meeting ${this.config.meetingId}`);
      this._setStage('stopping');
      await this.cleanup();

      return {
        success: true,
        meetingId: this.config.meetingId,
        message: 'Google Meet bot stopped'
      };
    } catch (err) {
      logger.error('GoogleMeetAdapter(GoogleMeetAdapter): Error stopping bot:', err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  async getStatus() {
    const instance = botManager.instances.get(this.config.meetingId);
    return {
      meetingId: this.config.meetingId,
      status: instance ? instance.status : 'stopped',
      stage: this.stage,
      platform: 'google-meet',
      sessionId: this.sessionId
    };
  }

  async cleanup() {
    try {
      if (this.captionMonitor && typeof this.captionMonitor.stopPolling === 'function') {
        try { this.captionMonitor.stopPolling(); } catch (cmErr) {
          logger.warn(`GoogleMeetAdapter(GoogleMeetAdapter): Error stopping captionMonitor: ${cmErr.message}`);
        }
      }

      if (this.audioRecorder && typeof this.audioRecorder.stop === 'function') {
        try { this.audioRecorder.stop(); } catch (arErr) {
          logger.warn(`GoogleMeetAdapter(GoogleMeetAdapter): Error stopping audioRecorder: ${arErr.message}`);
        }
      }

      if (this.screenRecorder && typeof this.screenRecorder.stop === 'function') {
        try { await this.screenRecorder.stop(); } catch (srErr) {
          logger.warn(`GoogleMeetAdapter(GoogleMeetAdapter): Error stopping screenRecorder: ${srErr.message}`);
        }
      }

      if (this.page) {
        this.page.close();
        this.page = null;
      }
      if (this.browser) {
        this.browser.close();
        this.browser = null;
      }
      botManager.instances.delete(this.config.meetingId);
      this._setStage('stopped');
    } catch (err) {
      logger.error('GoogleMeetAdapter(GoogleMeetAdapter): Error during cleanup:', err);
    }
  }
}

module.exports = GoogleMeetAdapter;
