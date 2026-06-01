/**
 * root/services/platforms/google-meet/captionMonitor.js
 *
 */
const TranscriptModel = require('../../../models/transcriptModel.js');
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

    const timestamp =
      now.toISOString().split('T')[0] +
      '_' +
      now.getHours().toString().padStart(2, '0') +
      '-' +
      now.getMinutes().toString().padStart(2, '0');

    this.fileName =
      `TRANS_${this.meetingId}_Sess${this.sessionId}_${timestamp}.txt`;

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

      if (this.sessionId) {

        TranscriptModel
          .saveTranscriptFile(
            this.sessionId,
            this.fileName
          )
          .catch(err =>
            logger.error(
              `GoogleMeetAdapter(captionMonitor): Error saving transcript file metadata: ${err.message}`
            )
          );
      }

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
