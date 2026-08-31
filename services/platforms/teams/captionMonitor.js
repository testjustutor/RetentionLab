/**
 * root/services/platforms/teams/captionMonitor.js
 *
 */
const TranscriptModel = require('../../../models/transcripts/transcriptModel.js');
const fs = require('fs');
const path = require('path');
const { logger } = require('../../../utils/logger'); 

class CaptionMonitor {
  constructor(sessionId, page, meetingId, platform, joinerInstance, onMeetingEnd) {
    this.sessionId = sessionId;
    this.meetingId = meetingId || 'no-id';
    this.platform = platform;
    this.joiner = joinerInstance;
    this.page = page;
    this.onMeetingEnd = onMeetingEnd;
    this.seenRows = new Set();
    this.poller = null;
    this.isShuttingDown = false;
    this.isMeetingActive = true;

    this.lastKnownSpeaker = "Participant";
    // FIX 4: replaced single global lastSavedText with a per-speaker map
    // so interleaved speakers don't clobber each other's dedup state.
    this.lastTextBySpeaker = new Map();

    const now = new Date();
    const timestamp = now.toISOString().split('T')[0] + '_' + 
                      now.getHours().toString().padStart(2, '0') + '-' + 
                      now.getMinutes().toString().padStart(2, '0');

    this.dirPath = path.join(__dirname, '../../../storage/transcripts');
    this.fileName = `TRANS_${this.meetingId}_Sess${this.sessionId}_${timestamp}.txt`;
    this.filePath = path.join(this.dirPath, this.fileName);

    this.initStorage();
  }

  initStorage() {
    try {
      if (!fs.existsSync(this.dirPath)) {
        fs.mkdirSync(this.dirPath, { recursive: true });
      }

      const header =
        `==========================================\n` +
        `${this.platform.toUpperCase()} MEETING TRANSCRIPT\n` +
        `==========================================\n` +
        `Meeting ID : ${this.meetingId}\n` +
        `Session ID : ${this.sessionId}\n` +
        `Date       : ${new Date().toLocaleString()}\n` +
        `==========================================\n\n`;

      fs.writeFileSync(this.filePath, header);
      logger.info(`TeamsAdapter(captionMonitor): File Created: storage/transcripts/${this.fileName}`);
      if (this.sessionId) {
        TranscriptModel.saveTranscriptFile(this.sessionId, this.fileName)
          .catch(err => logger.error(`TeamsAdapter(captionMonitor): Error saving transcript file metadata: ${err.message}`));
      }
    } catch (err) {
      logger.error(`TeamsAdapter(captionMonitor): Failed to initialize transcript file: ${err.message}`);
    }
  }

  startPolling() {
    if (this.poller) clearInterval(this.poller);
    this.poller = setInterval(() => this.pollCaptions(), 3000);
  }

  stopPolling() {
    this.isShuttingDown = true;
    if (this.poller) {
      clearInterval(this.poller);
      this.poller = null;
    }
  }

  static getMeetingEndPhrases() {
    return [
      "returning to home screen",
      "meeting has been ended by host",
      "meeting has ended",
      "this meeting has ended",
      "host has ended",
      "meeting is over",
      "meeting has expired",
      "you have been removed",
      "removed by the host",
      "meeting ended by host",
      "meeting ended"
    ];
  }

  async pollCaptions() {
    if (this.isShuttingDown) return;
    if (this.page.isClosed()) {
      logger.info('TeamsAdapter(captionMonitor): Page closed detected during polling. Finalizing meeting.');
      await this.handleMeetingEnd();
      return;
    }

    try {
      const url = this.page.url();
      const frame = this.page.frames().find(f => f.url().includes('zoom.us/wc')) ||
        this.page.mainFrame().childFrames()[0] ||
        this.page;

      const pageText = await this.page.evaluate(() => document.body.innerText.toLowerCase());
      const endPhrases = CaptionMonitor.getMeetingEndPhrases();
      const hasEndPhrase = endPhrases.some(phrase => pageText.includes(phrase));

      const hasActiveMeetingPage =
        this.platform === 'zoom'
          ? url.includes('/wc/') || url.includes('/j/') || url.includes('zoom.us')
          : this.platform === 'google-meet'
            ? url.includes('meet.google.com')
            : this.platform === 'teams'
              ? url.includes('teams.microsoft.com') || url.includes('microsoft.com')
              : true;

      if (hasEndPhrase || (this.platform === 'zoom' && !hasActiveMeetingPage)) {
        logger.info('TeamsAdapter(captionMonitor): [SYSTEM] Meeting end detected from page state. Finalizing...');
        await this.handleMeetingEnd();
        return;
      }

      let result;

      if (this.platform === 'zoom') {
        result = await this.getZoomTranscript(frame);
      } else if (this.platform === 'google-meet') {
        result = await this.getMeetTranscript();
      } else if (this.platform === 'teams') {
        result = await this.getTeamsTranscript();
      }

      if (result && result.count > 0) {
        await this.processAndSaveTranscript(result.data);
      }
    } catch (e) {
      if (!e.message.includes('Target closed')) {
        logger.error(`TeamsAdapter(captionMonitor): Polling Error: ${e.message}`);
      }
    }
  }

