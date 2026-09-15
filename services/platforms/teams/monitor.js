/**
 * services/platforms/teams/monitor.js
 *
 */
const { logger } = require('../../../utils/logger');
const { exportBoth } = require('../../../utils/export');
const TranscriptModel = require('../../../models/transcripts/transcriptModel');
const ParticipantTracker = require('./participantTracker');

// ─────────────────────────────────────────────
// KEEP-ALIVE
// ─────────────────────────────────────────────

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

const PEOPLE_BTN_SELECTORS = [
  'button[aria-label*="People"]',
  'button[aria-label="People"]',
  '[data-tid="calling-participant-button"]',
  '[aria-label*="Show participants"]',
  '[aria-label*="participants"]'
];

// Confirms the roster panel is actually open (not just that we clicked
// something) - mirrors google-meet/monitor.js's isPeoplePanelOpen(). A click
// can silently miss (wrong/hidden element, panel already in a different
// state), and without this check that can't be told apart from a panel
// that's genuinely empty.
async function isPeoplePanelOpen(page) {
  try {
    return await page.evaluate(() => {
      return !!document.querySelector('[data-cid="roster-participant"], [data-tid^="participantsInCall-"]');
    });
  } catch (_) {
    return false;
  }
}

/**
 * Clicks the "People"/"Show participants" button if the roster panel isn't
 * already open, so getCurrentParticipantNames() has roster-participant nodes
 * to read. Parity with google-meet/monitor.js's openPeoplePanel() - exposed
 * as its own function (rather than buried inside name extraction) so
 * captureInitialParticipants() below can call it explicitly, before the very
 * first read.
 *
 * GUARD: skips clicking entirely if the panel is already open - re-clicking
 * an already-open toggle can knock the panel into a different state instead
 * of a no-op.
 */
async function openPeoplePanel(page) {
  if (await isPeoplePanelOpen(page)) {
    return { clicked: false, opened: true, selector: 'already-open' };
  }

  for (const sel of PEOPLE_BTN_SELECTORS) {
    try {
      const handle = await page.$(sel);
      if (handle) {
        await handle.click().catch(() => {});
        await new Promise(r => setTimeout(r, 600));
        if (await isPeoplePanelOpen(page)) {
          return { clicked: true, opened: true, selector: sel };
        }
      }
    } catch (_) {}
  }

  try {
    const clicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button,[role="button"]')).find((el) => {
        const text = [el.getAttribute('aria-label'), el.getAttribute('title'), el.innerText]
          .filter(Boolean).join(' ').toLowerCase();
        return text.includes('people') || text.includes('participant') || text.includes('show participants');
      });
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      await new Promise(r => setTimeout(r, 600));
      const opened = await isPeoplePanelOpen(page);
      return { clicked: true, opened, selector: 'broad-scan' };
    }
  } catch (_) {}

  return { clicked: false, opened: false, selector: null };
}

/**
 * INITIAL ROSTER CAPTURE (join-time)
 *
 * Parity with google-meet/monitor.js's captureInitialParticipants(). Runs
 * ONCE, right after the bot is admitted, so anyone already in the Teams
 * call gets their attendance recorded immediately instead of only being
 * noticed on monitorMeeting()'s next attendance-check tick. Only reads the
 * DOM the bot already scrapes for ongoing join/leave detection
 * (getCurrentParticipantNames) - there's no separate Teams "current roster"
 * API, this just runs proactively at join time instead of waiting for the
 * polling loop.
 *
 * Opens the roster panel FIRST (openPeoplePanel) so this first read isn't
 * racing the panel's own render.
 *
 * All persistence goes through tracker.handleInitialRoster() (see
 * participantTracker.js) - this function's only job is getting names out
 * of the DOM.
 */
