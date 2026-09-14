/**
 * services/socraticbot.js
 *
 */
const BrowserManager = require('./shared/browserManager');

// Platform-specific joiners
const ZoomJoiner = require('./platforms/zoom/zoomJoiner');
const MeetJoiner = require('./platforms/google-meet/meetJoiner');
const TeamsJoiner = require('./platforms/teams/teamsJoiner');

// Platform-specific services
const ZoomMonitor = require('./platforms/zoom/monitor');
const TeamsMonitor = require('./platforms/teams/monitor');
const GoogleMeetMonitor = require('./platforms/google-meet/monitor');

const ZoomAudioRecorderBot = require('./platforms/zoom/audioRecorderBot');
const TeamsAudioRecorderBot = require('./platforms/teams/audioRecorderBot');
const GoogleMeetAudioRecorderBot = require('./platforms/google-meet/audioRecorderBot');

const ZoomCaptionMonitor = require('./platforms/zoom/captionMonitor');
const TeamsCaptionMonitor = require('./platforms/teams/captionMonitor');
const GoogleMeetCaptionMonitor = require('./platforms/google-meet/captionMonitor');

const ZoomParticipantTracker = require('./platforms/zoom/participantTracker');
const TeamsParticipantTracker = require('./platforms/teams/participantTracker');
const GoogleParticipantTracker = require('./platforms/google-meet/participantTracker');

const AudioRecorder = require('./platforms/audioRecorder');
const ScreenRecorder = require('./platforms/screenRecorder');

// Feature toggles - see services/featureConfig.js.
const featureConfig = require('./featureConfig');

const MeetingSessionController = require('../controllers/meetings/meeting-session/meetingSessionController');
const MeetingAssetController = require('../controllers/meetings/assets/meetingAssetController');
const MeetingModel = require('../models/meetings/MeetingModel');

const PythonBridge = require('./shared/pythonBridge');

const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');
const { resolveStoragePath } = require('../utils/storagePaths');
const settings = require('../config/settings');
const { HostDeniedError, WaitingRoomTimeoutError } = require('./platforms/joinErrors');

// Platform -> monitor module map, used by waitForHumanParticipant() to reuse
// each platform's own participant-detection logic (getCurrentParticipantNames/
// hasHumanJoined) instead of duplicating DOM-scraping here.
const MONITORS_BY_PLATFORM = {
  zoom: ZoomMonitor,
  'google-meet': GoogleMeetMonitor,
  teams: TeamsMonitor
};

class SocraticBot {
  constructor(config = {}) {
    this.meetingUrl = config.meetingUrl;
    this.botName = config.botName;
    this.passcode = config.passcode || process.env.ZOOM_PASSCODE || '';
    this.sessionId = config.sessionId;
    this.platform = config.platform;
    this.meetingId = config.meetingId;
    this.meetingDbId = config.meetingDbId ?? null; // internal meetings.id (auto-increment PK)

    // FIX: don't build AudioRecorder/ScreenRecorder here — at construction
    // time this.sessionId is still the in-memory placeholder tracking token
    // (e.g. "wait_8_1789131834278"), not a real meeting_sessions id. Both
    // recorders bake their sessionId straight into the output filename at
    // construction (REC_Meet<id>_Sess<sessionId>_...), so building them this
    // early produced files literally named "..._Sesswait_8_<ts>_...mp3"
    // instead of "..._Sess9_...mp3". They're now constructed lazily, right
    // before .start() in run(), once this.sessionId has been swapped to the
    // real DB id — see "START AUDIO RECORDING" below.
    this._recordingStorageDir = path.resolve(__dirname, '..', 'storage', 'recordings');
    this._screenStorageDir = path.resolve(__dirname, '..', 'storage', 'screen-recordings');
    this.audioRecorder = null;
    this.screenRecorder = null;

    this.transcriptionService = this.createTranscriptionService();

    this.browserManager = null;
    this.captionMonitor = null;
    this.participantTracker = null;

    // NEW: guards for the human-join gate / idempotent shutdown (Request 4).
    this._stopped = false;          // true once stop()/closeWithoutProcessing() has run
    this._recordingStarted = false; // true once audioRecorder/screenRecorder actually started
    this._sessionActive = false;    // true once a REAL meeting_sessions row was created (human detected)
    this._earlyTranscriptMonitorStarted = false; // true once caption capture was started BEFORE a human was confirmed (google-meet)
  }

