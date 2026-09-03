/**
 * services/audioRecorder.js
 *
 */
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const { logger } = require('../utils/logger');
const settings = require('../config/settings');

class AudioRecorder {
  constructor(storageDir, sessionId, meetingDbId) {
    this.storageDir = path.resolve(storageDir);
    if (!meetingDbId) {
      throw new Error("AudioRecorder requires a meetingId to generate the file name.");
    }

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    // Use sessionId in the filename for better tracking
    const now = new Date();
    const timestamp = now.toISOString().split('T')[0] + '_' + 
                      now.getHours().toString().padStart(2, '0') + '-' + 
                      now.getMinutes().toString().padStart(2, '0');

    const fileName = `REC_${meetingDbId}_Sess${sessionId}_${timestamp}.mp3`;
    // ------------------------------

    this.audioPath = path.join(this.storageDir, fileName);

    this.ffmpegProcess = null;
    this.recordingError = false;
    this.exitCode = null;
  }

  async start() {
    logger.info('DefaultAdapter(audioRecorder): WINDOWS AUDIO: Tapping into System Sound...');

    // 🟢 Pull everything from settings.js
    this.ffmpegProcess = spawn('ffmpeg', [
      '-f', 'dshow',
      '-i', settings.audio.deviceName,
      '-acodec', settings.audio.format,
      '-ab', settings.audio.bitrate,
      '-ar', settings.audio.sampleRate,
      '-ac', settings.audio.channels,
      '-y',
      this.audioPath
    ]);

    this.ffmpegProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      const lines = msg.split(/\r?\n/);

      lines.forEach((rawLine) => {
        const line = rawLine.trim();
        if (!line) return;

        const isFatal = /(capture device not found|immediate exit|could not find|error opening input file|error opening input|invalid data|unknown option|no such file or directory|failed to open|cannot open|permission denied)/i.test(line);
        const isProgress = [
          /^press \[q\] to stop/i,
          /^output #0/i,
          /^stream mapping:/i,
          /^duration:/i,
          /^frame=/i,
          /^size=/i,
          /^bitrate=/i,
          /^speed=/i,
          /^time=/i,
          /^stream #\d+:\d+/i,
          /^metadata:/i,
          /^guessed channel layout:/i,
          /^input #0,/i,
          /^audio:/i,
          /^video:/i,
          /^libav/i,
          /^configuration:/i,
          /^ffmpeg version/i,
          /^press \[q\] to stop/i,
          /^\[.*@.*\]/i
        ].some((pattern) => pattern.test(line));

        if (isFatal) {
          this.recordingError = true;
          if (/capture device not found|could not find|error opening input file/i.test(line)) {
            logger.error(`DefaultAdapter(audioRecorder): ERROR: Audio device "${settings.audio.deviceName}" not found. Check settings.js`);
          }
          logger.error(`DefaultAdapter(audioRecorder): FFMPEG stderr: ${line}`);
        } else if (!isProgress) {
          logger.debug(`DefaultAdapter(audioRecorder): FFMPEG stderr: ${line}`);
        }
      });
    });

    this.ffmpegProcess.on('error', (err) => {
      this.recordingError = true;
      logger.error(`DefaultAdapter(audioRecorder): FFMPEG Process Error: ${err.message}`);
    });

    this.ffmpegProcess.on('exit', (code, signal) => {
      this.exitCode = code;
      if (code !== null && code !== 0) {
        this.recordingError = true;
        logger.error(`DefaultAdapter(audioRecorder): FFMPEG exited with code ${code}${signal ? ` signal=${signal}` : ''}. Output may not have been saved.`);
      }
    });
  }

  stop() {
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGINT');
      const fileExists = fs.existsSync(this.audioPath);
      if (fileExists && !this.recordingError) {
        logger.info(`DefaultAdapter(audioRecorder): AUDIO SAVED: ${this.audioPath}`);
      } else if (fileExists) {
        logger.warn(`DefaultAdapter(audioRecorder): AUDIO MAY BE CORRUPT: ${this.audioPath}`);
      } else {
        logger.warn(`DefaultAdapter(audioRecorder): AUDIO NOT SAVED: ${this.audioPath}`);
      }
      this.ffmpegProcess = null;
    }
  }
}

module.exports = AudioRecorder;