async function captureInitialParticipants(page, botName, tracker, snapshotTime = new Date()) {
  try {
    await openPeoplePanel(page);

    let names = await getCurrentParticipantNames(page, botName);

    // DOM can still be settling immediately after admission; give it one
    // retry rather than reporting "meeting was empty" on a false negative.
    if (!names || names.length === 0) {
      await new Promise(r => setTimeout(r, 1500));
      names = await getCurrentParticipantNames(page, botName);
    }

    return await tracker.handleInitialRoster(names, snapshotTime);
  } catch (err) {
    logger.error('TeamsAdapter (Monitor): INITIAL_ROSTER: capture failed, continuing without it:', err.message);
    return [];
  }
}
// ─────────────────────────────────────────────
// PARTICIPANT NAME EXTRACTION
// ─────────────────────────────────────────────

async function getCurrentParticipantNames(page, botName) {
  try {
    const names = await page.evaluate((bot) => {
      const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
      const botNameLower = normalize(bot).toLowerCase();
      const participants = new Set();

      const cleanName = (value) => {
        let name = normalize(value);
        name = name
          .replace(/\b(organizer|presenter|attendee|meeting guest|guest|muted|unmuted|camera off|camera on|you|has context menu)\b/gi, '')
          .replace(/\([^)]*\)/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        return name;
      };

      const isValidParticipantName = (name) => {
        if (!name) return false;
        if (name.length < 2 || name.length > 100) return false;
        if (!/[a-zA-Z]/.test(name)) return false;
        const lower = name.toLowerCase();
        const blocked = ['participants', 'attendees', 'in this meeting', 'mute all', 'share invite', 'type a name', 'organizer', 'presenter', 'meeting guest', 'guest'];
        if (blocked.includes(lower)) return false;
        if (lower === botNameLower) return false;
        return true;
      };

      const rosterAlreadyOpen = !!document.querySelector('[data-cid="roster-participant"], [data-tid^="participantsInCall-"]');
      if (!rosterAlreadyOpen) {
        const peopleButton = Array.from(document.querySelectorAll('button,[role="button"]')).find((button) => {
          const text = [button.getAttribute('aria-label'), button.getAttribute('title'), button.innerText]
            .filter(Boolean).join(' ').toLowerCase();
          return text.includes('people') || text.includes('participant') || text.includes('show participants');
        });
        if (peopleButton) peopleButton.click();
      }

      const rosterParticipants = document.querySelectorAll('[data-cid="roster-participant"]');
      rosterParticipants.forEach((node) => {
        let name = '';
        const dataTid = node.getAttribute('data-tid');
        if (dataTid?.startsWith('participantsInCall-')) {
          name = decodeURIComponent(dataTid.replace('participantsInCall-', ''));
        }
        if (!name) {
          const titleEl = node.querySelector('[title], [id^="roster-avatar-img"]');
          if (titleEl) name = titleEl.getAttribute('title') || titleEl.textContent || '';
        }
        if (!name) {
          const aria = node.getAttribute('aria-label');
          if (aria) name = aria.split(',')[0];
        }
        name = cleanName(name);
        if (isValidParticipantName(name)) participants.add(name);
      });

      if (participants.size === 0) {
        const fallbackNodes = document.querySelectorAll(
          '[data-tid^="participantsInCall-"],[id^="roster-avatar-img"],[data-cid="roster-participant"]'
        );
        fallbackNodes.forEach((node) => {
          let name = node.getAttribute('title') || node.textContent || node.getAttribute('aria-label') || '';
          if (node.hasAttribute('data-tid') && node.getAttribute('data-tid').startsWith('participantsInCall-')) {
            name = node.getAttribute('data-tid').replace('participantsInCall-', '');
          }
          name = cleanName(name);
          if (isValidParticipantName(name)) participants.add(name);
        });
      }

      return Array.from(participants);
    }, botName);

    return names;
  } catch (err) {
    logger.error(`TeamsAdapter (Monitor): Error extracting participant names: ${err.message}`);
    return [];
  }
}

/**
 * NEW: lightweight one-off check for whether at least one real human
 * participant is currently visible on the page. Used by
 * socraticbot.js's waitForHumanParticipant() to gate recording/Python
 * processing on a real participant joining (see Request 4: "Don't process
 * when only the bot joins").
 */
