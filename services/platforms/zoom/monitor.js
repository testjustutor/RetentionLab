/**
 * root/services/platforms/zoom/monitor.js
 *
 */
const { logger } = require('../../../utils/logger');
const { exportBoth } = require('../../../utils/export');
const TranscriptModel = require('../../../models/transcripts/transcriptModel');
const path = require('path');

let keepAliveInterval = null;

// async function debugParticipantDOM(frame) {
//   const info = await frame.evaluate(() => {
//     const result = { allClassesWithName: [] };
//     document.querySelectorAll('[class*="name"], [class*="Name"], [class*="user"], [class*="User"], [class*="avatar"], [class*="participant"]')
//       .forEach(el => {
//         const text = (el.innerText || '').trim();
//         const cls = el.className || '';
//         if (text && text.length > 1 && text.length < 60) {
//           result.allClassesWithName.push({ class: cls.substring(0, 80), text });
//         }
//       });
//     return result;
//   });
//   logger.info('ZoomAdapter(monitor): DOM DUMP: ' + JSON.stringify(info.allClassesWithName.slice(0, 20)));
// }


async function getCurrentParticipantNames(frame, botName) {
  try {
    const names = await frame.evaluate((bot) => {
      const botNameLower = (bot || '').trim().toLowerCase();
      const participants = new Set();

      const cleanName = (value) => (value || '').replace(/\s+/g, ' ').trim();

      const isValid = (name) => {
        if (!name || name.length < 2 || name.length > 100) return false;
        if (!/[a-zA-Z]/.test(name)) return false;
        if (name.toLowerCase() === botNameLower) return false;
        const blocked = ['participants', 'attendees', 'mute all', 'more', 'chat', 'reactions'];
        if (blocked.includes(name.toLowerCase())) return false;
        return true;
      };

      const addName = (value) => {
        const name = cleanName(value);
        if (isValid(name)) participants.add(name);
      };

      // PASS 1: class contains avatar-name / avatar-footer / avatar-title
      document.querySelectorAll('[class*="avatar-name"], [class*="avatar-footer"], [class*="avatar-title"]')
        .forEach(el => addName(el.innerText));

      // PASS 2: display-name variants
      if (participants.size === 0) {
        document.querySelectorAll('[class*="display-name"], [class*="displayName"], [class*="displayname"]')
          .forEach(el => addName(el.innerText));
      }

      // PASS 3: aria-label on video/tile/avatar elements
      if (participants.size === 0) {
        document.querySelectorAll('[aria-label][class*="video"], [aria-label][class*="tile"], [aria-label][class*="avatar"]')
          .forEach(el => addName(el.getAttribute('aria-label')));
      }

      // PASS 4: data attributes
      if (participants.size === 0) {
        document.querySelectorAll('[data-name], [data-username], [data-display-name]')
          .forEach(el => addName(
            el.getAttribute('data-name') ||
            el.getAttribute('data-username') ||
            el.getAttribute('data-display-name')
          ));
      }

      return Array.from(participants);
    }, botName);

    logger.info(`ZoomAdapter(monitor): Extracted ${names.length} names: ${names}`);
    return names;
  } catch (err) {
    logger.error(`ZoomAdapter(monitor): Error extracting participant names: ${err.message}`);
    return [];
  }
}

async function trackAttendanceChanges(frame, botName, participantTracker, previousParticipants) {
  const currentParticipants = await getCurrentParticipantNames(frame, botName);

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

async function monitorMeeting(page, meetingId, botName, sessionId, participantTracker) {
  logger.info('ZoomAdapter(monitor): MONITOR: Stay-Alive loop started');

  let previousParticipants = [];
  let lastParticipantCheckTime = Date.now();
  const PARTICIPANT_CHECK_INTERVAL = 5000;

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
        logger.info("ZoomAdapter(monitor): EXIT: Page closed → Exporting final transcript");
        await exportMeetingTranscript(meetingId);
        break;
      }

      const url = page.url();
      const isNotZoom = !url.includes('/wc/') && !url.includes('/j/');
      const isZoomDashboardPage = url.endsWith('/wc') || url.endsWith('/wc/');

      if (isNotZoom || isZoomDashboardPage) {
        logger.info(`ZoomAdapter(monitor): EXIT: Meeting ended (Redirected to ${url}) → Exporting`);
        await exportMeetingTranscript(meetingId);
        break;
      }

      const frame = page.frames().find(f => f.url().includes("zoom.us"));
      if (!frame) {
        logger.info("ZoomAdapter(monitor): EXIT: Zoom iframe gone → Export");
        await exportMeetingTranscript(meetingId);
        break;
      }

      // if (loopCount === 0) await debugParticipantDOM(frame);

      const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());
      if (pageText.includes('meeting ended by host') || pageText.includes('host ended')) {
        logger.info("ZoomAdapter(monitor): HOST ENDED MEETING → Export now");
        await exportMeetingTranscript(meetingId);
        break;
      }

      const meetingEnded = await frame.evaluate((phrases) => {
        const bodyText = document.body.innerText.toLowerCase();
        return phrases.some(p => bodyText.includes(p));
      }, endPhrases);

      if (meetingEnded) {
        logger.info("ZoomAdapter(monitor): EXIT: Meeting end text detected → Exporting final transcript");
        await exportMeetingTranscript(meetingId);
        break;
      }

      const participantCount = await frame.evaluate(() => {
        const nodes = document.querySelectorAll('[class*="participant"],[class*="Participant"],[class*="username"],.username,.display_name');
        return nodes.length;
      });

      if (participantCount === 1) {
        logger.info("ZoomAdapter(monitor): EXIT: Only bot left (1 total) → Exporting");
        await exportMeetingTranscript(meetingId);
        break;
      }
      logger.debug(`ZoomAdapter(monitor): Monitor: ${participantCount} participants active`);

      const waitingRoom = await frame.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return text.includes("please wait for the host") || text.includes("waiting for the host");
      });

      if (waitingRoom) {
        logger.info("ZoomAdapter(monitor): Waiting room detected");
      }

      const now = Date.now();
      if (now - lastParticipantCheckTime >= PARTICIPANT_CHECK_INTERVAL) {
        try {
          previousParticipants = await trackAttendanceChanges(frame, botName, participantTracker, previousParticipants);
          lastParticipantCheckTime = now;
        } catch (err) {
          logger.error(`ZoomAdapter(monitor): Attendance tracking error: ${err.message}`);
        }
      }

      await new Promise(r => setTimeout(r, 10000));
      loopCount++;
      if (loopCount % 6 === 0) {
        logger.info(`ZoomAdapter(monitor): MONITOR: Alive ${loopCount / 6}m`);
      }
    }
  } catch (error) {
    logger.error(`ZoomAdapter(monitor): MONITOR: ${error.message}`);
  }

  if (keepAliveInterval) clearInterval(keepAliveInterval);
  logger.info("ZoomAdapter(monitor): MEETING ENDED: Full transcript exported to storage/");
}

async function exportMeetingTranscript(meetingId) {
  try {
    const exports = await exportBoth(meetingId, 'storage');
    logger.info(`ZoomAdapter(monitor): SAVED to storage/: ${exports.json}, ${exports.txt}`);
  } catch (err) {
    logger.error('ZoomAdapter(monitor): Export fail:', err);
  }
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


module.exports = {
  startKeepAlive,
  monitorMeeting,
  exportMeetingTranscript
};