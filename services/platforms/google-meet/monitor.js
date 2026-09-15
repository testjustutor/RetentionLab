/**
 * services/platforms/google-meet/monitor.js
 *
 */
const { logger } = require('../../../utils/logger');
const { exportBoth } = require('../../../utils/export');
const TranscriptModel = require('../../../models/transcripts/transcriptModel');
const ParticipantTracker = require('./participantTracker');
const path = require('path');

let keepAliveInterval = null;

const PEOPLE_BTN_SELECTORS = [
  'button[aria-label*="People"]',
  'button[aria-label="People"]',
  '[data-tooltip*="Show everyone"]',
  '[aria-label*="Show everyone"]'
];

// Count-based "is a real human here" check used by hasHumanJoined() to gate
// recording/processing on a real participant being present, for the window
// right after join before name-based extraction has anything to read yet.
// NOTE: deliberately NOT used to fabricate participant rows any more (see
// isPlausibleParticipantName below for why) - tile/roster counts are only a
// presence signal here, never a source of names or a headcount to track.
function isHumanPresentFromCountInfo(info) {
  return (
    (info.rosterWithIdCount >= 2) ||
    (info.countFromLabel >= 2) ||
    (info.avatarCount >= 2) ||
    (info.nonSelfTiles >= 1) ||
    (info.tileCount >= 2)
  );
}

// Rejects known UI-fragment junk that can leak through the [role="listitem"]
// selector when Meet swaps the People panel's normal roster for a summary/
// recap view (e.g. when the bot is briefly alone) - seen in production logs
// as fake "participants" named "3 joined" and "0 also invitedchevron_
// rightOpen the People panel". A real display name never matches these.
function isPlausibleParticipantName(name) {
  if (!name) return false;
  const n = name.trim();
  if (!n) return false;
  if (/^\d+\s+joined\b/i.test(n)) return false;
  if (/also invited/i.test(n)) return false;
  if (/chevron_right/i.test(n)) return false;
  if (/open the people panel/i.test(n)) return false;
  if (/^\d+$/.test(n)) return false;
  return true;
}

// Confirms the People panel is actually open (not just that we clicked
// something) - checked after every click attempt in openPeoplePanel() below,
// because a click can silently miss (wrong/hidden element, panel already in
// a different state) and we'd otherwise have no way to tell apart from a
// panel that's genuinely empty.
async function isPeoplePanelOpen(page) {
  try {
    return await page.evaluate(() => {
      if (document.querySelector('[role="listitem"]')) return true;
      const text = document.body.innerText || '';
      return text.includes('Contributors') || text.includes('In the meeting') || text.includes('In the call');
    });
  } catch (_) {
    return false;
  }
}