async function hasHumanJoined(page, botName) {
  try {
    const names = await getCurrentParticipantNames(page, botName);
    return Array.isArray(names) && names.length > 0;
  } catch (err) {
    logger.error(`TeamsAdapter (Monitor): hasHumanJoined check failed: ${err.message}`);
    return false;
  }
}

// ─────────────────────────────────────────────
// PAGE STATE CHECKS
// ─────────────────────────────────────────────

async function checkMeetingEnded(page) {
  return page.evaluate(() => {
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
}

async function checkWaitingRoom(page) {
  return page.evaluate(() => {
    const text = document.body.innerText.toLowerCase();
    return (
      text.includes("waiting in the lobby") ||
      text.includes("we'll let people in soon") ||
      text.includes("someone will admit you")
    );
  });
}

async function getParticipantCount(page) {
  return page.evaluate(() => {
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
        const match = (el.innerText || el.getAttribute('aria-label') || '').match(/(\d+)/);
        if (match) return parseInt(match[1]);
      }
    }
    const rosterItems = document.querySelectorAll(
      '[data-tid="roster-participant"],[data-tid="participant-item"],[class*="participantItem"],[class*="roster-item"]'
    );
    if (rosterItems.length > 0) return rosterItems.length;
    const peopleBtn = document.querySelector('[aria-label*="People"]');
    if (peopleBtn) {
      const match = (peopleBtn.getAttribute('aria-label') || '').match(/\((\d+)\)/);
      if (match) return parseInt(match[1]);
    }
    return -1;
  });
}

// ─────────────────────────────────────────────
// ATTENDANCE TRACKING
// ─────────────────────────────────────────────

async function trackAttendanceChanges(page, botName, participantTracker, previousParticipants) {
  const currentParticipants = await getCurrentParticipantNames(page, botName);

  logger.info(`TeamsAdapter (Monitor): attendance tracking Participant Name : ${currentParticipants}`);

  for (const name of currentParticipants) {
    if (!previousParticipants.includes(name)) {
      await participantTracker.handleParticipantJoin(name);
    }
  }
  for (const name of previousParticipants) {
    if (!currentParticipants.includes(name)) {
      await participantTracker.handleParticipantLeave(name);
    }
  }

  return currentParticipants;
}

// ─────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────

async function exportMeetingTranscript(meetingId) {
  try {
    const exports = await exportBoth(meetingId, 'storage');
    logger.info(`TeamsAdapter (Monitor): SAVED: ${exports.json}, ${exports.txt}`);
  } catch (err) {
    logger.error('TeamsAdapter (Monitor): Export fail:', err);
  }
}

// ─────────────────────────────────────────────
// MAIN MONITOR LOOP
// FIX 2: now accepts an externally-created participantTracker (optional).
// If the caller (socraticbot.js) passes one in, we use it — matching the
// Zoom/Google Meet pattern — instead of always creating a brand new one
// that's invisible outside this function. Falls back to creating one
// internally only if the caller doesn't supply it, for backwards compat.
// ─────────────────────────────────────────────

