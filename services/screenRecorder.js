/**
 * services/screenRecorder.js
 */
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const { logger } = require('../utils/logger');
const settings = require('../config/settings');

class ScreenRecorder {
  constructor(storageDir, sessionId, meetingDbId) {
    this.storageDir = path.resolve(storageDir);

    if (!meetingDbId) {
      throw new Error("ScreenRecorder requires a meetingId to generate the file name.");
    }

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    const now = new Date();
    const timestamp = now.toISOString().split('T')[0] + '_' +
                      now.getHours().toString().padStart(2, '0') + '-' +
                      now.getMinutes().toString().padStart(2, '0');

    const fileName = `SCREEN_${meetingDbId}_Sess${sessionId}_${timestamp}.mp4`;

    this.videoPath = path.join(this.storageDir, fileName);

    this.ffmpegProcess = null;
    this.recordingError = false;
    this.exitCode = null;
  }

  async start() {
    logger.info('DefaultAdapter(screenRecorder): WINDOWS SCREEN: Starting screen + audio capture...');

    this.ffmpegProcess = spawn('ffmpeg', [
      // ── VIDEO
      '-f', 'gdigrab',
      '-framerate', settings.screen.framerate,
      '-draw_mouse', '1',
      '-i', 'desktop',

      // ── AUDIO (deviceName already has "audio=" prefix)
      '-f', 'dshow',
      '-i', settings.audio.deviceName,   // ← just this, no template literal

      // ── OUTPUT
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', settings.screen.crf || '28',
      '-c:a', 'aac',
      '-b:a', settings.audio.bitrate,
      '-ar', settings.audio.sampleRate,
      '-ac', settings.audio.channels,
      '-y',
      this.videoPath
    ], {
      stdio: ['pipe', 'pipe', 'pipe']   // ← stdin must be pipe, not ignored
    });

    this.ffmpegProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      const lines = msg.split(/\r?\n/);

      // logger.info(`DefaultAdapter(screenRecorder): FFMPEG: ${data.toString()}`);

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
          /^\[.*@.*\]/i
        ].some((pattern) => pattern.test(line));

        if (isFatal) {
          this.recordingError = true;
          if (/capture device not found|could not find|error opening input file/i.test(line)) {
            logger.error(`DefaultAdapter(screenRecorder): ERROR: Audio device "${settings.audio.deviceName}" not found. Check settings.js`);
          }
          logger.error(`DefaultAdapter(screenRecorder): FFMPEG stderr: ${line}`);
        } else if (!isProgress) {
          logger.debug(`DefaultAdapter(screenRecorder): FFMPEG stderr: ${line}`);
        }
      });
    });

    this.ffmpegProcess.on('error', (err) => {
      this.recordingError = true;
      logger.error(`DefaultAdapter(screenRecorder): FFMPEG Process Error: ${err.message}`);
    });

    this.ffmpegProcess.on('exit', (code, signal) => {
      this.exitCode = code;
      if (code !== null && code !== 0) {
        this.recordingError = true;
        logger.error(`DefaultAdapter(screenRecorder): FFMPEG exited with code ${code}${signal ? ` signal=${signal}` : ''}. Output may not have been saved.`);
      }
    });
  }

  stop() {
    if (this.ffmpegProcess) {
      return new Promise((resolve) => {
        
        this.ffmpegProcess.on('close', () => {
          const fileExists = fs.existsSync(this.videoPath);
          if (fileExists && !this.recordingError) {
            logger.info(`DefaultAdapter(screenRecorder): VIDEO SAVED: ${this.videoPath}`);
          } else if (fileExists) {
            logger.warn(`DefaultAdapter(screenRecorder): VIDEO MAY BE CORRUPT: ${this.videoPath}`);
          } else {
            logger.warn(`DefaultAdapter(screenRecorder): VIDEO NOT SAVED: ${this.videoPath}`);
          }
          this.ffmpegProcess = null;
          resolve();
        });

        // Graceful quit — lets ffmpeg finalize moov atom before exit
        this.ffmpegProcess.stdin.write('q');

        // Safety fallback — force kill if ffmpeg hangs after 8s
        setTimeout(() => {
          if (this.ffmpegProcess) {
            logger.warn('DefaultAdapter(screenRecorder): Force killing ffmpeg...');
            this.ffmpegProcess.kill('SIGKILL');
          }
        }, 8000);

      });
    }
  }
}

module.exports = ScreenRecorder;