/**
 * Clicks the "People" / "Show everyone" button if it's present, so the
 * roster panel actually renders its [role="listitem"] entries. Shared by
 * getParticipantCountDebug() (below) and captureInitialParticipants() -
 * both need the panel open before reading names/counts out of the DOM;
 * without this click, a bot that just joined can see an EMPTY roster even
 * though several people are already in the call, because Meet doesn't
 * render the People-panel listitems until that panel has been opened at
 * least once.
 *
 * FALLBACK: some Meet layouts (narrow window / compact header) don't render
 * a bottom-toolbar "People" button at all - the only way in is a top-right
 * avatar-stack pill showing a headcount badge, which doesn't reliably carry
 * a "People"/"Show everyone" aria-label the fixed selectors above can match.
 * When none of PEOPLE_BTN_SELECTORS opens the panel, scan every visible
 * button/[role="button"] for accessible text mentioning people/contributors
 * instead, and verify with isPeoplePanelOpen() before trusting the click.
 *
 * GUARD: skips clicking entirely if the panel is already open. This is
 * called on every ALONE_CHECK_INTERVAL tick (~10s) via
 * getParticipantCountDebug(), and re-clicking the SAME toggle button while
 * the panel is already open was seen to knock it into a different summary/
 * recap state instead of a no-op - the direct cause of the "3 joined" / "0
 * also invited..." fake-participant bug (see isPlausibleParticipantName).
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
        // Give the panel a moment to render after the click.
        await new Promise(r => setTimeout(r, 600));
        if (await isPeoplePanelOpen(page)) {
          return { clicked: true, opened: true, selector: sel };
        }
      }
    } catch (_) {}
  }

  try {
    const broadMatch = await page.evaluate(() => {
      const re = /\bpeople\b|\bcontributors?\b|show everyone/i;

      // Some icon-only buttons (e.g. the top-right avatar/count pill) carry
      // no aria-label/data-tooltip/title at all - their name lives in a
      // separate, visually-hidden element referenced via aria-labelledby.
      // Resolve that before giving up on an element.
      const resolveAccessibleName = (el) => {
        const direct = el.getAttribute('aria-label') || el.getAttribute('data-tooltip') || el.getAttribute('title');
        if (direct) return direct;
        const labelledBy = el.getAttribute('aria-labelledby');
        if (labelledBy) {
          const text = labelledBy.split(/\s+/).map(id => {
            const ref = document.getElementById(id);
            return ref ? (ref.innerText || ref.textContent || '') : '';
          }).join(' ').trim();
          if (text) return text;
        }
        return '';
      };

      const candidates = Array.from(document.querySelectorAll('button, [role="button"]'));
      for (const el of candidates) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const text = resolveAccessibleName(el);
        if (re.test(text)) {
          el.click();
          return text.trim();
        }
      }
      return null;
    });

    if (broadMatch) {
      await new Promise(r => setTimeout(r, 600));
      if (await isPeoplePanelOpen(page)) {
        return { clicked: true, opened: true, selector: `broad-scan:${broadMatch}` };
      }
      return { clicked: true, opened: false, selector: `broad-scan:${broadMatch}` };
    }
  } catch (_) {}
  return { clicked: false, opened: false, selector: null };
}

async function getParticipantCountDebug(page) {
  const { clicked: clickedPeople, opened: peoplePanelOpened, selector: clickedSelector } = await openPeoplePanel(page);

  const info = await page.evaluate(() => {
    const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim();

    // Resolves an element's accessible name, including via aria-labelledby -
    // some icon-only buttons (e.g. the top-right avatar/count pill) have no
    // aria-label/data-tooltip/title of their own; the name is a separate
    // visually-hidden element referenced by id instead.
    const resolveAccessibleName = (el) => {
      if (!el) return '';
      const direct = el.getAttribute('aria-label') || el.getAttribute('data-tooltip') || el.getAttribute('title');
      if (direct) return direct;
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const text = labelledBy.split(/\s+/).map(id => {
          const ref = document.getElementById(id);
          return ref ? (ref.innerText || ref.textContent || '') : '';
        }).join(' ').trim();
        if (text) return text;
      }
      return el.innerText || '';
    };

    let peopleBtn = document.querySelector(
      'button[aria-label*="People"], button[aria-label="People"], [data-tooltip*="Show everyone"], [aria-label*="Show everyone"]'
    );

    // FALLBACK: layouts where the panel-opener is a role="button" element
    // named only via aria-labelledby (no direct aria-label/data-tooltip) -
    // e.g. the top-right avatar-stack "People" pill.
    if (!peopleBtn) {
      const candidates = document.querySelectorAll('[role="button"][aria-labelledby]');
      for (const el of candidates) {
        if (/\bpeople\b|\bcontributors?\b|show everyone/i.test(resolveAccessibleName(el))) {
          peopleBtn = el;
          break;
        }
      }
    }

    const peopleLabel = peopleBtn ? normalize(resolveAccessibleName(peopleBtn)) : '';

    let countFromLabel = -1;
    const m = peopleLabel.match(/\((\d+)\)/) || peopleLabel.match(/\b(\d+)\b/);
    if (m) countFromLabel = parseInt(m[1] || m[0], 10);

    // People panel roster count: try several stable-ish patterns.
    const rosterWithIdCount = document.querySelectorAll('[role="listitem"][data-participant-id]').length;
    const rosterPlainCount = document.querySelectorAll('[role="listitem"]').length;
    const participantIdCount = document.querySelectorAll('[data-participant-id]').length;
    const selfTileCount = document.querySelectorAll('[data-self-name]').length;
    const requestedCount = document.querySelectorAll('[data-requested-participant-id]').length;

    // Non-self tiles = every participant tile minus the bot's own self-view.
    // Never depends on the People panel AND stays correct when the bot's
    // camera is off (Meet then omits the self-view tile entirely, which
    // previously made a single human look like a participantCount of 1).
    const nonSelfTiles = Math.max(0, participantIdCount - selfTileCount);

    const rosterCandidates = [rosterWithIdCount, rosterPlainCount, participantIdCount, requestedCount].filter(n => n && n > 0);
    const rosterCount = rosterCandidates.length ? Math.max(...rosterCandidates) : -1;

    // Tile count fallback (less reliable for large calls / layout changes).
    const tileCount = document.querySelectorAll('[data-allocation-index]').length || -1;

    // Top-right avatar-stack pill exposes the headcount (including the bot)
    // directly via data-avatar-count - no text parsing needed. Not fully
    // trusted alone since the avatar stack may cap how many it renders in a
    // very large meeting, so it's one candidate among several, not the only one.
    const avatarCountEl = document.querySelector('[data-avatar-count]');
    const avatarCount = avatarCountEl ? (parseInt(avatarCountEl.getAttribute('data-avatar-count'), 10) || -1) : -1;

    // Prefer roster-with-ids (People panel), then roster, then the avatar
    // badge, then label, then tiles.
    const participantCount =
      rosterWithIdCount > 0 ? rosterWithIdCount :
      rosterCount > 0 ? rosterCount :
      avatarCount > 0 ? avatarCount :
      countFromLabel > 0 ? countFromLabel :
      tileCount > 0 ? tileCount :
      -1;

    return {
      peopleLabel,
      countFromLabel,
      avatarCount,
      rosterCount,
      rosterWithIdCount,
      participantIdCount,
      selfTileCount,
      nonSelfTiles,
      tileCount,
      participantCount
    };
  });

  return {
    clickedPeople,
    peoplePanelOpened,
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
 *
 * FIX: now accepts and filters out botName, matching the zoom/teams monitors
 * (services/platforms/zoom/monitor.js, services/platforms/teams/monitor.js).
 * Previously this function took no botName at all, so the bot's own name
 * (when it happened to render as a roster/tile item) could be counted as a
 * "participant" here — the underlying bug behind "bot must not count as a
 * participant" (see socraticbot.js waitForHumanParticipant()).
 */
