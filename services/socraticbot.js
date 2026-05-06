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

      // ✅ PASS IT TO THE BROWSER MANAGER
      this.browserManager = await new BrowserManager().init({
        userDataDir: uniqueProfileDir
      });

      const joiner = this.createJoiner();
      this.joiner = joiner;

      // 🚀 JOIN MEETING
      await joiner.joinMeeting();

      await new Promise(resolve => setTimeout(resolve, 2000));

      // 🎙 START AUDIO RECORDING
      logger.info('🎙️ Triggering FFmpeg recording...');
      await this.audioRecorder.start();

      // 🧠 PLATFORM FEATURES
      await this.handlePlatformFeatures(joiner);

      logger.info('READY: SocraticBot is now recording and transcribing.');

    } catch (err) {
      logger.error('FATAL: Bot failed to start', err);
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
    logger.info('Shutting down SocraticBot...');

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

        if (fs.existsSync(finalAudioPath)) {
          logger.info(`Processing final transcription: ${finalAudioPath}`);
          
          // 1. Save audio path to DB
          await TranscriptModel.saveAudioFile(this.sessionId, finalAudioPath);

          // 2. Get high-quality text from Audio (Whisper)
          const audioText = await this.transcriptionService.transcribeAudio(finalAudioPath);
          
          // 3. MATCHING: Get the speaker-labeled transcript file from Database
          const session = await TranscriptModel.getSessionById(this.sessionId);
          
          if (session && session.transcript_file_name) {
            const transcriptPath = path.join(__dirname, '../storage/transcript', session.transcript_file_name);
            
            if (fs.existsSync(transcriptPath)) {
              logger.info(`Matching detected: Audio + Transcript (${session.transcript_file_name})`);
              
              // 4. Read the labeled text (e.g. "[19:33:33] Yash: ...")
              const labeledText = fs.readFileSync(transcriptPath, 'utf8');

              // 5. SUMMARY: Send both to your AI service
              // (Assuming your transcriptionService or a Summarizer class handles this)
              const summary = await this.transcriptionService.generateSummary(audioText, labeledText);
              
              // 6. SAVE: Update the database with the final summary
              await MeetingModel.updateSummary(this.sessionId, summary);
              
              logger.info('Final Combined Summary achieved successfully.');
            }
          }
        } else {
          logger.warn(`Audio file not available, skipping transcription: ${finalAudioPath}`);
        }
      } catch (err) {
        logger.error('Transcription/Matching failed during shutdown', err);
      }
    }

    if (this.browserManager) {
      await this.browserManager.close();
    }

    logger.info('SocraticBot stopped.');
  }
}

module.exports = SocraticBot;