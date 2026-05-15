const { logger } = require('../../../utils/logger');
const { exportBoth } = require('../../../utils/export');
const TranscriptModel = require('../../../models/transcriptModel');
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
  logger.info('GoogleMeetAdapter(monitor): MONITOR: Stay-Alive loop started');

  let loopCount = 0;

  try {
    while (true) {
      // 1. Page closed
      if (page.isClosed()) {
        logger.info("GoogleMeetAdapter(monitor): EXIT: Page closed → Exporting final transcript");
        await exportMeetingTranscript(meetingId);
        break;
      }

      const url = page.url();

      // 2. Left Meet page
      if (!url.includes('meet.google.com')) {
        logger.info("GoogleMeetAdapter(monitor): EXIT: Navigated away from Meet → Exporting");
        await exportMeetingTranscript(meetingId);
        break;
      }

      // 3. Detect meeting end / removal
      const meetingEnded = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();

        return (
          text.includes("you left the meeting") ||
          text.includes("meeting ended") ||
          text.includes("call ended") ||
          text.includes("removed from the meeting") ||
          text.includes("you've been removed") ||
          text.includes("host ended the meeting")
        );
      });

      if (meetingEnded) {
        logger.info("GoogleMeetAdapter(monitor): EXIT: Meeting end detected → Exporting");
        await exportMeetingTranscript(meetingId);
        break;
      }

      // 4. Waiting room detection
      const waitingRoom = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return (
          text.includes("ask to join") ||
          text.includes("waiting to be admitted") ||
          text.includes("someone will let you in")
        );
      });

      if (waitingRoom) {
        logger.info("GoogleMeetAdapter(monitor): Waiting room / lobby detected");
      }

      // 5. Participant detection (Improved)
      const participantCount = await page.evaluate(() => {
        // Method A: Check the "People" icon aria-label (Most reliable)
        const peopleBtn = document.querySelector('button[aria-label*="People"], [data-tooltip*="Show everyone"], [aria-label*="Show everyone"]');
        if (peopleBtn) {
          const label = peopleBtn.getAttribute('aria-label') || peopleBtn.getAttribute('data-tooltip') || "";
          const match = label.match(/\d+/); // Extracts numbers from "Show everyone (1)"
          if (match) return parseInt(match[0]);
        }

        // Method B: Count video/avatar tiles
        // Google Meet usually uses [data-item-id] for participant tiles
        const tiles = document.querySelectorAll('[data-allocation-index]');
        if (tiles.length > 0) return tiles.length;

        return -1; 
      });

      // EXIT CONDITION: If count is 1 (just the bot) or if detection fails but 
      // we see the "No one else is here" message.
      const isAloneMessage = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        return bodyText.includes("You're the only one here") || bodyText.includes("No one else is in the call");
      });

      if (participantCount === 1 || isAloneMessage) {
        logger.info("GoogleMeetAdapter(monitor): EXIT: Bot is alone → Exporting and Closing.");
        await exportMeetingTranscript(meetingId);
        await page.close();
        break; 
      }

      logger.debug(`GoogleMeetAdapter(monitor): Monitor: participants ≈ ${participantCount}`);

      // 6. Sleep loop
      await new Promise(r => setTimeout(r, 10000));

      loopCount++;
      if (loopCount % 6 === 0) {
        logger.info(`GoogleMeetAdapter(monitor): MONITOR: Alive ${loopCount / 6}m`);
      }
    }

  } catch (error) {
    logger.error(`GoogleMeetAdapter(monitor): MONITOR ERROR: ${error.message}`);
  }

  if (keepAliveInterval) clearInterval(keepAliveInterval);

  logger.info("GoogleMeetAdapter(monitor): MEETING ENDED: Full transcript exported to storage/");
}

async function exportMeetingTranscript(meetingId) {
  try {
    const transcripts = await TranscriptModel.getTranscriptsByMeeting(meetingId);

    logger.info(`GoogleMeetAdapter(monitor): EXPORT: ${meetingId} - ${transcripts.length} captions detected`);

    const exports = await exportBoth(meetingId, 'storage');

    logger.info(`GoogleMeetAdapter(monitor): SAVED to storage/: ${exports.json}, ${exports.txt}`);
  } catch (err) {
    logger.error('GoogleMeetAdapter(monitor): Export fail:', err);
  }
}

module.exports = {
  startKeepAlive,
  monitorMeeting,
  exportMeetingTranscript
};