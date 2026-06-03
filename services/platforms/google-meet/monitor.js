/**
 * root/services/platforms/google-meet/monitor.js
 *
 */
const { logger } = require('../../../utils/logger');
const { exportBoth } = require('../../../utils/export');
const TranscriptModel = require('../../../models/transcriptModel');
const ParticipantTracker = require('./participantTracker');
const path = require('path');

let keepAliveInterval = null;

async function getParticipantCountDebug(page) {
  const peopleBtnSelectors = [
    'button[aria-label*="People"]',
    'button[aria-label="People"]',
    '[data-tooltip*="Show everyone"]',
    '[aria-label*="Show everyone"]'
  ];

  let clickedPeople = false;
  let clickedSelector = null;

  for (const sel of peopleBtnSelectors) {
    try {
      const handle = await page.$(sel);
      if (handle) {
        await handle.click().catch(() => {});
        clickedPeople = true;
        clickedSelector = sel;
        break;
      }
    } catch (_) {}
  }

  // Give the panel a moment to render after the click.
  if (clickedPeople) {
    await new Promise(r => setTimeout(r, 600));
  }

  const info = await page.evaluate(() => {
    const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim();

    const peopleBtn = document.querySelector(
      'button[aria-label*="People"], button[aria-label="People"], [data-tooltip*="Show everyone"], [aria-label*="Show everyone"]'
    );

    const peopleLabel = peopleBtn
      ? normalize(
          peopleBtn.getAttribute('aria-label') ||
          peopleBtn.getAttribute('data-tooltip') ||
          peopleBtn.getAttribute('title') ||
          peopleBtn.innerText
        )
      : '';

    let countFromLabel = -1;
    const m = peopleLabel.match(/\((\d+)\)/) || peopleLabel.match(/\b(\d+)\b/);
    if (m) countFromLabel = parseInt(m[1] || m[0], 10);

    // People panel roster count: try several stable-ish patterns.
    const rosterCandidates = [
      // Meet often renders a list of participants as listitems when People panel is open.
      document.querySelectorAll('[role="listitem"][data-participant-id]').length,
      document.querySelectorAll('[role="listitem"]').length,
      document.querySelectorAll('[data-participant-id]').length,
      document.querySelectorAll('[data-requested-participant-id]').length
    ].filter(n => n && n > 0);

    const rosterCount = rosterCandidates.length ? Math.max(...rosterCandidates) : -1;

    // Tile count fallback (less reliable for large calls / layout changes).
    const tileCount = document.querySelectorAll('[data-allocation-index]').length || -1;

    // Prefer roster count (if we managed to open panel), then label, then tiles.
    const participantCount =
      rosterCount > 0 ? rosterCount :
      countFromLabel > 0 ? countFromLabel :
      tileCount > 0 ? tileCount :
      -1;

    return {
      peopleLabel,
      countFromLabel,
      rosterCount,
      tileCount,
      participantCount
    };
  });

  return {
    clickedPeople,
    clickedSelector,
    ...info
  };
}

async function startKeepAlive(page) {
  keepAliveInterval = setInterval(async () => {
    try {
      if (!page.isClosed()) {
        await page.mouse.move(Math.random() * 300, Math.random() * 300);
      }
    } catch (e) {}
  }, 2000);
}

/**
 * Extract current participant names from Google Meet
 * Used for attendance tracking
 */
async function getCurrentParticipantNames(page) {
  try {
    const names = await page.evaluate(() => {
      const participants = [];
      
      // Strategy 1: Extract from roster items when people panel is visible
      const rosterItems = document.querySelectorAll('[role="listitem"]');
      if (rosterItems.length > 0) {
        rosterItems.forEach(item => {
          let name = null;
          
          // Try to get name from data attributes
          if (item.hasAttribute('data-name')) {
            name = item.getAttribute('data-name');
          }
          
          // Try aria-label
          if (!name) {
            name = item.getAttribute('aria-label');
          }
          
          // Try text content
          if (!name) {
            const text = item.innerText || item.textContent;
            if (text) {
              name = text.split('\n')[0];
            }
          }
          
          if (name && name.trim()) {
            const cleanName = name.trim().replace(/\s+/g, ' ');
            if (!participants.includes(cleanName) && cleanName.length < 200) {
              participants.push(cleanName);
            }
          }
        });
      }
      
      // Strategy 2: Extract from video tiles
      if (participants.length === 0) {
        const videoTiles = document.querySelectorAll('[data-participant-id], [data-allocation-index]');
        videoTiles.forEach(tile => {
          const label = tile.getAttribute('aria-label') || tile.getAttribute('data-name') || tile.title;
          if (label && label.trim()) {
            const cleanName = label.trim().replace(/\s+/g, ' ');
            if (!participants.includes(cleanName) && cleanName.length < 200) {
              participants.push(cleanName);
            }
          }
        });
      }
      
      return participants;
    });
    
    return names;
  } catch (err) {
    logger.debug('GoogleMeetAdapter(monitor): Error extracting participant names:', err.message);
    return [];
  }
}