async function getCurrentParticipantNames(page, botName) {
  try {
    const { participants, rosterItemCount, videoTileCount } = await page.evaluate((bot) => {
      const botNameLower = (bot || '').trim().toLowerCase();
      const participants = [];

      const isBotName = (name) => botNameLower && name.trim().toLowerCase() === botNameLower;

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
            if (!isBotName(cleanName) && !participants.includes(cleanName) && cleanName.length < 200) {
              participants.push(cleanName);
            }
          }
        });
      }

      // Strategy 2: Extract from video tiles
      const videoTiles = document.querySelectorAll('[data-participant-id], [data-allocation-index]');
      if (participants.length === 0) {
        videoTiles.forEach(tile => {
          const label = tile.getAttribute('aria-label') || tile.getAttribute('data-name') || tile.title;
          if (label && label.trim()) {
            const cleanName = label.trim().replace(/\s+/g, ' ');
            if (!isBotName(cleanName) && !participants.includes(cleanName) && cleanName.length < 200) {
              participants.push(cleanName);
            }
          }
        });
      }

      return { participants, rosterItemCount: rosterItems.length, videoTileCount: videoTiles.length };
    }, botName);

    // Reject UI-fragment junk before it's ever treated as a name (see
    // isPlausibleParticipantName) - Meet occasionally swaps the People
    // panel's roster for a summary/recap view (e.g. bot briefly alone) whose
    // rows also carry role="listitem", and without this filter that recap
    // text gets recorded as a fake participant joining/leaving seconds later.
    const filtered = participants.filter(isPlausibleParticipantName);
    const rejectedCount = participants.length - filtered.length;
    if (rejectedCount > 0) {
      logger.warn(
        `GoogleMeetAdapter(monitor): getCurrentParticipantNames: rejected ${rejectedCount} non-name entr${rejectedCount === 1 ? 'y' : 'ies'} (${JSON.stringify(participants.filter(n => !isPlausibleParticipantName(n)))}) - likely a Meet summary/recap view, not real participants.`
      );
    }

    // Diagnostic: tells us WHY extraction came up empty - no elements found
    // at all (People panel likely never opened / no tiles rendered yet) vs.
    // elements found but none carried a usable name/aria-label/data-name.
    if (filtered.length === 0 && (rosterItemCount > 0 || videoTileCount > 0)) {
      logger.info(
        `GoogleMeetAdapter(monitor): getCurrentParticipantNames: ${rosterItemCount} roster item(s) / ${videoTileCount} tile(s) found but none had a usable name.`
      );
    }

    return filtered;
  } catch (err) {
    logger.debug('GoogleMeetAdapter(monitor): Error extracting participant names:', err.message);
    return [];
  }
}

