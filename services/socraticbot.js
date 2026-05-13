const BrowserManager = require('./shared/browserManager');

// Platform-specific joiners
const ZoomJoiner = require('./platforms/zoom/zoomJoiner');
const MeetJoiner = require('./platforms/google-meet/meetJoiner');
const TeamsJoiner = require('./platforms/teams/teamsJoiner');

// Platform-specific services
const ZoomMonitor = require('./platforms/zoom/monitor');
const TeamsMonitor = require('./platforms/teams/monitor');
const GoogleMeetMonitor = require('./platforms/google-meet/monitor');

const ZoomReactiveJoinFlow = require('./platforms/zoom/reactiveJoinFlow');
const TeamsReactiveJoinFlow = require('./platforms/teams/reactiveJoinFlow');
const GoogleMeetReactiveJoinFlow = require('./platforms/google-meet/reactiveJoinFlow');

const ZoomAudioRecorderBot = require('./platforms/zoom/audioRecorderBot');
const TeamsAudioRecorderBot = require('./platforms/teams/audioRecorderBot');
const GoogleMeetAudioRecorderBot = require('./platforms/google-meet/audioRecorderBot');

const CaptionMonitor = require('./captionMonitor');
const AudioRecorder = require('./audioRecorder');
const MeetingModel = require('../models/MeetingModel');

const PythonBridge = require('./shared/pythonBridge');

const fs = require('fs');
const path = require('path');
const TranscriptModel = require('../models/transcriptModel');
const { logger } = require('../utils/logger');

class SocraticBot {
  constructor(config = {}) {
    this.meetingUrl = config.meetingUrl || process.env.ZOOM_MEETING_LINK;
    this.botName = config.botName;
    this.passcode = config.passcode || process.env.ZOOM_PASSCODE || '';
    this.sessionId = config.sessionId || 0;
    this.platform = config.platform || 'zoom';
    this.meetingId = config.meetingId || null;

    const storageDir = path.resolve(__dirname, '..', 'storage', 'recordings');
    this.audioRecorder = new AudioRecorder(storageDir, this.sessionId, this.meetingId);

    // Initialize platform-specific transcription service
    this.transcriptionService = this.createTranscriptionService();

    this.browserManager = null;
    this.captionMonitor = null;
  }

  // -------------------------
  // MAIN RUN
  // -------------------------
  async run() {
    try {
    
      const uniqueProfileDir = path.resolve(__dirname, '..', 'storage', 'chrome-profiles', `profile_${this.meetingId || this.sessionId}`);

      // PASS IT TO THE BROWSER MANAGER
      this.browserManager = await new BrowserManager().init({
        userDataDir: uniqueProfileDir
      });

      const joiner = this.createJoiner();
      this.joiner = joiner;

      // JOIN MEETING
      await joiner.joinMeeting();

      await new Promise(resolve => setTimeout(resolve, 2000));

      // START AUDIO RECORDING
      logger.info('DefaultAdapter(SocraticBot): Triggering FFmpeg recording...');
      await this.audioRecorder.start();

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
          this.meetingUrl
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
    this.captionMonitor = new CaptionMonitor(
      this.sessionId,
      this.browserManager.page,
      this.meetingId,
      this.platform,
      joiner,
      this.stop.bind(this)
    );

    this.captionMonitor.startPolling();

    switch (this.platform) {

      // ---------------- ZOOM ----------------
      case 'zoom': {
        const active = await joiner.checkCaptionsEnabled();

        if (!active && joiner.sendChatRequest) {
          await joiner.sendChatRequest();
        }

        if (joiner.startTranscriptMonitor) {
          await joiner.startTranscriptMonitor();
        }
        break;
      }

      // ---------------- GOOGLE MEET ----------------
      case 'google-meet': {
        if (joiner.enableCaptionsIfPossible) {
          await joiner.enableCaptionsIfPossible();
        }

        if (joiner.startTranscriptMonitor) {
          await joiner.startTranscriptMonitor(this.captionMonitor);
        }
        break;
      }

      // ---------------- TEAMS ----------------
      case 'teams': {
        if (joiner.enableCaptionsIfPossible) {
          await joiner.enableCaptionsIfPossible();
        }

        if (joiner.startTranscriptMonitor) {
          await joiner.startTranscriptMonitor();
        }
        break;
      }
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
      this.joiner.stopTranscriptMonitor();
    }

    // stop recording + transcribe
    if (this.audioRecorder) {
      this.audioRecorder.stop();

      try {
        const finalAudioPath = this.audioRecorder.audioPath;
        
        if (!finalAudioPath) {
          logger.warn('Final audio path is undefined. Skipping transcription.');
          return;
        }

        if (fs.existsSync(finalAudioPath)) {

          logger.info(`DefaultAdapter(SocraticBot): Processing final transcription: ${finalAudioPath}`);
          
          // 1. Save audio path to DB
          await TranscriptModel.saveAudioFile(this.sessionId, finalAudioPath);
          
          // 2. MATCHING: Get the speaker-labeled transcript file from Database
          const session = await TranscriptModel.getSessionById(this.sessionId);
          
          if (session && session.transcript_file_name) {

            const transcriptPath = path.join(__dirname, '../storage/transcript', session.transcript_file_name);
            
            if (fs.existsSync(transcriptPath)) {
              logger.info(`DefaultAdapter(SocraticBot): Matching detected: Audio + Transcript (${session.transcript_file_name})`);
              
              // ONLY RUNNING THE FINAL ANALYSIS BRIDGE
              const auditResults = await PythonBridge.runFinalAnalysis(finalAudioPath);

              if (auditResults) {
                logger.info(`DefaultAdapter(SocraticBot): Audit analysis complete. Score: ${auditResults.oqi_score}`);
              }              
              
            }
          }
        } else {
          logger.warn(`DefaultAdapter(SocraticBot): Audio file not available, skipping transcription: ${finalAudioPath}`);
        }
      } catch (err) {
        logger.error('DefaultAdapter(SocraticBot): Transcription/Matching failed during shutdown', err);
      }
    }

    if (this.browserManager) {
      await this.browserManager.close();
    }

    logger.info('DefaultAdapter(SocraticBot): SocraticBot stopped.');
  }
}

module.exports = SocraticBot;