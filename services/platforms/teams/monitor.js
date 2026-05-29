const { logger } = require('../../../utils/logger');
const { exportBoth } = require('../../../utils/export');
const TranscriptModel = require('../../../models/transcriptModel');
const ParticipantTracker = require('./participantTracker');

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

async function getCurrentParticipantNames(page, botName) {
  try {
    const names = await page.evaluate((bot) => {
      const participants = [];
      const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
      const botName = normalize(bot).toLowerCase();

      const addName = (value) => {
        let cleanName = normalize(value)
          .replace(/\b(organizer|presenter|attendee|muted|unmuted|camera off|more options|you)\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

        cleanName = cleanName.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

        if (
          cleanName &&
          cleanName.length < 120 &&
          cleanName.toLowerCase() !== botName &&
          !participants.includes(cleanName)
        ) {
          participants.push(cleanName);
        }
      };

      const peopleButton = Array.from(document.querySelectorAll('button, [role="button"]'))
        .find(button => {
          const text = [
            button.getAttribute('aria-label'),
            button.getAttribute('title'),
            button.innerText
          ].filter(Boolean).join(' ').toLowerCase();

          return text.includes('people') ||
            text.includes('participants') ||
            text.includes('show participants');
        });

      if (peopleButton) {
        peopleButton.click();
      }

      const selectors = [
        '[data-tid*="participant"]',
        '[data-tid*="roster"]',
        '[id*="participant"]',
        '[class*="participant"]',
        '[class*="roster"]',
        '[aria-label*="participant"]',
        '[aria-label*="attendee"]',
        '[data-tid="calling-participant-stream"]',
        '[data-tid="video-stream"]'
      ];

      for (const selector of selectors) {
        document.querySelectorAll(selector).forEach(node => {
          const label = node.getAttribute('aria-label') ||
            node.getAttribute('title') ||
            node.innerText ||
            node.textContent;

          if (!label) return;

          const lines = normalize(label).split(/\n|,/).map(part => part.trim()).filter(Boolean);
          if (lines.length > 1) {
            lines.forEach(addName);
          } else {
            addName(label);
          }
        });

        if (participants.length > 0) {
          return participants;
        }
      }

      return participants;
    }, botName);

    return names;
  } catch (err) {
    logger.debug(`TeamsAdapter: Error extracting participant names: ${err.message}`);
    return [];
  }
}

async function monitorMeeting(page, meetingId, botName, sessionId) {
  logger.info('TeamsAdapter: MONITOR: Stay-Alive loop started');

  const participantTracker = new ParticipantTracker(meetingId, sessionId);
  let previousParticipants = [];
  let lastParticipantCheckTime = Date.now();
  const PARTICIPANT_CHECK_INTERVAL = 5000;

  let loopCount = 0;

  // try {
    while (true) {

      // 1. Page closed
      if (page.isClosed()) {
        logger.info("TeamsAdapter: EXIT: Page closed → Exporting");
        await exportMeetingTranscript(meetingId);
        break;
      }

      const url = page.url();

      // 2. Left Teams meeting
      if (!url.includes('teams.live.com')) {
        logger.info("TeamsAdapter: EXIT: Navigated away from Teams → Exporting");
        await exportMeetingTranscript(meetingId);
        break;
      }

      // 3. Detect meeting end / removal
      const meetingEnded = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();

        return (
          text.includes("you've been removed") ||
          text.includes("you've been removed from this meeting") ||
          text.includes("you were removed") ||
          text.includes("meeting has ended") ||
          text.includes("this meeting is full") ||
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

      const now = Date.now();
      if (now - lastParticipantCheckTime >= PARTICIPANT_CHECK_INTERVAL) {
        try {
          const currentParticipants = await getCurrentParticipantNames(page, botName);

          // for (const name of currentParticipants) {
            // if (!previousParticipants.includes(name)) {
              // await participantTracker.handleParticipantJoin(name);
            // }
          // }

          // for (const name of previousParticipants) {
            // if (!currentParticipants.includes(name)) {
              // await participantTracker.handleParticipantLeave(name);
            // }
          // }

          previousParticipants = [...currentParticipants];
          lastParticipantCheckTime = now;
        } catch (err) {
          logger.debug(`TeamsAdapter: Error in attendance tracking: ${err.message}`);
        }
      }

      // 5. Participant count (best effort)

      const participantCount = await page.evaluate(() => {
        // ✅ Strategy 1: People/participants panel badge count
        const selectors = [
          '[data-tid="roster-participant-count"]',
          '[data-tid="participant-count"]',
          '[aria-label*="participant"]',
          '[aria-label*="Participant"]',
          '[aria-label*="People"]',
        ];

        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            // Extract number from text like "5 participants" or just "5"
            const match = (el.innerText || el.getAttribute('aria-label') || '').match(/(\d+)/);
            if (match) return parseInt(match[1]);
          }
        }

        // ✅ Strategy 2: Count actual participant rows in the roster panel
        const rosterItems = document.querySelectorAll(
          '[data-tid="roster-participant"],' +
          '[data-tid="participant-item"],' +
          '[class*="participantItem"],' +
          '[class*="roster-item"]'
        );
        if (rosterItems.length > 0) return rosterItems.length;

        // ✅ Strategy 3: People button aria-label often contains count
        // e.g. aria-label="People (5)"
        const peopleBtn = document.querySelector('[aria-label*="People"]');
        if (peopleBtn) {
          const match = (peopleBtn.getAttribute('aria-label') || '').match(/\((\d+)\)/);
          if (match) return parseInt(match[1]);
        }

        return -1;
      });
      
      // const participantCount = await page.evaluate(() => {
      //   const text = document.body.innerText;
      //   const match = text.match(/\b(\d+)\b/);

      //   if (match) {
      //     const num = parseInt(match[1]);
      //     if (!isNaN(num) && num < 500) return num;
      //   }

      //   return -1;
      // });

      // if (participantCount === 1) {
      //   logger.info("TeamsAdapter: EXIT: Only bot left → Exporting");
      //   await exportMeetingTranscript(meetingId);
      //   break;
      // }

      logger.debug(`TeamsAdapter: Monitor: participants ≈ ${participantCount}`);

      // 6. Loop delay
      await new Promise(r => setTimeout(r, 10000));

      loopCount++;
      if (loopCount % 6 === 0) {
        logger.info(`TeamsAdapter: MONITOR: Alive ${loopCount / 6}m`);
      }
    }

  // } catch (error) {
  //   logger.error(`TeamsAdapter: MONITOR ERROR: ${error.message}`);
  // }

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