/**
 * INITIAL ROSTER CAPTURE (join-time)
 *
 * Runs ONCE, right after the bot successfully joins a meeting, so anyone
 * already in the call gets their attendance recorded immediately instead of
 * only being noticed on monitorMeeting()'s next 5s poll. Feasibility note:
 * this only reads the DOM the bot already scrapes for ongoing join/leave
 * detection (getCurrentParticipantNames/getParticipantCountDebug) - there is
 * no separate Meet "current roster" API, so this is the same
 * People-panel/tile scrape, just run proactively at join time instead of
 * waiting for the polling loop.
 *
 * Opens the People panel FIRST (openPeoplePanel, shared with
 * getParticipantCountDebug): getCurrentParticipantNames' primary strategy
 * only finds anything once that panel has rendered its [role="listitem"]
 * entries. Without this, a bot joining a call that already has several
 * people in it could see an empty names array on this very first read and
 * miss all of them (its Strategy 2 tile fallback depends on aria-label/
 * data-name/title attributes Meet doesn't always set on the tile itself).
 *
 * All persistence goes through tracker.handleInitialRoster() (see
 * participantTracker.js) - this function's only job is getting names out of
 * the DOM. See that method for the join-recording/idempotency logic and its
 * documented timestamp limitation (Meet exposes no true "original join
 * time" for someone already in the call before the bot arrived).
 *
 * snapshotTime: defaults to "now" (this function's own call time) but the
 * caller (GoogleMeetAdapter.joinGoogleMeet) passes the moment the BOT ITSELF
 * joined the meeting instead - captured before the human-detection wait and
 * the People-panel-open/DOM-read above, both of which take a variable amount
 * of time. Anchoring to the bot's own join moment keeps the recorded
 * attendance time from drifting later depending on how long that detection/
 * DOM work happened to take on any given run.
 */
async function captureInitialParticipants(page, botName, tracker, snapshotTime = new Date()) {
  try {
    await openPeoplePanel(page);

    let names = await getCurrentParticipantNames(page, botName);

    // DOM can still be settling immediately after join; give it one retry
    // rather than reporting "meeting was empty" on a false negative.
    if (!names || names.length === 0) {
      await new Promise(r => setTimeout(r, 1500));
      names = await getCurrentParticipantNames(page, botName);
    }

    // Name extraction can still come up empty even though someone real IS in
    // the call (Meet doesn't always expose a readable label - see the
    // diagnostic log in getCurrentParticipantNames). This is logged for
    // visibility only - NOT used to fabricate a placeholder participant row
    // (tile/roster counts proved unreliable as a naming source, see
    // isPlausibleParticipantName's history) - their attendance will still be
    // picked up by the next tick once a real name becomes readable.
    if (!names || names.length === 0) {
      const info = await getParticipantCountDebug(page);
      if (isHumanPresentFromCountInfo(info)) {
        logger.warn(
          `GoogleMeetAdapter(monitor): INITIAL_ROSTER: name extraction found nobody but tile/roster count indicates a real participant is present ` +
          `(nonSelfTiles=${info.nonSelfTiles}, rosterWithIdCount=${info.rosterWithIdCount}, avatarCount=${info.avatarCount}, tileCount=${info.tileCount}, countFromLabel=${info.countFromLabel}) - not recording a placeholder, waiting for a real name.`
        );
      }
    }

    return await tracker.handleInitialRoster(names, snapshotTime);
  } catch (err) {
    logger.error('GoogleMeetAdapter(monitor): INITIAL_ROSTER: capture failed, continuing without it:', err.message);
    return [];
  }
}

