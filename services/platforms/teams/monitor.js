/**
 * root/services/platforms/teams/monitor.js
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

async function monitorMeeting(page, meetingId, botName, sessionId, participantTracker = null) {
  logger.info('TeamsAdapter (Monitor): Stay-Alive loop started');

  const tracker = participantTracker || new ParticipantTracker(meetingId, sessionId);
  let previousParticipants = [];
  let lastParticipantCheckTime = Date.now();
  const PARTICIPANT_CHECK_INTERVAL = 5000;
  let loopCount = 0;

  while (true) {

    if (page.isClosed()) {
      logger.info("TeamsAdapter (Monitor): EXIT: Page closed → Exporting");
      await exportMeetingTranscript(meetingId);
      break;
    }

    const url = page.url();
    if (!url.includes('teams.live.com') && !url.includes('teams.microsoft.com')) {
      logger.info("TeamsAdapter (Monitor): EXIT: Navigated away from Teams → Exporting");
      await exportMeetingTranscript(meetingId);
      break;
    }

    const meetingEnded = await checkMeetingEnded(page);
    if (meetingEnded) {
      logger.info("TeamsAdapter (Monitor): EXIT: Meeting ended detected → Exporting");
      await exportMeetingTranscript(meetingId);
      break;
    }

    const waitingRoom = await checkWaitingRoom(page);
    if (waitingRoom) {
      logger.info("TeamsAdapter (Monitor): Lobby detected");
    }

    const now = Date.now();
    if (now - lastParticipantCheckTime >= PARTICIPANT_CHECK_INTERVAL) {
      try {
        previousParticipants = await trackAttendanceChanges(page, botName, tracker, previousParticipants);
        lastParticipantCheckTime = now;
      } catch (err) {
        logger.error(`TeamsAdapter (Monitor): Error in attendance tracking: ${err.message}`);
      }
    }

    const participantCount = await getParticipantCount(page);
    if (participantCount <= 1) {
      logger.warn("TeamsAdapter (Monitor): EXIT: Only bot left → Exporting");
      await exportMeetingTranscript(meetingId);
      break;
    }

    logger.info(`TeamsAdapter (Monitor): participants ≈ ${participantCount}`);

    await new Promise(r => setTimeout(r, 10000));

    loopCount++;
    if (loopCount % 6 === 0) {
      logger.info(`TeamsAdapter (Monitor): Alive ${loopCount / 6}m`);
    }
  }

  if (keepAliveInterval) clearInterval(keepAliveInterval);
  logger.info("TeamsAdapter (Monitor): MEETING ENDED: Full transcript exported");
}

module.exports = {
  startKeepAlive,
  monitorMeeting,
  exportMeetingTranscript
};