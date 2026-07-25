/**
 * root/services/socraticbot.js
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

const MeetingAssetsModel = require('../models/recordings/MeetingAssetsModel');
const MeetingModel = require('../models/meetings/MeetingModel');

const PythonBridge = require('./shared/pythonBridge');

const fs = require('fs');
const path = require('path');
const TranscriptModel = require('../models/transcripts/transcriptModel');
const { logger } = require('../utils/logger');

class SocraticBot {
  constructor(config = {}) {
    this.meetingUrl = config.meetingUrl;
    this.botName = config.botName;
    this.passcode = config.passcode || process.env.ZOOM_PASSCODE || '';
    this.sessionId = config.sessionId;
    this.platform = config.platform;
    this.meetingId = config.meetingId;

    const storageDir = path.resolve(__dirname, '..', 'storage', 'recordings');
    this.audioRecorder = new AudioRecorder(storageDir, this.sessionId, this.meetingId);

    const screenStorageDir = path.resolve(__dirname, '..', 'storage', 'screen-recordings');
    this.screenRecorder = new ScreenRecorder(screenStorageDir, this.sessionId, this.meetingId);

    // Initialize platform-specific transcription service
    this.transcriptionService = this.createTranscriptionService();

    this.browserManager = null;
    this.ZoomCaptionMonitor = null;
    this.TeamsCaptionMonitor = null;
    this.GoogleMeetCaptionMonitor = null;
  }

  // -------------------------
  // MAIN RUN
  // -------------------------
  async run() {
    try {
      
      // this.browserManager = await new BrowserManager().init();

      const safeId = String(this.meetingId || this.sessionId).replace(/[<>:"/\\|?*]/g, '_');
      
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
          this.meetingId,
          this.platform,
          joiner,
          this.stop.bind(this)
        );

        this.captionMonitor.startPolling();

        const participantTracker = new ZoomParticipantTracker(
          this.meetingId,
          this.sessionId
        );

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
          this.meetingId,
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
          this.meetingId,
          this.platform,
          joiner,
          this.stop.bind(this)
        );

        this.captionMonitor.startPolling();

        const participantTracker = new GoogleParticipantTracker(
          this.meetingId,
          this.sessionId
        );

        // Inject dependencies using setters for proper state initialization
        joiner.setCaptionMonitor(this.captionMonitor);
        joiner.setParticipantTracker(participantTracker);

        if (joiner.startTranscriptMonitor) {
          await joiner.startTranscriptMonitor();
        }

        // Start the Google Meet monitor loop (handles "bot alone" exit condition).
        GoogleMeetMonitor.monitorMeeting(
            this.browserManager.page,
            this.meetingId,
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

        this.captionMonitor = new TeamsCaptionMonitor(
          this.sessionId,
          this.browserManager.page,
          this.meetingId,
          this.platform,
          joiner,
          this.stop.bind(this)
        );

        this.captionMonitor.startPolling();

        if (joiner.enableCaptionsIfPossible) {
          await joiner.enableCaptionsIfPossible();
        }

        // const participantTracker = new TeamsParticipantTracker(
        //   this.meetingId,
        //   this.sessionId
        // );

        // if (joiner.setParticipantTracker) {
        //   joiner.setParticipantTracker(participantTracker);
        // }

        if (joiner.startTranscriptMonitor) {
          await joiner.startTranscriptMonitor();
        }

        TeamsMonitor.monitorMeeting(
          this.browserManager.page,
          this.meetingId,
          this.botName,
          this.sessionId
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

    // // ✅ Mark all still-active participants as left
    // if (this.participantTracker) {
    //   await this.participantTracker.reset(new Date());
    // }

    // stop recording + transcribe
    if (this.audioRecorder) {
      this.audioRecorder.stop();
      await this.screenRecorder.stop();

      // ADD at the end of stop(), after the catch block
      try {
        if (this.browserManager) {
          await this.browserManager.close();
          logger.info('DefaultAdapter(SocraticBot): Browser closed and profile cleanup triggered');
        }
      } catch (err) {
        logger.error('DefaultAdapter(SocraticBot): Browser close failed:', err);
      } finally {
        // logger.info('DefaultAdapter(SocraticBot): Bot fully stopped');
        // process.exit(0);
      }
      
      try {
        const finalAudioPath = this.audioRecorder.audioPath;
        
        if (!finalAudioPath) {
          logger.warn('Final audio path is undefined. Skipping transcription.');
          return;
        }

        if (fs.existsSync(finalAudioPath)) {

          logger.info(`DefaultAdapter(SocraticBot) - Line:223 : Processing final transcription: ${finalAudioPath}`);
          
          // 1. Save audio path to DB
          await TranscriptModel.saveAudioFile(this.sessionId, finalAudioPath);
          
          // 2. MATCHING: Get the speaker-labeled transcript file from Database
          const session = await TranscriptModel.getSessionById(this.sessionId);
          
          if (session && session.transcript_file_name) {

            const transcriptPath = path.join(__dirname, '../storage/transcripts', session.transcript_file_name);
            
            if (fs.existsSync(transcriptPath)) {
              logger.info(`DefaultAdapter(SocraticBot) - Line:236 : detected: Audio and Transcript (${session.transcript_file_name})`);
              
              // ONLY RUNNING THE FINAL ANALYSIS BRIDGE
              // engine_main.py expects an input like REC_<id>.mp3 (relative to storage/recordings),
              // but `finalAudioPath` is an absolute Windows path. Pass only the filename.

              await MeetingAssetsModel.initializeAssets(this.meetingId, finalAudioPath);

              const finalAudioFileName = path.basename(finalAudioPath);
              const auditResults = await PythonBridge.runFullAudioPipeline(finalAudioFileName);


              if (auditResults) {
                await MeetingModel.updateMeetingStatus(this.meetingId, 'completed');
                logger.info(`DefaultAdapter(SocraticBot): Audit analysis complete. Score: ${auditResults.oqi}`);
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
