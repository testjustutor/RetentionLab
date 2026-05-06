const { logger } = require('../../../utils/logger');
const { exportBoth } = require('../../../utils/export');
const TranscriptModel = require('../../../models/transcriptModel');

let keepAliveInterval = null;

async function startKeepAlive(page) {
  keepAliveInterval = setInterval(async () => {
    try {
      if (!page.isClosed()) {
        await page.mouse.move(Math.random() * 300, Math.random() * 300);
      }
    } catch (e) {}
  }, 2000);
}

async function monitorMeeting(page, meetingId) {
  logger.info('TeamsAdapter: MONITOR: Stay-Alive loop started');

  let loopCount = 0;

  try {
    while (true) {

      // 1. Page closed
      if (page.isClosed()) {
        logger.info("TeamsAdapter: EXIT: Page closed → Exporting");
        await exportMeetingTranscript(meetingId);
        break;
      }

      const url = page.url();

      // 2. Left Teams meeting
      if (!url.includes('teams.microsoft.com')) {
        logger.info("TeamsAdapter: EXIT: Navigated away from Teams → Exporting");
        await exportMeetingTranscript(meetingId);
        break;
      }

      // 3. Detect meeting end / removal
      const meetingEnded = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();

        return (
          text.includes("you've been removed") ||
          text.includes("you were removed") ||
          text.includes("meeting has ended") ||
          text.includes("call ended") ||
          text.includes("this meeting has ended")
        );
      });

      if (meetingEnded) {
        logger.info("TeamsAdapter: EXIT: Meeting ended detected → Exporting");
        await exportMeetingTranscript(meetingId);
        break;
      }

      // 4. Lobby detection
      const waitingRoom = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return (
          text.includes("waiting in the lobby") ||
          text.includes("we'll let people in soon") ||
          text.includes("someone will admit you")
        );
      });

      if (waitingRoom) {
        logger.info("TeamsAdapter: Lobby detected");
      }

      // 5. Participant count (best effort)
      const participantCount = await page.evaluate(() => {
        // Teams DOM is dynamic → fallback to text parsing
        const text = document.body.innerText;
        const match = text.match(/\b(\d+)\b/);

        if (match) {
          const num = parseInt(match[1]);
          if (!isNaN(num) && num < 500) return num;
        }

        return -1;
      });

      if (participantCount === 1) {
        logger.info("TeamsAdapter: EXIT: Only bot left → Exporting");
        await exportMeetingTranscript(meetingId);
        break;
      }

      logger.debug(`TeamsAdapter: Monitor: participants ≈ ${participantCount}`);

      // 6. Loop delay
      await new Promise(r => setTimeout(r, 10000));

      loopCount++;
      if (loopCount % 6 === 0) {
        logger.info(`TeamsAdapter: MONITOR: Alive ${loopCount / 6}m`);
      }
    }

  } catch (error) {
    logger.error(`TeamsAdapter: MONITOR ERROR: ${error.message}`);
  }

  if (keepAliveInterval) clearInterval(keepAliveInterval);

  logger.info("TeamsAdapter: MEETING ENDED: Full transcript exported");
}

async function exportMeetingTranscript(meetingId) {
  try {
    const transcripts = await TranscriptModel.getTranscriptsByMeeting(meetingId);

    logger.info(`TeamsAdapter: EXPORT: ${meetingId} - ${transcripts.length} captions`);

    const exports = await exportBoth(meetingId, 'storage');

    logger.info(`TeamsAdapter: SAVED: ${exports.json}, ${exports.txt}`);
  } catch (err) {
    logger.error('TeamsAdapter: Export fail:', err);
  }
}

module.exports = {
  startKeepAlive,
  monitorMeeting,
  exportMeetingTranscript
};