const { logger } = require('../../../utils/logger');
const { exportBoth } = require('../../../utils/export');
const TranscriptModel = require('../../../models/transcriptModel');
const ParticipantTracker = require('./participantTracker');

let keepAliveInterval = null;

// ─────────────────────────────────────────────
// KEEP ALIVE
// ─────────────────────────────────────────────
async function startKeepAlive(page) {
  keepAliveInterval = setInterval(async () => {
    try {
      if (!page.isClosed()) {
        await page.mouse.move(Math.random() * 300, Math.random() * 300);
      }
    } catch (e) {}
  }, 20000); // ✅ 20s is enough — 2s was hammering the page 30x/min
}

// ─────────────────────────────────────────────
// PARTICIPANT NAMES
// ✅ FIX: People button click moved OUTSIDE evaluate()
//    so DOM has time to render before querying
// ─────────────────────────────────────────────
async function getCurrentParticipantNames(page, botName) {
  try {
    // Step 1: Click People button outside evaluate so it actually opens
    await page.evaluate(() => {
      const peopleBtn = Array.from(document.querySelectorAll('button, [role="button"]'))
        .find(b => {
          const text = (
            b.getAttribute('aria-label') ||
            b.getAttribute('title') ||
            b.innerText ||
            ''
          ).toLowerCase();
          return (
            text.includes('people') ||
            text.includes('participants') ||
            text.includes('show participants')
          );
        });
      if (peopleBtn) peopleBtn.click();
    });

    // Step 2: Wait for roster panel to actually render
    await new Promise(r => setTimeout(r, 1500));

    // Step 3: Now query the DOM
    const names = await page.evaluate((bot) => {
      const participants = [];
      const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
      const botLower = normalize(bot).toLowerCase();

      const addName = (value) => {
        let cleanName = normalize(value)
          .replace(/\b(organizer|presenter|attendee|muted|unmuted|camera off|more options|you)\b/gi, '')
          .replace(/\s*\([^)]*\)\s*/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (
          cleanName &&
          cleanName.length < 120 &&
          cleanName.toLowerCase() !== botLower &&
          !participants.includes(cleanName)
        ) {
          participants.push(cleanName);
        }
      };

      const selectors = [
        '[data-tid*="participant"]',
        '[data-tid*="roster"]',
        '[id*="participant"]',
        '[class*="participant"]',
        '[class*="roster"]',
        '[aria-label*="participant"]',
        '[aria-label*="attendee"]',
        '[data-tid="calling-participant-stream"]',
        '[data-tid="video-stream"]',
      ];

      for (const selector of selectors) {
        document.querySelectorAll(selector).forEach(node => {
          const label =
            node.getAttribute('aria-label') ||
            node.getAttribute('title') ||
            node.innerText ||
            node.textContent;

          if (!label) return;

          normalize(label)
            .split(/\n|,/)
            .map(p => p.trim())
            .filter(Boolean)
            .forEach(addName);
        });

        if (participants.length > 0) return participants;
      }

      return participants;
    }, botName);

    return names;
  } catch (err) {
    logger.debug(`TeamsAdapter: Error extracting participant names: ${err.message}`);
    return [];
  }
}

// ─────────────────────────────────────────────
// PARTICIPANT COUNT
// ✅ Passive read — never clicks People button
//    so it doesn't interfere with captions UI
// ─────────────────────────────────────────────
async function getParticipantCount(page) {
  try {
    return await page.evaluate(() => {
      // Strategy 1: dedicated count element
      const countSelectors = [
        '[data-tid="roster-participant-count"]',
        '[data-tid="participant-count"]',
      ];
      for (const sel of countSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const match = (el.innerText || '').match(/(\d+)/);
          if (match) return parseInt(match[1]);
        }
      }

      // Strategy 2: People button aria-label e.g. "People (5)"
      const peopleBtn = document.querySelector(
        '[aria-label="People"], [aria-label*="People ("]'
      );
      if (peopleBtn) {
        const match = (peopleBtn.getAttribute('aria-label') || '').match(/\((\d+)\)/);
        if (match) return parseInt(match[1]);
      }

      // Strategy 3: count visible roster rows if panel already open
      const rosterRows = document.querySelectorAll(
        '[data-tid="roster-participant"], [data-tid="participant-item"]'
      );
      if (rosterRows.length > 0) return rosterRows.length;

      return -1;
    });
  } catch (e) {
    return -1;
  }
}

// ─────────────────────────────────────────────
// MEETING END DETECTION
// ─────────────────────────────────────────────
async function isMeetingEnded(page) {
  try {
    return await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return (
        text.includes("you've been removed") ||
        text.includes("you've been removed from this meeting") ||
        text.includes("you were removed") ||
        text.includes("meeting has ended") ||
        text.includes("this meeting has ended") ||
        text.includes("this meeting is full") ||
        text.includes("call ended") ||
        text.includes("meeting ended by host")
      );
    });
  } catch (e) {
    return false;
  }
}

async function isInLobby(page) {
  try {
    return await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return (
        text.includes("waiting in the lobby") ||
        text.includes("we'll let people in soon") ||
        text.includes("someone will admit you") ||
        text.includes("someone will let you in shortly")
      );
    });
  } catch (e) {
    return false;
  }
}

// ✅ Covers both Teams Personal and Teams Enterprise
function isTeamsUrl(url) {
  return (
    url.includes('teams.live.com') ||
    url.includes('teams.microsoft.com') ||
    url.includes('microsoft.com')
  );
}