  async getTeamsTranscript() {
    return await this.page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.fui-ChatMessageCompact'));
      if (rows.length === 0) return { count: 0, data: [] };

      return {
        count: rows.length,
        data: rows.map(row => {
          const nameEl = row.querySelector('[data-tid="author"]');
          const msgEl = row.querySelector('[data-tid="closed-caption-text"]');
          const name = nameEl ? nameEl.innerText.trim() : "Unknown";
          const text = msgEl ? msgEl.innerText.trim() : "";
          const time = new Date().toLocaleTimeString();

          return { name, text, time };
        }).filter(item => item.text.length > 0)
      };
    });
  }

  // FIX 4: dedup is now scoped per-speaker via this.lastTextBySpeaker
  async processAndSaveTranscript(transcriptData) {
    for (const item of transcriptData) {
      let cleanName = item.name.replace(/:$/, '').trim();
      const cleanText = item.text.trim();

      if (!cleanName || cleanName === "") {
        cleanName = this.lastKnownSpeaker;
      } else {
        this.lastKnownSpeaker = cleanName;
      }

      if (!cleanText || cleanText.length < 2) continue;

      const speakerKey = cleanName.toLowerCase();
      const lastTextForSpeaker = this.lastTextBySpeaker.get(speakerKey) || "";

      // If this is a growing continuation of the SAME speaker's last caption,
      // skip it (still growing, wait for the finalized version) — but only
      // compare against THIS speaker's own last line, not whoever spoke last.
      if (lastTextForSpeaker !== "" &&
          cleanText.includes(lastTextForSpeaker) &&
          cleanText.length > lastTextForSpeaker.length) {
        continue;
      }

      const key = `${cleanName}:${cleanText}`;

      if (!this.seenRows.has(key)) {
        this.seenRows.add(key);
        this.lastTextBySpeaker.set(speakerKey, cleanText);

        const timestamp = item.time || new Date().toLocaleTimeString();
        const logLine = `[${timestamp}] ${cleanName}: ${cleanText}`;

        logger.info(`TeamsAdapter(captionMonitor): ${logLine}`);

        try {
          fs.appendFileSync(this.filePath, logLine + '\n');
        } catch (fileErr) {
          logger.error(`TeamsAdapter(captionMonitor): File Append Error: ${fileErr.message}`);
        }
      }
    }
  }

  async handleMeetingEnd() {
    if (this.isShuttingDown) return;
    
    this.stopPolling();
    this.isMeetingActive = false;

    logger.info("TeamsAdapter(captionMonitor): [AUDIO] Initiating Audio Creation/Processing...");

    try {
        const footer = `\n==========================================\n` +
                       `TRANSCRIPT ENDED: ${new Date().toLocaleString()}\n` +
                       `==========================================`;
        fs.appendFileSync(this.filePath, footer);
        logger.info(`TeamsAdapter(captionMonitor): File Finalized: ${this.fileName}`);
    } catch (err) {
        logger.error(`TeamsAdapter(captionMonitor):Error finalizing file: ${err.message}`);
    }

    if (this.sessionId) {
      TranscriptModel.updateSessionEnd(this.sessionId)
        .then(() => logger.info(`TeamsAdapter(captionMonitor): Session end recorded for session ${this.sessionId}`))
        .catch(err => logger.error(`TeamsAdapter(captionMonitor): Error recording session end: ${err.message}`));
    }

    if (typeof this.onMeetingEnd === 'function') {
      try {
        await this.onMeetingEnd();
        return;
      } catch (err) {
        logger.error(`TeamsAdapter(captionMonitor): Meeting shutdown callback error: ${err.message}`);
      }
    }

    try {
        const browser = this.page.browser();
        await browser.close();
        logger.info("TeamsAdapter(captionMonitor): Bot successfully left the ended meeting.");
    } catch (e) {
        logger.error(`TeamsAdapter(captionMonitor): Browser close error: ${e.message}`);
    }
  }
}

module.exports = CaptionMonitor;