async function monitorMeeting(page, meetingId, botName, sessionId, participantTracker = null, initialParticipants = []) {
  logger.info('TeamsAdapter (Monitor): Stay-Alive loop started');

  const tracker = participantTracker || new ParticipantTracker(meetingId, sessionId);

  // Seed the diff baseline with whoever captureInitialParticipants() already
  // recorded before this loop started (parity with google-meet/monitor.js),
  // so the first tick doesn't log them again as "new" joins.
  let previousParticipants = Array.isArray(initialParticipants)
    ? [...new Set(initialParticipants)]
    : [];

  // SPEED FIX (parity with google-meet/monitor.js): attendance detection
  // used to be gated behind the SAME 10s sleep as the participant-count
  // "should the bot leave" check - the loop itself never ticked faster than
  // 10s, so PARTICIPANT_CHECK_INTERVAL=5000 was never actually reachable. A
  // join/leave could sit undetected - and therefore unwritten to
  // participants/participant_attendance_sessions - for up to ~10s.
  //
  // LOOP_TICK_MS is now the loop's own fast cadence, and attendance
  // detection (trackAttendanceChanges) runs on EVERY tick, so a join/leave
  // is written to the DB on the very next tick after it becomes visible in
  // the DOM. The heavier "is the bot alone" participant-count check stays
  // on its own slower cadence since it only decides whether the bot itself
  // should leave an empty meeting.
  const LOOP_TICK_MS = 2000;
  const COUNT_CHECK_INTERVAL = 10000;
  let lastCountCheckTime = 0; // 0 forces the count-check to also run on the very first tick

  let loopCount = 0;

  while (true) {

    if (page.isClosed()) {
      await finalizeAttendanceOnExit(tracker, meetingId, "Page closed → Closing out attendance and exporting");
      break;
    }

    const url = page.url();
    if (!url.includes('teams.live.com') && !url.includes('teams.microsoft.com')) {
      await finalizeAttendanceOnExit(tracker, meetingId, "Navigated away from Teams → Closing out attendance and exporting");
      break;
    }

    const meetingEnded = await checkMeetingEnded(page);
    if (meetingEnded) {
      await finalizeAttendanceOnExit(tracker, meetingId, "Meeting ended detected → Closing out attendance and exporting");
      break;
    }

    const waitingRoom = await checkWaitingRoom(page);
    if (waitingRoom) {
      logger.info("TeamsAdapter (Monitor): Lobby detected");
    }

    // ATTENDANCE TRACKING: runs every tick (see SPEED FIX above) - a
    // detected join/leave is persisted to participants/
    // participant_attendance_sessions immediately after this DOM read.
    try {
      previousParticipants = await trackAttendanceChanges(page, botName, tracker, previousParticipants);
    } catch (err) {
      logger.error(`TeamsAdapter (Monitor): Error in attendance tracking: ${err.message}`);
    }

    // "Is the bot alone" check - kept on its own slower cadence; it only
    // decides whether the bot should leave an empty meeting.
    const now = Date.now();
    if (now - lastCountCheckTime >= COUNT_CHECK_INTERVAL) {
      lastCountCheckTime = now;

      const participantCount = await getParticipantCount(page);
      if (participantCount <= 1) {
        logger.warn("TeamsAdapter (Monitor): EXIT: Only bot left → Exporting");
        await finalizeAttendanceOnExit(tracker, meetingId, "Bot alone → Closing out attendance and exporting");
        break;
      }

      logger.info(`TeamsAdapter (Monitor): participants ≈ ${participantCount}`);
    }

    await new Promise(r => setTimeout(r, LOOP_TICK_MS));

    loopCount++;
    const ticksPerMinute = Math.round(60000 / LOOP_TICK_MS);
    if (loopCount % ticksPerMinute === 0) {
      logger.info(`TeamsAdapter (Monitor): Alive ${loopCount / ticksPerMinute}m`);
    }
  }

  if (keepAliveInterval) clearInterval(keepAliveInterval);
  logger.info("TeamsAdapter (Monitor): MEETING ENDED: Full transcript exported");
}

// MEETING-END SCENARIO: close out anyone still tracked as "joined" before
// exporting - parity with google-meet/monitor.js's finalizeAttendanceOnExit().
// Runs from every exit branch above so a participant still marked "joined"
// when the bot leaves always gets an attendance session closed with a
// leave time, instead of being left open forever.
async function finalizeAttendanceOnExit(tracker, meetingId, reason) {
  logger.info(`TeamsAdapter (Monitor): EXIT: ${reason}`);
  try {
    await tracker.reset();
  } catch (err) {
    logger.error(`TeamsAdapter (Monitor): Error closing out attendance on exit (${reason}):`, err);
  }
  await exportMeetingTranscript(meetingId);
}

module.exports = {
  startKeepAlive,
  monitorMeeting,
  exportMeetingTranscript,
  getCurrentParticipantNames,
  hasHumanJoined,
  captureInitialParticipants,
  openPeoplePanel
};