// ─────────────────────────────────────────────
// MAIN MONITOR LOOP
// ─────────────────────────────────────────────
async function monitorMeeting(page, meetingId, botName, sessionId) {
  logger.info('TeamsAdapter: MONITOR: Stay-Alive loop started');

  const participantTracker = new ParticipantTracker(meetingId, sessionId);
  let previousParticipants = [];
  let lastParticipantCheckTime = Date.now();

  // ✅ 30s — was 5s which caused People panel to flicker open/closed
  //    constantly and interfere with caption rendering
  const PARTICIPANT_CHECK_INTERVAL = 30000;

  // ✅ Track consecutive "only bot left" readings before exiting
  //    Prevents false exits when count briefly reads 1 during page re-render
  let soloCount = 0;
  const SOLO_EXIT_THRESHOLD = 3; // must read 1 three times in a row (~30s)

  let loopCount = 0;

  while (true) {
    try {
      // ── 1. Page closed ──────────────────────────────────────
      if (page.isClosed()) {
        logger.info('TeamsAdapter: EXIT: Page closed → Exporting');
        await exportMeetingTranscript(meetingId);
        break;
      }

      // ── 2. URL left Teams ───────────────────────────────────
      const url = page.url();
      if (!isTeamsUrl(url)) {
        logger.info(`TeamsAdapter: EXIT: Navigated away (${url}) → Exporting`);
        await exportMeetingTranscript(meetingId);
        break;
      }

      // ── 3. Meeting ended by host ────────────────────────────
      if (await isMeetingEnded(page)) {
        logger.info('TeamsAdapter: EXIT: Meeting ended → Exporting');
        await exportMeetingTranscript(meetingId);
        break;
      }

      // ── 4. Lobby detection ──────────────────────────────────
      if (await isInLobby(page)) {
        logger.info('TeamsAdapter: Still in lobby — waiting...');
        await new Promise(r => setTimeout(r, 10000));
        continue;
      }

      // ── 5. Participant count (passive — no panel click) ─────
      const participantCount = await getParticipantCount(page);
      logger.debug(`TeamsAdapter: Monitor: participants ≈ ${participantCount}`);

      // ✅ Only exit if count reads 1 consistently (not a flicker)
      if (participantCount === 1) {
        soloCount++;
        logger.info(`TeamsAdapter: Only bot detected (${soloCount}/${SOLO_EXIT_THRESHOLD}) — confirming...`);
        if (soloCount >= SOLO_EXIT_THRESHOLD) {
          logger.info('TeamsAdapter: EXIT: Only bot left confirmed → Exporting');
          await exportMeetingTranscript(meetingId);
          break;
        }
      } else {
        // Reset counter if other participants are back
        soloCount = 0;
      }

      // ── 6. Participant join/leave tracking (every 30s) ──────
      const now = Date.now();
      if (now - lastParticipantCheckTime >= PARTICIPANT_CHECK_INTERVAL) {
        try {
          const currentParticipants = await getCurrentParticipantNames(page, botName);

          // ✅ Detect joins
          for (const name of currentParticipants) {
            if (!previousParticipants.includes(name)) {
              logger.info(`TeamsAdapter: JOINED: ${name}`);
              await participantTracker.handleParticipantJoin(name);
            }
          }

          // ✅ Detect leaves
          for (const name of previousParticipants) {
            if (!currentParticipants.includes(name)) {
              logger.info(`TeamsAdapter: LEFT: ${name}`);
              await participantTracker.handleParticipantLeave(name);
            }
          }

          logger.debug(`TeamsAdapter: Participants: [${currentParticipants.join(', ')}]`);
          previousParticipants = [...currentParticipants];
          lastParticipantCheckTime = Date.now();
        } catch (err) {
          logger.debug(`TeamsAdapter: Attendance tracking error: ${err.message}`);
        }
      }

      // ── 7. Loop delay ───────────────────────────────────────
      await new Promise(r => setTimeout(r, 10000));

      loopCount++;
      if (loopCount % 6 === 0) {
        logger.info(`TeamsAdapter: MONITOR: Alive — ${loopCount / 6} min`);
      }

    } catch (error) {
      // ✅ Per-iteration catch — one bad evaluate won't kill the whole loop
      if (
        error.message.includes('Target closed') ||
        error.message.includes('Session closed') ||
        error.message.includes('Execution context was destroyed')
      ) {
        logger.info('TeamsAdapter: EXIT: Browser/page closed unexpectedly → Exporting');
        await exportMeetingTranscript(meetingId);
        break;
      }
      logger.error(`TeamsAdapter: MONITOR ERROR (continuing): ${error.message}`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  if (keepAliveInterval) clearInterval(keepAliveInterval);
  logger.info('TeamsAdapter: MEETING ENDED: Full transcript exported');
}

// ─────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────
async function exportMeetingTranscript(meetingId) {
  try {
    const transcripts = await TranscriptModel.getTranscriptsByMeeting(meetingId);
    logger.info(`TeamsAdapter: EXPORT: ${meetingId} — ${transcripts.length} captions`);
    const exports = await exportBoth(meetingId, 'storage');
    logger.info(`TeamsAdapter: SAVED: ${exports.json}, ${exports.txt}`);
  } catch (err) {
    logger.error('TeamsAdapter: Export fail:', err);
  }
}

module.exports = {
  startKeepAlive,
  monitorMeeting,
  exportMeetingTranscript,
};