/**
 * NEW: lightweight one-off check for whether at least one real human
 * participant is currently visible on the page. Used by
 * socraticbot.js's waitForHumanParticipant() to gate recording/Python
 * processing on a real participant joining (see Request 4: "Don't process
 * when only the bot joins").
 *
 * FIX: getCurrentParticipantNames() alone was under-detecting real humans
 * during this early "just joined, People panel closed" window — its
 * Strategy 1 (roster [role="listitem"]) only finds anything once the People
 * panel has actually been opened, and its Strategy 2 (video tiles) depends
 * on the tile exposing aria-label/data-name/title, which current Meet
 * doesn't always set on the tile element itself. That meant a bot could sit
 * in a meeting with two real humans on screen and still see an empty names
 * array on every single poll (as reported: 40+ checks, 117s+, none
 * detected, despite both humans visibly present in the tiles/captions).
 *
 * So this now falls back to COUNT-based checks (getParticipantCountDebug) that
 * are self-aware: any tile that is NOT the bot's own self-view (data-self-name)
 * counts as a human. This stays correct even when the bot's camera is muted —
 * Meet then omits the self-view tile, so the robot DID NOT render any tile and
 * the single visible tile is the human (the old playerCount > 1 check missed it).
 */
async function hasHumanJoined(page, botName) {
  try {
    const names = await getCurrentParticipantNames(page, botName);
    if (Array.isArray(names) && names.length > 0) {
      return true;
    }

    // Name-based extraction found nothing — fall back to COUNT-based checks.
    // IMPORTANT: we cannot assume '1' means 'just the bot'. When the bot's
    // camera is muted Google Meet omits the self-view tile, so a single
    // visible tile is actually the HUMAN. Detect by excluding self-tiles
    // (data-self-name) rather than comparing participantCount > 1.
    const info = await getParticipantCountDebug(page);
    const humanPresent = isHumanPresentFromCountInfo(info);

    if (!humanPresent) {
      logger.debug(
        `GoogleMeetAdapter(monitor): hasHumanJoined: no names and nobody detected ` +
        `(participantIdCount=${info.participantIdCount}, selfTileCount=${info.selfTileCount}, ` +
        `nonSelfTiles=${info.nonSelfTiles}, rosterWithIdCount=${info.rosterWithIdCount}, ` +
        `rosterCount=${info.rosterCount}, tileCount=${info.tileCount}, countFromLabel=${info.countFromLabel}).`
      );
    }

    return humanPresent;
  } catch (err) {
    logger.debug('GoogleMeetAdapter(monitor): hasHumanJoined check failed:', err.message);
    return false;
  }
}