  // -------------------------
  // MAIN RUN
  // -------------------------
  async run() {
    try {
      const safeId = String(this.meetingDbId || this.sessionId).replace(/[<>:"/\\|?*]/g, '_');

      const uniqueProfileDir = path.resolve(
        __dirname,
        '..',
        'storage',
        'chrome-profiles',
        `profile_${safeId}`
      );

      this.browserManager = await new BrowserManager().init({
        userDataDir: uniqueProfileDir,
        deleteProfileOnClose: true,
        botInstanceId: this.sessionId,
        meetingId: this.meetingDbId ?? this.meetingId ?? null,
      });

      const joiner = this.createJoiner();
      this.joiner = joiner;

      // ── BOT / MEETING JOIN LIFECYCLE (meetings.status only — NO session yet) ──
      // A meeting_sessions row is NOT created for the bot joining, waiting for
      // the host, being rejected, or timing out. Sessions represent real human
      // conversation and are created below once a human is detected.
      await this._updateMeetingStatus('waiting_for_host'); // bot heads into the waiting room

      let joinFailed = null;
      try {
        await joiner.joinMeeting(); // blocks in the lobby until admitted/timeout/rejected
      } catch (joinErr) {
        joinFailed = joinErr;
      }

      if (joinFailed) {
        // Classify the failure into the meeting-level join lifecycle.
        if (joinFailed instanceof HostDeniedError) {
          await this._updateMeetingStatus('host_rejected');
          logger.error(`DefaultAdapter(SocraticBot): Host rejected the bot — meeting host_rejected. ${joinFailed.message}`);
        } else if (joinFailed instanceof WaitingRoomTimeoutError) {
          await this._updateMeetingStatus('waiting_timeout');
          logger.error(`DefaultAdapter(SocraticBot): Waiting-room timeout — meeting waiting_timeout. ${joinFailed.message}`);
        } else {
          await this._updateMeetingStatus('failed');
          logger.error(`DefaultAdapter(SocraticBot): Bot join failed — meeting failed. ${joinFailed.message}`);
        }
        await this.stop(); // idempotent; closes browser (no session exists yet)
        throw joinFailed;
      }

      // Host allowed the bot into the meeting.
      await this._updateMeetingStatus('joined');

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Start caption/transcript capture as early as possible — right after
      // being admitted, IN PARALLEL with the roster/tile human-join check
      // below, not only after a human is already confirmed. Real caption
      // text appearing is itself direct proof a human is present and
      // speaking, which matters because Meet's roster/tile DOM (scraped by
      // hasHumanJoined()) doesn't always expose usable names/labels — a bot
      // could sit with real people on screen and never see them there, even
      // though their captions are coming through fine. Only wired up for
      // google-meet for now: transcriptEngine's transcriptBuffer is pure
      // page-DOM state, decoupled from the DB session id, so it's safe to
      // start before a real meeting_sessions row exists. zoom/teams'
      // CaptionMonitor writes straight to the DB by sessionId, so it can't
      // start this early without a bigger refactor.
      if (this.platform === 'google-meet' && joiner.startTranscriptMonitor) {
        try {
          await joiner.startTranscriptMonitor();
          this._earlyTranscriptMonitorStarted = true;
          logger.info('DefaultAdapter(SocraticBot): Early caption/transcript capture started (google-meet) — captured speech will also count as human-join evidence.');
        } catch (err) {
          logger.warn(`DefaultAdapter(SocraticBot): Could not start early transcript monitor: ${err.message}`);
        }
      }

      // ── HUMAN / CONVERSATION LIFECYCLE (meeting_sessions from here only) ──
      // Don't start recording/processing just because the bot joined — wait
      // for a real human participant first (the bot itself is never counted,
      // see platform monitor hasHumanJoined()).
      const humanJoined = await this.waitForHumanParticipant();

      if (!humanJoined) {
        logger.info('DefaultAdapter(SocraticBot): No human participant joined within the configured timeout; closing without a session/processing.');
        await this.closeWithoutProcessing();
        return { noParticipant: true };
      }

      // Human detected → create ONE meeting_sessions row for this conversation
      // segment and swap this.sessionId (an in-memory tracking token up to
      // now) to the real DB id BEFORE handlePlatformFeatures() constructs the
      // captionMonitor, so every downstream write (transcript linking, status
      // updates, stop()'s asset creation) targets the real row. If creation
      // fails, log it and continue with the placeholder id rather than
      // crashing the whole bot run — stop() below already guards its writes.
      try {
        const session = await MeetingSessionController.createSession(this.meetingDbId, 'human_detected');
        logger.info(`DefaultAdapter(SocraticBot): Human detected — meeting_sessions row created (id=${session.id}) for meeting ${this.meetingDbId}.`);
        this.sessionId = session.id;
        // Recorders are built lazily below with the real sessionId already
        // set, so no setSessionId() call is needed here.
        this._sessionActive = true;
      } catch (err) {
        logger.error(`DefaultAdapter(SocraticBot): Failed to create meeting_sessions row after human detection; continuing with placeholder session id ${this.sessionId}.`, err);
        this._sessionActive = false;
      }

      // START AUDIO RECORDING
      // Construct the recorders now, not in the constructor — this.sessionId
      // is the real meeting_sessions id at this point (or, if session
      // creation failed above, still the placeholder — same fallback either
      // way), so the output filename is correct (REC_Meet<id>_Sess<realId>_...)
      // instead of embedding the "wait_<id>_<timestamp>" tracking token.
      // featureConfig.js is keyed per platform - see PLATFORM FEATURES HANDLER
      // below for the rest of this platform's toggles.
      const platformFeatures = featureConfig[this.platform];
      const audioRecorderEnabled = platformFeatures.audioRecorder.enabled;
      const screenRecorderEnabled = platformFeatures.screenRecorder.enabled;

      if (audioRecorderEnabled || screenRecorderEnabled) {
        logger.info('DefaultAdapter(SocraticBot): Triggering FFmpeg recording...');
      } else {
        logger.info('DefaultAdapter(SocraticBot): Audio/screen recording disabled via featureConfig — skipping FFmpeg recording.');
      }

      if (audioRecorderEnabled) {
        this.audioRecorder = new AudioRecorder(this._recordingStorageDir, this.sessionId, this.meetingDbId);
        await this.audioRecorder.start();
      } else {
        logger.info('DefaultAdapter(SocraticBot): audioRecorder disabled via featureConfig — skipping.');
      }

      if (screenRecorderEnabled) {
        this.screenRecorder = new ScreenRecorder(this._screenStorageDir, this.sessionId, this.meetingDbId);
        this.screenRecorder.start();
      } else {
        logger.info('DefaultAdapter(SocraticBot): screenRecorder disabled via featureConfig — skipping.');
      }

      this._recordingStarted = audioRecorderEnabled || screenRecorderEnabled;

      // PLATFORM FEATURES
      await this.handlePlatformFeatures(joiner);

      // NOTE: the session stays 'human_detected' until real speech is
      // actually captured — captionMonitor.js / transcriptEngine.js flip it
      // to 'processing' themselves, the moment the FIRST real caption line
      // comes in (see their "first real caption line captured" blocks).
      // Constructing the caption monitor here is not itself "processing" —
      // a human who joined and never spoke should not be marked processing.

      logger.info('DefaultAdapter(SocraticBot): READY: SocraticBot is now recording and transcribing.');

      return { noParticipant: false };

    } catch (err) {
      logger.error('DefaultAdapter(SocraticBot): FATAL: Bot failed to start', err);
      // Typed join errors (host_rejected / waiting_timeout) already set the
      // correct meetings.status in the join block above — don't clobber them.
      if (!(err instanceof HostDeniedError || err instanceof WaitingRoomTimeoutError)) {
        await this._updateMeetingStatus('failed');
      }
      await this.stop();
      throw err;
    }
  }

  // -------------------------
  // MEETING STATUS HELPER
  // -------------------------
  // The bot/meeting join lifecycle lives on meetings.status; meeting_sessions
  // are ONLY created when a real human/conversation segment is detected.
  async _updateMeetingStatus(status) {
    if (!this.meetingDbId) return;
    try {
      await MeetingModel.updateMeetingStatusById(this.meetingDbId, status, { force: true });
    } catch (err) {
      logger.warn(`DefaultAdapter(SocraticBot): Could not update meeting status to ${status}: ${err.message}`);
    }
  }

  // Mark the current session failed with the real reason (only if a session exists).
  async _finalizeSessionFailure(reason) {
    if (!this._sessionActive || !this.sessionId) return;
    logger.warn(`DefaultAdapter(SocraticBot): Marking session ${this.sessionId} failed (${reason}).`);
    try {
      await MeetingSessionController.updateMeetingSessionStatus(this.meetingDbId, this.sessionId, 'failed');
    } catch (err) {
      logger.error('DefaultAdapter(SocraticBot): Could not mark session failed:', err.message);
    }
  }

  // -------------------------
  // WAIT FOR A REAL HUMAN PARTICIPANT (Request 4, item 1)
  // -------------------------
  // Polls the platform's own participant-detection (zoom/teams/google-meet
  // monitor.js hasHumanJoined()) until either a non-bot participant is seen,
  // the page/browser closes, or the configurable timeout elapses. Returns
  // true only when a real human was detected.
  async waitForHumanParticipant() {
    const monitor = MONITORS_BY_PLATFORM[this.platform];

    if (!monitor || typeof monitor.hasHumanJoined !== 'function') {
      // Safety net: if a platform doesn't support this check, don't block
      // existing behavior — proceed as before (gate can't be evaluated).
      logger.warn(`DefaultAdapter(SocraticBot): No participant-detection available for platform "${this.platform}"; skipping human-join gate.`);
      return true;
    }

    const timeoutMs = Number(settings.bot?.humanJoinTimeoutMs) || 60000;
    const pollIntervalMs = 3000;
    const deadline = Date.now() + timeoutMs;

    logger.info(`DefaultAdapter(SocraticBot): Waiting up to ${timeoutMs}ms for a human participant to join (platform=${this.platform})...`);

    let attempts = 0;
    while (Date.now() < deadline) {
      attempts++;
      if (!this.browserManager?.page || this.browserManager.page.isClosed?.()) {
        logger.info('DefaultAdapter(SocraticBot): Browser/page closed while waiting for a human participant.');
        return false;
      }

      try {
        const rosterOrTileDetected = await monitor.hasHumanJoined(this.browserManager.page, this.botName);

        // Second, independent signal: has the early transcript monitor
        // (started above, google-meet only) already captured a real caption
        // line? Real speech is itself proof a human is here, even when
        // roster/tile scraping comes back empty.
        const transcriptDetected =
          this._earlyTranscriptMonitorStarted &&
          Array.isArray(this.joiner?.transcriptBuffer) &&
          this.joiner.transcriptBuffer.length > 0;

        if (rosterOrTileDetected || transcriptDetected) {
          const via = rosterOrTileDetected && transcriptDetected
            ? 'roster/tile + caption'
            : transcriptDetected ? 'caption/transcript' : 'roster/tile';
          logger.info(`DefaultAdapter(SocraticBot): Human participant detected after ${attempts} check(s) via ${via} — proceeding with recording/processing.`);
          return true;
        }
      } catch (err) {
        logger.warn(`DefaultAdapter(SocraticBot): Error while checking for a human participant: ${err.message}`);
      }

      // Periodic progress log (every ~30s) so a timeout can be told apart in
      // the logs from "genuinely nobody showed up" vs "detection kept
      // returning false the whole time" without needing debug-level logs.
      if (attempts % 10 === 0) {
        const elapsedSec = Math.round((Date.now() - (deadline - timeoutMs)) / 1000);
        logger.info(`DefaultAdapter(SocraticBot): Still waiting for a human participant... (${elapsedSec}s elapsed, ${attempts} checks, no participant detected yet)`);
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    logger.info(`DefaultAdapter(SocraticBot): Timed out waiting for a human participant after ${timeoutMs}ms (${attempts} checks, none detected).`);
    return false;
  }

  // -------------------------
  // CLOSE WITHOUT PROCESSING (Request 4, item 1 — Case A: nobody joins)
  // -------------------------
  // Recording was never started and handlePlatformFeatures() was never
  // called at this point, so there is no captionMonitor/participantTracker/
  // audioRecorder to tear down — just stop any transcript-activation the
  // joiner may have started and close the browser cleanly.
  async closeWithoutProcessing() {
    if (this._stopped) {
      logger.info('DefaultAdapter(SocraticBot): Already stopped; skipping duplicate no-participant cleanup.');
      return;
    }
    this._stopped = true;

    logger.info('DefaultAdapter(SocraticBot): Closing bot — no human participant joined, skipping recording/processing.');

    try {
      if (this.joiner && typeof this.joiner.stopTranscriptMonitor === 'function') {
        await this.joiner.stopTranscriptMonitor();
      }
    } catch (err) {
      logger.error('DefaultAdapter(SocraticBot): Error stopping transcript monitor during no-participant close:', err);
    }

    try {
      if (this.browserManager) {
        await this.browserManager.close();
        logger.info('DefaultAdapter(SocraticBot): Browser closed (no participant joined).');
      }
    } catch (err) {
      logger.error('DefaultAdapter(SocraticBot): Browser close failed during no-participant close:', err);
    }
  }

  // -------------------------
  // REAL TRANSCRIPT CONTENT DETECTION (Request 4, item 3 / item 5 —
  // "human joins but never speaks")
  // -------------------------
  // The transcript file always exists once a human joins (captionMonitor's
  // initStorage() writes a header immediately), so file-existence alone
  // can't tell a real transcript apart from an empty placeholder. Each
  // platform already tracks real captured lines internally:
  //  - zoom/teams: CaptionMonitor.seenRows (populated in processAndSaveTranscript)
  //  - google-meet: the caption capture lives in the JOINER (transcriptEngine.js),
  //    not captionMonitor — joiner.seenRows / joiner.transcriptBuffer.
  // This reads that existing state rather than adding new tracking.
  hasRealTranscriptContent() {
    if (this.platform === 'google-meet') {
      return !!(this.joiner && Array.isArray(this.joiner.transcriptBuffer) && this.joiner.transcriptBuffer.length > 0);
    }
    return !!(this.captionMonitor && this.captionMonitor.seenRows && this.captionMonitor.seenRows.size > 0);
  }

  // -------------------------
  // JOINER FACTORY
  // -------------------------
  createJoiner() {
    switch (this.platform) {

      case 'zoom':
        return new ZoomJoiner(
          this.browserManager.page,
          this.botName,
          this.passcode,
          this.meetingUrl
        );

      case 'google-meet':
        return new MeetJoiner(
          this.browserManager.page,
          this.botName,
          this.meetingUrl
        );

      case 'teams':
        return new TeamsJoiner(
          this.browserManager.page,
          this.botName,
          this.meetingUrl,
          this.passcode
        );

      default:
        throw new Error(`Unsupported platform: ${this.platform}`);
    }
  }

  // -------------------------
  // TRANSCRIPTION SERVICE FACTORY
  // -------------------------
  createTranscriptionService() {
    switch (this.platform) {
      case 'zoom':
        return new ZoomAudioRecorderBot(this.meetingUrl);
      case 'google-meet':
        return new GoogleMeetAudioRecorderBot(this.meetingUrl);
      case 'teams':
        return new TeamsAudioRecorderBot(this.meetingUrl);
      default:
        throw new Error(`Unsupported platform: ${this.platform}`);
    }
  }

  // -------------------------
  // PLATFORM FEATURES HANDLER
  // -------------------------
  async handlePlatformFeatures(joiner) {

    // featureConfig.js is keyed per platform - every toggle below reads
    // from this platform's own copy.
    const platformFeatures = featureConfig[this.platform];

    switch (this.platform) {

      // ---------------- ZOOM ----------------
      case 'zoom': {

        if (platformFeatures.captionMonitor.enabled) {
          this.captionMonitor = new ZoomCaptionMonitor(
            this.sessionId,
            this.browserManager.page,
            this.meetingDbId,
            this.platform,
            joiner,
            this.stop.bind(this)
          );

          this.captionMonitor.startPolling();
        } else {
          logger.info('DefaultAdapter(SocraticBot): captionMonitor disabled via featureConfig for zoom — skipping caption capture/persistence.');
        }

        let participantTracker = null;
        if (platformFeatures.participantTracker.enabled) {
          participantTracker = new ZoomParticipantTracker(
            this.meetingDbId,
            this.sessionId
          );
          this.participantTracker = participantTracker;

          if (joiner.setParticipantTracker) {
            joiner.setParticipantTracker(participantTracker);
          }
        } else {
          logger.info('DefaultAdapter(SocraticBot): participantTracker disabled via featureConfig for zoom — skipping.');
        }

        const active = await joiner.checkCaptionsEnabled();

        if (!active && joiner.sendChatRequest) {
          await joiner.sendChatRequest();
        }

        if (joiner.startTranscriptMonitor) {
          await joiner.startTranscriptMonitor();
        }

        if (platformFeatures.attendanceMonitor.enabled) {
          ZoomMonitor.monitorMeeting(
            this.browserManager.page,
            this.meetingDbId,
            this.botName,
            this.sessionId,
            participantTracker
          )
            .then(() => this.stop())
            .catch(err =>
              logger.error(
                'DefaultAdapter(SocraticBot): Monitor loop crashed:',
                err
              )
            );
        } else {
          logger.info('DefaultAdapter(SocraticBot): attendanceMonitor disabled via featureConfig for zoom — bot will stay in meeting with no join/leave tracking.');
        }
        break;
      }

      // ---------------- GOOGLE MEET ----------------
      case 'google-meet': {

        if (platformFeatures.captionMonitor.enabled) {
          this.captionMonitor = new GoogleMeetCaptionMonitor(
            this.sessionId,
            this.browserManager.page,
            this.meetingDbId,
            this.platform,
            joiner,
            this.stop.bind(this)
          );

          this.captionMonitor.startPolling();
          joiner.setCaptionMonitor(this.captionMonitor);
        } else {
          logger.info('DefaultAdapter(SocraticBot): captionMonitor disabled via featureConfig for google-meet — skipping caption capture/persistence.');
        }

        let participantTracker = null;
        if (platformFeatures.participantTracker.enabled) {
          participantTracker = new GoogleParticipantTracker(
            this.meetingDbId,
            this.sessionId
          );
          this.participantTracker = participantTracker;
          joiner.setParticipantTracker(participantTracker);
        } else {
          logger.info('DefaultAdapter(SocraticBot): participantTracker disabled via featureConfig for google-meet — skipping.');
        }

        // Don't re-start (and reset()) the transcript monitor if it was
        // already started early in run() — that would wipe out the
        // transcriptBuffer/seenRows that may have just been the very
        // evidence used to detect this human, and lose any caption lines
        // captured before the session existed.
        if (joiner.startTranscriptMonitor && !this._earlyTranscriptMonitorStarted) {
          await joiner.startTranscriptMonitor();
        }

        // INITIAL ROSTER CAPTURE (parity with the other Google Meet bot path,
        // GoogleMeetAdapter.js): opens the People panel and records anyone
        // already in the call right now, instead of relying solely on
        // monitorMeeting()'s own polling to notice them on its next tick.
        // This reuses the exact same monitor.js helper Path A uses — no
        // separate implementation. NOTE: unlike GoogleMeetAdapter.js (which
        // anchors this to the moment the bot itself joined), there is no
        // single clean "bot join" timestamp threaded through this far into
        // SocraticBot's flow, so this intentionally uses captureInitialParticipants'
        // own default snapshot time (now, i.e. the moment a human was
        // detected) rather than risk touching earlier, already-relied-upon
        // parts of this file to plumb one through. Only meaningful with a
        // real participantTracker to record into.
        const initialParticipants = participantTracker
          ? await GoogleMeetMonitor.captureInitialParticipants(
              this.browserManager.page,
              this.botName,
              participantTracker
            )
          : [];

        if (platformFeatures.attendanceMonitor.enabled) {
          GoogleMeetMonitor.monitorMeeting(
              this.browserManager.page,
              this.meetingDbId,
              this.botName,
              this.sessionId,
              participantTracker,
              initialParticipants
            )
              .then(() => this.stop())
              .catch(err =>
                logger.error(
                  'DefaultAdapter(SocraticBot): Monitor loop crashed:',
                  err
                )
              );
        } else {
          logger.info('DefaultAdapter(SocraticBot): attendanceMonitor disabled via featureConfig for google-meet — bot will stay in meeting with no join/leave tracking.');
        }

          break;
      }

      // ---------------- TEAMS ----------------
      case 'teams': {

        // FIX 1: TeamsCaptionMonitor is now the SINGLE source of truth for
        // caption capture/persistence on Teams. teamsJoiner.js's
        // startTranscriptMonitor() no longer runs its own polling loop —
        // it only does post-join setup (mute mic, enable captions), so
        // there is no more double-polling here.
        if (platformFeatures.captionMonitor.enabled) {
          this.captionMonitor = new TeamsCaptionMonitor(
            this.sessionId,
            this.browserManager.page,
            this.meetingDbId,
            this.platform,
            joiner,
            this.stop.bind(this)
          );

          this.captionMonitor.startPolling();
        } else {
          logger.info('DefaultAdapter(SocraticBot): captionMonitor disabled via featureConfig for teams — skipping caption capture/persistence.');
        }

        if (joiner.enableCaptionsIfPossible) {
          await joiner.enableCaptionsIfPossible();
        }

        // FIX 2: participant tracker now created here (matching zoom/meet),
        // stored on `this.participantTracker` so stop() can reset it, and
        // passed both to the joiner (for future use, e.g. in-lobby events)
        // and into TeamsMonitor.monitorMeeting so attendance tracking uses
        // the SAME instance instead of an invisible one created internally
        // inside monitor.js.
        let participantTracker = null;
        if (platformFeatures.participantTracker.enabled) {
          participantTracker = new TeamsParticipantTracker(
            this.meetingDbId,
            this.sessionId
          );
          this.participantTracker = participantTracker;

          if (joiner.setParticipantTracker) {
            joiner.setParticipantTracker(participantTracker);
          }
        } else {
          logger.info('DefaultAdapter(SocraticBot): participantTracker disabled via featureConfig for teams — skipping.');
        }

        if (joiner.startTranscriptMonitor) {
          await joiner.startTranscriptMonitor();
        }

        const initialParticipants = participantTracker
          ? await TeamsMonitor.captureInitialParticipants(
              this.browserManager.page,
              this.botName,
              participantTracker
            )
          : [];

        if (platformFeatures.attendanceMonitor.enabled) {
          TeamsMonitor.monitorMeeting(
            this.browserManager.page,
            this.meetingDbId,
            this.botName,
            this.sessionId,
            participantTracker,
            initialParticipants
          )
            .then(() => this.stop())
            .catch(err =>
              logger.error(
                'DefaultAdapter(SocraticBot): Monitor loop crashed:',
                err
              )
            );
        } else {
          logger.info('DefaultAdapter(SocraticBot): attendanceMonitor disabled via featureConfig for teams — bot will stay in meeting with no join/leave tracking.');
        }
        break;
      }
    
      default:
        throw new Error(`Unsupported platform: ${this.platform}`);
    }
  }

  // -------------------------
  // STOP BOT
  // -------------------------

  async stop() {
    // NEW (Request 4, item 5 — idempotency / duplicate-shutdown protection):
    // guards against stop() running twice (e.g. a monitor loop's
    // `.then(() => this.stop())` racing with an external
    // botManager.stopBot() call, or run()'s own catch-block calling stop()
    // after a partial failure). Everything below — recorder stop, browser
    // close, asset creation, Python pipeline trigger — is otherwise not
    // safe to run twice.
    if (this._stopped) {
      logger.info('DefaultAdapter(SocraticBot): stop() already ran; skipping duplicate shutdown.');
      return;
    }
    this._stopped = true;

    // Persist the stop into meetings.status so the DB reflects that this bot is
    // no longer live. Admin > Meetings > Live reads meetings.status to show
    // "Bot stopped" and to pause its status polling when no bot is active.
    // Guarded: only overwrite a LIVE state, so an earlier terminal state that
    // already explains the end (host_rejected / waiting_timeout / failed /
    // completed / ...) is preserved. Done early so it runs even when one of
    // the later session-finalization paths returns early.
    if (this.meetingDbId) {
      try {
        const meetingStatusRow = await MeetingModel.getMeetingStatusById(this.meetingDbId);
        const liveStatuses = ['queued', 'launching', 'starting', 'joining', 'bot_launching', 'waiting_for_host', 'active', 'joined'];
        if (meetingStatusRow && liveStatuses.indexOf(meetingStatusRow.status) !== -1) {
          const marked = await MeetingModel.updateMeetingStatusById(this.meetingDbId, 'stopped');
          if (marked && marked.updated) {
            logger.info(`DefaultAdapter(SocraticBot): Meeting ${this.meetingDbId} status -> stopped (was ${meetingStatusRow.status})`);
          }
        }
      } catch (persistErr) {
        logger.error('DefaultAdapter(SocraticBot): Failed to persist stopped status:', persistErr);
      }
    }

    logger.info('DefaultAdapter(SocraticBot): Shutting down SocraticBot...');

    if (this.captionMonitor) {
      this.captionMonitor.stopPolling();
    }

    if (this.joiner && typeof this.joiner.stopTranscriptMonitor === 'function') {
      await this.joiner.stopTranscriptMonitor();
    }

    // FIX 2: this now works for ALL platforms (zoom, google-meet, teams)
    // since this.participantTracker is consistently populated in
    // handlePlatformFeatures() above. Previously this was commented out
    // and Teams participants never got marked "left" on shutdown.
    if (this.participantTracker) {
      try {
        await this.participantTracker.reset(new Date());
      } catch (err) {
        logger.error('DefaultAdapter(SocraticBot): Error resetting participant tracker:', err);
      }
    }

    // Close the browser regardless of whether a session started, so a stop
    // that arrives mid-wait (or after host_rejected / waiting_timeout /
    // failed) still cleans up safely.
    try {
      if (this.browserManager) {
        await this.browserManager.close();
        logger.info('DefaultAdapter(SocraticBot): Browser closed and profile cleanup triggered');
      }
    } catch (err) {
      logger.error('DefaultAdapter(SocraticBot): Browser close failed:', err);
    }

    // A session that was created but never actually started recording cannot
    // be finalized — reflect the real reason it stopped.
    if (this._sessionActive && !this._recordingStarted) {
      await this._finalizeSessionFailure('recording never started');
    }

    // Only run the asset/Python pipeline when a real human/conversation
    // session exists AND recording actually started.
    if (this._sessionActive && this.audioRecorder && this._recordingStarted) {
      this.audioRecorder.stop();
      // screenRecorder may be null if disabled via featureConfig.
      if (this.screenRecorder) {
        await this.screenRecorder.stop();
      }

      try {
        const finalAudioPath = this.audioRecorder.audioPath;

        if (!finalAudioPath) {
          logger.warn('Final audio path is undefined. Skipping transcription.');
          await this._finalizeSessionFailure('audio path undefined');
          return;
        }

        if (!fs.existsSync(finalAudioPath)) {
          logger.warn(`DefaultAdapter(SocraticBot): Recorded audio file not found on disk (${finalAudioPath}); skipping asset creation.`);
          await this._finalizeSessionFailure(`audio file missing: ${finalAudioPath}`);
          return;
        }

        logger.info(`DefaultAdapter(SocraticBot): Processing final recording: ${finalAudioPath}`);

        await MeetingSessionController.updateMeetingSessionAudioPath(this.meetingDbId, this.sessionId, finalAudioPath);

        const session = await MeetingSessionController.getMeetingSessionById(this.sessionId);

        // NEW (Request 4, item 3 / item 5 "human joins but never speaks"):
        // the transcript file exists from the moment a human joins
        // (captionMonitor's header write), regardless of whether anyone
        // actually spoke. Only treat it as a real transcript asset when
        // hasRealTranscriptContent() confirms actual caption lines were
        // captured, not just the placeholder header — otherwise
        // transcriptPath stays null and no fake/empty transcript asset is
        // recorded. Audio is still processed either way.
        let transcriptPath = null;
        const hasTranscriptContent = this.hasRealTranscriptContent();

        if (session && session.transcript_file_name && hasTranscriptContent) {
          const candidatePath = resolveStoragePath(
            path.resolve(__dirname, '..'),
            session.transcript_file_name,
            'transcript'
          );

          if (fs.existsSync(candidatePath)) {
            transcriptPath = candidatePath;
            logger.info(`DefaultAdapter(SocraticBot): Transcript content detected (${session.transcript_file_name})`);
          }
        }

        if (!transcriptPath) {
          logger.info(`DefaultAdapter(SocraticBot): No real transcript content detected for session ${this.sessionId}; recording audio asset only.`);
        }

        await MeetingAssetController.initializeAssets(this.meetingDbId, this.sessionId, finalAudioPath, transcriptPath);

        const finalAudioFileName = path.basename(finalAudioPath);
        const auditResults = await PythonBridge.runFullAudioPipeline(this.meetingDbId, this.sessionId, finalAudioFileName);

        // Session status reflects the ACTUAL outcome — 'completed' only when
        // real conversation content was actually captured (the session made
        // it to 'processing'); a session that stayed at 'human_detected' the
        // whole time (bot joined, someone was in the room, but nobody's
        // speech was ever picked up) is 'no_activity', not 'completed'.
        const finalSessionStatus = hasTranscriptContent ? 'completed' : 'no_activity';
        await MeetingSessionController.updateMeetingSessionStatus(this.meetingDbId, this.sessionId, finalSessionStatus);

        if (auditResults) {
          logger.info(`DefaultAdapter(SocraticBot): Audit analysis complete. Score: ${auditResults.auditResult?.oqi_score}`);
        }
      } catch (err) {
        logger.error('DefaultAdapter(SocraticBot): Final transcription/audit failed', err);
        await this._finalizeSessionFailure('processing pipeline failed');
      }
    }
  }
}

module.exports = SocraticBot;