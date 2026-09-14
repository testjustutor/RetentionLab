/**
 * services/platforms/google-meet/captionMonitor.js
 *
 */
const TranscriptModel = require('../../../models/transcripts/transcriptModel.js');
const fs = require('fs');
const path = require('path');
const { logger } = require('../../../utils/logger');

class CaptionMonitor {

  constructor(
    sessionId,
    page,
    meetingId,
    platform,
    joinerInstance,
    onMeetingEnd
  ) {

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
    this.lastSavedText = "";

    const now = new Date();

    // FIX: was `.toISOString().split('T')[0]` (UTC date) glued to
    // `.getHours()/.getMinutes()` (LOCAL time) - near local midnight this
    // could stamp a file with the UTC date but a local time that actually
    // belongs to the NEXT day. All components below now come from the same
    // LOCAL clock, so the date and time in the filename always agree.
    const pad = (n) => n.toString().padStart(2, '0');
    const timestamp =
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
      '_' +
      pad(now.getHours()) +
      '-' +
      pad(now.getMinutes());

    this.fileName =
      `TRANS_Meet${this.meetingId}_Sess${this.sessionId}_${timestamp}.txt`;

    this.dirPath = path.resolve(
      __dirname,
      '../../../storage/transcripts'
    );

    this.filePath = path.join(
      this.dirPath,
      this.fileName
    );

    this.initStorage();
  }

  initStorage() {

    try {

      if (!fs.existsSync(this.dirPath)) {

        fs.mkdirSync(this.dirPath, {
          recursive: true
        });
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

      logger.info(
        `GoogleMeetAdapter(captionMonitor): File Created: storage/transcripts/${this.fileName}`
      );

      // NOTE: meeting_sessions.transcript_file_name is intentionally NOT written
      // here — this file only has a header at this point, no real transcript yet.
      // Google Meet's actual caption capture happens in transcriptEngine.js
      // (via this joiner), which links the file to meeting_sessions the first
      // time a real caption line is captured, so the row only reflects a real
      // transcript rather than an empty placeholder.

    } catch (err) {

      logger.error(
        `GoogleMeetAdapter(captionMonitor): Failed to initialize transcript file: ${err.message}`
      );
    }
  }

  startPolling() {

    if (this.poller) {
      clearInterval(this.poller);
    }

    this.poller = setInterval(
      () => this.pollCaptions(),
      3000
    );
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

    if (this.isShuttingDown) {
      return;
    }

    if (this.page.isClosed()) {

      logger.info(
        'GoogleMeet(captionMonitor): Page closed detected.'
      );

      await this.handleMeetingEnd();
      return;
    }

    try {

      const url = this.page.url();

      const pageText =
        await this.page.evaluate(() =>
          document.body.innerText.toLowerCase()
        );

      const endPhrases =
        CaptionMonitor.getMeetingEndPhrases();

      const hasEndPhrase =
        endPhrases.some(
          phrase => pageText.includes(phrase)
        );

      const hasActiveMeetingPage =
        url.includes('meet.google.com');

      if (
        hasEndPhrase ||
        !hasActiveMeetingPage
      ) {

        logger.info(
          'GoogleMeet(captionMonitor): Meeting end detected.'
        );

        await this.handleMeetingEnd();
        return;
      }

    } catch (e) {

      if (
        !e.message.includes('Target closed')
      ) {

        logger.error(
          `GoogleMeet(captionMonitor): ${e.message}`
        );
      }
    }
  }

  async handleMeetingEnd() {

    if (this.isShuttingDown) {
      return;
    }

    this.stopPolling();

    this.isMeetingActive = false;

    logger.info(
      "GoogleMeetAdapter(captionMonitor): [AUDIO] Initiating Audio Creation/Processing..."
    );

    if (this.sessionId) {

      TranscriptModel
        .updateSessionEnd(this.sessionId)
        .then(() =>
          logger.info(
            `GoogleMeetAdapter(captionMonitor): Session end recorded for session ${this.sessionId}`
          )
        )
        .catch(err =>
          logger.error(
            `GoogleMeetAdapter(captionMonitor): Error recording session end: ${err.message}`
          )
        );
    }

    if (
      typeof this.onMeetingEnd === 'function'
    ) {

      try {

        await this.onMeetingEnd();
        return;

      } catch (err) {

        logger.error(
          `GoogleMeetAdapter(captionMonitor): Meeting shutdown callback error: ${err.message}`
        );
      }
    }

    try {

      const browser =
        this.page.browser();

      await browser.close();

      logger.info(
        "GoogleMeetAdapter(captionMonitor): Bot successfully left the ended meeting."
      );

    } catch (e) {

      logger.error(
        `GoogleMeetAdapter(captionMonitor): Browser close error: ${e.message}`
      );
    }
  }
}

module.exports = CaptionMonitor;
