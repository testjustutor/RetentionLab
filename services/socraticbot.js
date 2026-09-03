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

const AudioRecorder = require('./audioRecorder');
const ScreenRecorder = require('./screenRecorder');

const MeetingSessionController = require('../controllers/meetings/meeting-session/meetingSessionController');
const MeetingAssetController = require('../controllers/meetings/assets/meetingAssetController');

const PythonBridge = require('./shared/pythonBridge');

const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');
const { resolveStoragePath } = require('../utils/storagePaths');

class SocraticBot {
  constructor(config = {}) {
    this.meetingUrl = config.meetingUrl;
    this.botName = config.botName;
    this.passcode = config.passcode || process.env.ZOOM_PASSCODE || '';
    this.sessionId = config.sessionId;
    this.platform = config.platform;
    this.meetingId = config.meetingId;
    this.meetingDbId = config.meetingDbId ?? null; // internal meetings.id (auto-increment PK)

    const storageDir = path.resolve(__dirname, '..', 'storage', 'recordings');
    this.audioRecorder = new AudioRecorder(storageDir, this.sessionId, this.meetingDbId);

    const screenStorageDir = path.resolve(__dirname, '..', 'storage', 'screen-recordings');
    this.screenRecorder = new ScreenRecorder(screenStorageDir, this.sessionId, this.meetingDbId);

    this.transcriptionService = this.createTranscriptionService();

    this.browserManager = null;
    this.captionMonitor = null;
    this.participantTracker = null;
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
      });

      const joiner = this.createJoiner();
      this.joiner = joiner;

      // JOIN MEETING
      await joiner.joinMeeting();

      await new Promise(resolve => setTimeout(resolve, 2000));

      // START AUDIO RECORDING
      logger.info('DefaultAdapter(SocraticBot): Triggering FFmpeg recording...');
      await this.audioRecorder.start();
      this.screenRecorder.start();

      // PLATFORM FEATURES
      await this.handlePlatformFeatures(joiner);

      logger.info('DefaultAdapter(SocraticBot): READY: SocraticBot is now recording and transcribing.');

    } catch (err) {
      logger.error('DefaultAdapter(SocraticBot): FATAL: Bot failed to start', err);
      await this.stop();
      throw err;
    }
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

    switch (this.platform) {

      // ---------------- ZOOM ----------------
      case 'zoom': {

        this.captionMonitor = new ZoomCaptionMonitor(
          this.sessionId,
          this.browserManager.page,
          this.meetingDbId,
          this.platform,
          joiner,
          this.stop.bind(this)
        );

        this.captionMonitor.startPolling();

        const participantTracker = new ZoomParticipantTracker(
          this.meetingDbId,
          this.sessionId
        );
        this.participantTracker = participantTracker;

        if (joiner.setParticipantTracker) {
          joiner.setParticipantTracker(participantTracker);
        }

        const active = await joiner.checkCaptionsEnabled();

        if (!active && joiner.sendChatRequest) {
          await joiner.sendChatRequest();
        }

        if (joiner.startTranscriptMonitor) {
          await joiner.startTranscriptMonitor();
        }

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
        break;
      }

      // ---------------- GOOGLE MEET ----------------
      case 'google-meet': {

        this.captionMonitor = new GoogleMeetCaptionMonitor(
          this.sessionId,
          this.browserManager.page,
          this.meetingDbId,
          this.platform,
          joiner,
          this.stop.bind(this)
        );

        this.captionMonitor.startPolling();

        const participantTracker = new GoogleParticipantTracker(
          this.meetingDbId,
          this.sessionId
        );
        this.participantTracker = participantTracker;

        joiner.setCaptionMonitor(this.captionMonitor);
        joiner.setParticipantTracker(participantTracker);

        if (joiner.startTranscriptMonitor) {
          await joiner.startTranscriptMonitor();
        }

        GoogleMeetMonitor.monitorMeeting(
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

          break;
      }

      // ---------------- TEAMS ----------------
      case 'teams': {

        // FIX 1: TeamsCaptionMonitor is now the SINGLE source of truth for
        // caption capture/persistence on Teams. teamsJoiner.js's
        // startTranscriptMonitor() no longer runs its own polling loop —
        // it only does post-join setup (mute mic, enable captions), so
        // there is no more double-polling here.
        this.captionMonitor = new TeamsCaptionMonitor(
          this.sessionId,
          this.browserManager.page,
          this.meetingDbId,
          this.platform,
          joiner,
          this.stop.bind(this)
        );

        this.captionMonitor.startPolling();

        if (joiner.enableCaptionsIfPossible) {
          await joiner.enableCaptionsIfPossible();
        }

        // FIX 2: participant tracker now created here (matching zoom/meet),
        // stored on `this.participantTracker` so stop() can reset it, and
        // passed both to the joiner (for future use, e.g. in-lobby events)
        // and into TeamsMonitor.monitorMeeting so attendance tracking uses
        // the SAME instance instead of an invisible one created internally
        // inside monitor.js.
        const participantTracker = new TeamsParticipantTracker(
          this.meetingDbId,
          this.sessionId
        );
        this.participantTracker = participantTracker;

        if (joiner.setParticipantTracker) {
          joiner.setParticipantTracker(participantTracker);
        }

        if (joiner.startTranscriptMonitor) {
          await joiner.startTranscriptMonitor();
        }

        TeamsMonitor.monitorMeeting(
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

    // stop recording + transcribe
    if (this.audioRecorder) {
      this.audioRecorder.stop();
      await this.screenRecorder.stop();

      try {
        if (this.browserManager) {
          await this.browserManager.close();
          logger.info('DefaultAdapter(SocraticBot): Browser closed and profile cleanup triggered');
        }
      } catch (err) {
        logger.error('DefaultAdapter(SocraticBot): Browser close failed:', err);
      }
      
      try {
        const finalAudioPath = this.audioRecorder.audioPath;
        
        if (!finalAudioPath) {
          logger.warn('Final audio path is undefined. Skipping transcription.');
          return;
        }

        if (fs.existsSync(finalAudioPath)) {

          logger.info(`DefaultAdapter(SocraticBot) - Line:223 : Processing final transcription: ${finalAudioPath}`);
          
          await MeetingSessionController.updateMeetingSessionAudioPath(this.meetingDbId, this.sessionId, finalAudioPath);
          
          const session = await MeetingSessionController.getMeetingSessionById(this.sessionId);
          
          if (session && session.transcript_file_name) {

            const transcriptPath = resolveStoragePath(
              path.resolve(__dirname, '..'),
              session.transcript_file_name,
              'transcript'
            );
            
            if (fs.existsSync(transcriptPath)) {
              logger.info(`DefaultAdapter(SocraticBot) - Line:236 : detected: Audio and Transcript (${session.transcript_file_name})`);
              
              await MeetingSessionController.updateMeetingSessionStatus(this.meetingDbId, this.sessionId, 'completed');

              await MeetingAssetController.initializeAssets(this.meetingDbId, this.sessionId, finalAudioPath, transcriptPath);

              const finalAudioFileName = path.basename(finalAudioPath);
              const auditResults = await PythonBridge.runFullAudioPipeline(this.meetingDbId, this.sessionId, finalAudioFileName);

              if (auditResults) {
                logger.info(`DefaultAdapter(SocraticBot): Audit analysis complete. Score: ${auditResults.auditResult?.oqi_score}`);
              }
            }
          }
        }
      } catch (err) {
        logger.error('DefaultAdapter(SocraticBot): Final transcription/audit failed', err);
      }
    }
  }
}

module.exports = SocraticBot;