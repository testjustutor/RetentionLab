const { logger } = require('../utils/logger');
const { exportBoth } = require('../utils/export');
const TranscriptModel = require('../models/transcriptModel');
const path = require('path');

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
  logger.info('DefaultAdapter(monitor): MONITOR: Stay-Alive loop started');

  let loopCount = 0;
  const endPhrases = [
    "meeting has been ended",
    "meeting has ended",
    "the meeting has ended",
    "host has ended",
    "meeting is over",
    "cannot continue",
    "meeting has expired",
    "you have been removed",
    "removed by the host"
  ];

  try {
    while (true) {
      if (page.isClosed()) {
        logger.info("DefaultAdapter(monitor): EXIT: Page closed → Exporting final transcript");
        await exportMeetingTranscript(meetingId);
        break;
      }

      const url = page.url();
      if (!url.includes('/wc/') && !url.includes('/j/')) {
        logger.info("DefaultAdapter(monitor): EXIT: Redirected away from Zoom → Exporting");
        await exportMeetingTranscript(meetingId);
        break;
      }

      const frame = page.frames().find(f => f.url().includes("zoom.us"));
      if (!frame) {
        logger.info("DefaultAdapter(monitor): EXIT: Zoom iframe gone → Export");
        await exportMeetingTranscript(meetingId);
        break;
      }

      const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());
      if (pageText.includes('meeting ended by host') || pageText.includes('host ended')) {
        logger.info("DefaultAdapter(monitor): HOST ENDED MEETING → Export now");
        await exportMeetingTranscript(meetingId);
        break;
      }

      const meetingEnded = await frame.evaluate((phrases) => {
        const bodyText = document.body.innerText.toLowerCase();
        return phrases.some(p => bodyText.includes(p));
      }, endPhrases);

      if (meetingEnded) {
        logger.info("DefaultAdapter(monitor): EXIT: Meeting end text detected → Exporting final transcript");
        await exportMeetingTranscript(meetingId);
        break;
      }

      const participantCount = await frame.evaluate(() => {
        const nodes = document.querySelectorAll('[class*="participant"],[class*="Participant"],[class*="username"],.username,.display_name');
        return nodes.length;
      });

      if (participantCount === 1) {
        logger.info("DefaultAdapter(monitor): EXIT: Only bot left (1 total) → Exporting");
        await exportMeetingTranscript(meetingId);
        break;
      }
      logger.debug(`DefaultAdapter(monitor): Monitor: ${participantCount} participants active`);

      const waitingRoom = await frame.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return text.includes("please wait for the host") || text.includes("waiting for the host");
      });

      if (waitingRoom) {
        logger.info("DefaultAdapter(monitor): Waiting room detected");
      }

      await new Promise(r => setTimeout(r, 10000));
      loopCount++;
      if (loopCount % 6 === 0) {
        logger.info(`DefaultAdapter(monitor): MONITOR: Alive ${loopCount / 6}m`);
      }
    }
  } catch (error) {
    logger.error(`DefaultAdapter(monitor): MONITOR: ${error.message}`);
  }

  if (keepAliveInterval) clearInterval(keepAliveInterval);
  logger.info("DefaultAdapter(monitor): MEETING ENDED: Full transcript exported to storage/");
}

async function exportMeetingTranscript(meetingId) {
  try {
    const transcripts = await TranscriptModel.getTranscriptsByMeeting(meetingId);
    logger.info(`DefaultAdapter(monitor): EXPORT: ${meetingId} - ${transcripts.length} captions detected`);
    const exports = await exportBoth(meetingId, 'storage');
    logger.info(`DefaultAdapter(monitor): SAVED to storage/: ${exports.json}, ${exports.txt}`);
  } catch (err) {
    logger.error('DefaultAdapter(monitor): Export fail:', err);
  }
}

module.exports = {
  startKeepAlive,
  monitorMeeting,
  exportMeetingTranscript
};