async function monitorMeeting(page, meetingId, botName, sessionId, participantTracker, initialParticipants = []) {
  logger.info('GoogleMeetAdapter(monitor): MONITOR: Stay-Alive loop started');

  const tracker = participantTracker || new ParticipantTracker(meetingId, sessionId);
  // Seed the diff baseline with whoever captureInitialParticipants() already
  // recorded before this loop started, so the first poll doesn't log them
  // again as "new" joins (handleParticipantJoin's already_joined branch
  // would make that a harmless no-op either way, but seeding keeps the
  // logs/diffing honest about what's actually new).
  let previousParticipants = Array.isArray(initialParticipants)
    ? [...new Set(initialParticipants)]
    : [];

  // SPEED FIX: join/leave detection used to be gated behind the SAME 10s
  // sleep as the heavier "is the bot alone" People-panel-click check below -
  // both branches of the old loop ended with `setTimeout(..., 10000)` before
  // looping back, so a join or leave could sit undetected (and therefore
  // unwritten to participants/participant_attendance_sessions) for up to
  // ~10s even though the old PARTICIPANT_CHECK_INTERVAL said "every 5s" -
  // that 5s number was never actually reachable because the loop itself
  // never ticked faster than 10s.
  //
  // LOOP_TICK_MS is now the loop's own fast cadence, and attendance
  // detection (4a below) runs on EVERY tick - there is nothing left gating
  // it, so a join/leave is written to the DB on the very next tick after it
  // becomes visible in the DOM (worst case ~LOOP_TICK_MS late, not ~10s).
  // The heavier leave-signal/alone-check (step 5, which clicks the People
  // panel) deliberately stays on its own slower ALONE_CHECK_INTERVAL - it
  // doesn't need to be fast (it only decides whether the BOT should leave an
  // empty meeting) and clicking that button every ~1s would be needlessly
  // invasive to the UI it's scraping.
  const LOOP_TICK_MS = 2000;
  const ALONE_CHECK_INTERVAL = 10000;
  let lastAloneCheckTime = 0; // 0 forces the alone-check to also run on the very first tick

  let loopCount = 0;
  const startedAt = Date.now();
  let aloneSinceMs = null;
  const ALONE_GRACE_MS = 10000;
  const ALONE_SUSTAIN_MS = 10000;
  let lastLeaveSignalAt = 0;

  // Tracks recent leaves seen by step 4a's roster diff (the already-correct,
  // already-running join/leave detector) so step 5's LEAVE_SIGNAL log below
  // can say WHICH participant left instead of just "someone left". Entries
  // are pruned to the last RECENT_LEAVE_WINDOW_MS so this array never grows
  // unbounded over a long-running meeting.
  let recentLeaves = [];
  const RECENT_LEAVE_WINDOW_MS = 15000;

  try {
    while (true) {
      // 1. Page closed
      if (page.isClosed()) {
        await finalizeAttendanceOnExit(tracker, meetingId, "Page closed → Closing out attendance and exporting final transcript");
        break;
      }

      const url = page.url();

      // 2. Left Meet page
      if (!url.includes('meet.google.com')) {
        await finalizeAttendanceOnExit(tracker, meetingId, "Navigated away from Meet → Closing out attendance and exporting");
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
        await finalizeAttendanceOnExit(tracker, meetingId, "Meeting end detected → Closing out attendance and exporting");
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

      // 4a. ATTENDANCE TRACKING: runs every tick (see SPEED FIX above) - a
      // detected join/leave is persisted to participants/
      // participant_attendance_sessions immediately after this DOM read,
      // with no artificial delay before the DB write.
      try {
        const currentParticipants = await getCurrentParticipantNames(page, botName);

        // Detect joins (new participants) - also covers rejoin: a name that
        // left (removed from previousParticipants below) and later
        // reappears here is routed through handleParticipantJoin() again,
        // which recognizes the tracked-but-'left' state and opens a NEW
        // participant_attendance_sessions row via recordParticipantRejoin()
        // instead of creating a duplicate participants row or reusing the
        // already-closed session.
        for (const name of currentParticipants) {
          if (!previousParticipants.includes(name)) {
            await tracker.handleParticipantJoin(name);
          }
        }

        // Detect leaves (participants no longer in list)
        for (const name of previousParticipants) {
          if (!currentParticipants.includes(name)) {
            await tracker.handleParticipantLeave(name);

            // Record this leave so step 5's LEAVE_SIGNAL check (below) can
            // identify WHO left, not just that someone did. Pruned to the
            // last RECENT_LEAVE_WINDOW_MS on every push - this stays a
            // handful of entries at most.
            const leftAt = Date.now();
            recentLeaves.push({ name, at: leftAt });
            recentLeaves = recentLeaves.filter(l => leftAt - l.at < RECENT_LEAVE_WINDOW_MS);
          }
        }

        previousParticipants = [...currentParticipants];
      } catch (err) {
        logger.debug('GoogleMeetAdapter(monitor): Error in attendance tracking:', err.message);
      }

      // 5. Leave-signal / alone-check: kept on its own slower
      // ALONE_CHECK_INTERVAL cadence (see SPEED FIX above) - this only
      // decides whether the bot itself should leave an empty meeting, and
      // getParticipantCountDebug() clicks the People panel button, which
      // doesn't need to happen on every fast tick.
      const now = Date.now();
      if (now - lastAloneCheckTime >= ALONE_CHECK_INTERVAL) {
        lastAloneCheckTime = now;

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

        if (leaveSignal) {
          if (Date.now() - lastLeaveSignalAt > 10000) {
            lastLeaveSignalAt = Date.now();
            logger.info("GoogleMeetAdapter(monitor): LEAVE_SIGNAL detected; running participant count check...");

            // Identify WHICH participant left. Two sources, checked in order:
            //  1) recentLeaves - populated by step 4a's roster diff (the
            //     already-correct, already-running join/leave detector) -
            //     this is the authoritative source since it's the same diff
            //     that already writes the leave to the DB.
            //  2) fallback: regex over the raw (non-lowercased) page text for
            //     Meet's own "<Name> has left the meeting" / "<Name> left the
            //     meeting" toast wording, in case the roster diff hasn't
            //     caught up yet (UI toast can appear before the DOM roster
            //     entry is actually removed).
            const sinceRecent = Date.now() - RECENT_LEAVE_WINDOW_MS;
            const namesFromRoster = [...new Set(
              recentLeaves.filter(l => l.at >= sinceRecent).map(l => l.name)
            )];

            let leavingNames = namesFromRoster;
            if (leavingNames.length === 0) {
              try {
                const rawText = await page.evaluate(() => document.body.innerText || '');
                const toastRe = /([A-Z][A-Za-z0-9 .'’-]{1,60}?)\s+(?:has left the meeting|left the meeting)/g;
                const namesFromToast = [];
                let m;
                while ((m = toastRe.exec(rawText)) !== null) {
                  const candidate = m[1].trim();
                  if (candidate) namesFromToast.push(candidate);
                }
                leavingNames = [...new Set(namesFromToast)];
              } catch (err) {
                logger.debug('GoogleMeetAdapter(monitor): Error extracting leaving participant name from page text:', err.message);
              }
            }

            if (leavingNames.length > 0) {
              for (const name of leavingNames) {
                logger.info(`GoogleMeetAdapter(monitor): Participant left: ${name}`);
              }
            } else {
              logger.info("GoogleMeetAdapter(monitor): Participant left: (unable to identify name)");
            }
          }

          const pc = await getParticipantCountDebug(page);
          const participantCount = pc.participantCount;

          logger.info(
            `GoogleMeetAdapter(monitor): ALONE_CHECK: participants=${participantCount}, aloneMsg=${isAloneMessage}, ` +
            `clickedPeople=${pc.clickedPeople}, peoplePanelOpened=${pc.peoplePanelOpened}, clickedSelector=${JSON.stringify(pc.clickedSelector)}, ` +
            `peopleLabel=${JSON.stringify(pc.peopleLabel)}, labelCount=${pc.countFromLabel}, avatarCount=${pc.avatarCount}, rosterCount=${pc.rosterCount}, tileCount=${pc.tileCount}, ` +
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
                await finalizeAttendanceOnExit(tracker, meetingId, "Bot alone sustained -> Closing out attendance, exporting and closing.");
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
        }
      }

      // 6. Sleep loop (fast tick - see SPEED FIX above)
      await new Promise(r => setTimeout(r, LOOP_TICK_MS));

      loopCount++;
      const ticksPerMinute = Math.round(60000 / LOOP_TICK_MS);
      if (loopCount % ticksPerMinute === 0) {
        logger.info(`GoogleMeetAdapter(monitor): MONITOR: Alive ${loopCount / ticksPerMinute}m`);
      }
    }

  } catch (error) {
    logger.error(`GoogleMeetAdapter(monitor): MONITOR ERROR: ${error.message}`);
    // MEETING-END SCENARIO: the loop crashed instead of exiting through one
    // of the normal EXIT branches above (each of which already closes out
    // attendance via finalizeAttendanceOnExit) — still close out anyone left
    // "joined" so an unexpected monitor error doesn't leave attendance rows
    // open forever.
    try {
      await tracker.reset();
    } catch (resetErr) {
      logger.error('GoogleMeetAdapter(monitor): Error closing out attendance after monitor crash:', resetErr);
    }
  }

  if (keepAliveInterval) clearInterval(keepAliveInterval);

  logger.info("GoogleMeetAdapter(monitor): MEETING ENDED: Full transcript exported to storage/");
}

/**
 * MEETING-END SCENARIO: run once, from every exit path of the monitor loop
 * below, so a participant who is still "joined" when the bot leaves/the
 * meeting ends gets their attendance session closed with a leave time
 * instead of being left open forever. tracker.reset() (participantTracker.js)
 * persists a leave for anyone still marked "joined" before clearing its
 * in-memory map — see that file for why this reuses handleParticipantLeave()
 * rather than a separate write path.
 */
async function finalizeAttendanceOnExit(tracker, meetingId, reason) {
  logger.info(`GoogleMeetAdapter(monitor): EXIT: ${reason}`);
  try {
    await tracker.reset();
  } catch (err) {
    logger.error(`GoogleMeetAdapter(monitor): Error closing out attendance on exit (${reason}):`, err);
  }
  await exportMeetingTranscript(meetingId);
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
  exportMeetingTranscript,
  getCurrentParticipantNames,
  hasHumanJoined,
  captureInitialParticipants,
  openPeoplePanel
};