async function monitorMeeting(page, meetingId, botName, sessionId, participantTracker) {
  logger.info('GoogleMeetAdapter(monitor): MONITOR: Stay-Alive loop started');

  const tracker = participantTracker || new ParticipantTracker(meetingId, sessionId);
  let previousParticipants = [];
  let lastParticipantCheckTime = Date.now();
  const PARTICIPANT_CHECK_INTERVAL = 5000; // Check every 5 seconds

  let loopCount = 0;
  const startedAt = Date.now();
  let aloneSinceMs = null;
  const ALONE_GRACE_MS = 10000;
  const ALONE_SUSTAIN_MS = 10000;
  let lastLeaveSignalAt = 0;

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

      // 4a. ATTENDANCE TRACKING: Check for participant changes
      const now = Date.now();
      if (now - lastParticipantCheckTime >= PARTICIPANT_CHECK_INTERVAL) {
        try {
          const currentParticipants = await getCurrentParticipantNames(page);
          
          // Detect joins (new participants)
          for (const name of currentParticipants) {
            if (!previousParticipants.includes(name)) {
              await tracker.handleParticipantJoin(name);
            }
          }
          
          // Detect leaves (participants no longer in list)
          for (const name of previousParticipants) {
            if (!currentParticipants.includes(name)) {
              await tracker.handleParticipantLeave(name);
            }
          }
          
          previousParticipants = [...currentParticipants];
          lastParticipantCheckTime = now;
        } catch (err) {
          logger.debug('GoogleMeetAdapter(monitor): Error in attendance tracking:', err.message);
        }
      }

      // 5. Leave-signal detection:
      // Only run participant-count checks after we see a "left the meeting" message in the UI/captions.
      const leaveSignal = await page.evaluate(() => {
        const text = (document.body.innerText || '').toLowerCase();
        return text.includes('has left the meeting') || text.includes('left the meeting');
      });

      // EXIT CONDITION: If count is 1 (just the bot) or if detection fails but 
      // we see the "No one else is here" message.
      const isAloneMessage = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        return bodyText.includes("You're the only one here") || bodyText.includes("No one else is in the call");
      });

      if (!leaveSignal) {
        // No leave signal: skip participant counting to avoid noisy/unstable detection.
        await new Promise(r => setTimeout(r, 10000));
        loopCount++;
        if (loopCount % 6 === 0) {
          logger.info(`GoogleMeetAdapter(monitor): MONITOR: Alive ${loopCount / 6}m`);
        }
        continue;
      }

      if (Date.now() - lastLeaveSignalAt > 10000) {
        lastLeaveSignalAt = Date.now();
        logger.info("GoogleMeetAdapter(monitor): LEAVE_SIGNAL detected; running participant count check...");
      }

      const pc = await getParticipantCountDebug(page);
      const participantCount = pc.participantCount;

      logger.info(
        `GoogleMeetAdapter(monitor): ALONE_CHECK: participants=${participantCount}, aloneMsg=${isAloneMessage}, ` +
        `clickedPeople=${pc.clickedPeople}, clickedSelector=${JSON.stringify(pc.clickedSelector)}, ` +
        `peopleLabel=${JSON.stringify(pc.peopleLabel)}, labelCount=${pc.countFromLabel}, rosterCount=${pc.rosterCount}, tileCount=${pc.tileCount}, ` +
        `elapsedMs=${Date.now() - startedAt}`
      );

      // Only act on a confident "alone" signal (count == 1 or explicit message).
      if (participantCount === 1 || isAloneMessage) {
        // Grace period right after join: avoid exiting while others are still connecting.
        const elapsedMs = Date.now() - startedAt;
        if (elapsedMs < ALONE_GRACE_MS) {
          logger.info("GoogleMeetAdapter(monitor): Bot appears alone during grace period; waiting...");
        } else {
          if (aloneSinceMs === null) aloneSinceMs = Date.now();
          const aloneForMs = Date.now() - aloneSinceMs;

          // Require sustained "alone" before exiting.
          if (aloneForMs >= ALONE_SUSTAIN_MS) {
            logger.info("GoogleMeetAdapter(monitor): EXIT: Bot alone sustained -> Exporting and Closing.");
            await exportMeetingTranscript(meetingId);
            await page.close();
            break;
          } else {
            logger.info(`GoogleMeetAdapter(monitor): Bot alone detected; waiting (${Math.ceil((ALONE_SUSTAIN_MS - aloneForMs) / 1000)}s remaining)...`);
          }
        }
      } else {
        if (aloneSinceMs !== null) {
          logger.info("GoogleMeetAdapter(monitor): ALONE_CHECK: participants > 1 again; resetting alone timer.");
        }
        aloneSinceMs = null;
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
