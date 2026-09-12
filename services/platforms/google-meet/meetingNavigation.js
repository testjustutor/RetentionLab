/**
 * services/platforms/google-meet/meetingNavigation.js
 *
 * STAGE/STATE LOGGING: both functions here run with `this` bound to the
 * MeetJoiner instance (see meetJoiner.js's prototype bindings), so besides
 * their own info logs they also report into that joiner's shared stage
 * timeline via this._setStage(...) where useful, and waitForJoinConfirmation()
 * additionally logs every MEET_STATE transition explicitly (not just every
 * Nth poll like the existing KNOCKING/HANDSHAKE logs already did) so a stuck
 * bot's exact state history is visible in the log without guessing.
 */
const { logger } = require('../../../utils/logger');
const settings = require('../../../config/settings');

async function enterMeeting() {
  logger.info('GoogleMeetJoiner(meetingNavigation): Entering Meet session...');

  let joined = false;

  for (let i = 0; i < 20 && !joined; i++) {
    const state = await this.page.evaluate(() => {
      const getBtn = (keywords) =>
        Array.from(document.querySelectorAll('button'))
          .find(b => (b.innerText || '').toLowerCase().includes(keywords));

      const nameInput = document.querySelector('input[type="text"], input[aria-label*="name"]');

      const joinBtn =
        getBtn('ask to join') ||
        getBtn('join now') ||
        getBtn('request to join') ||
        getBtn('join') ||
        getBtn('enter');

      return {
        hasNameInput: !!nameInput,
        hasJoinBtn: !!joinBtn,
        joinBtnText: joinBtn ? joinBtn.innerText : null,
        allButtons: Array.from(document.querySelectorAll('button')).map(b => b.innerText).slice(0, 10)
      };
    });

    logger.info(`Attempt ${i + 1}: hasNameInput=${state.hasNameInput}, hasJoinBtn=${state.hasJoinBtn}, joinBtnText=${state.joinBtnText}`);

    if (state.hasNameInput) {
      await this.page.type('input[type="text"]', this.botName);
      logger.info('GoogleMeetJoiner(meetingNavigation): Name typed into name field');
    }

    if (state.hasJoinBtn) {
      await this.page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => (b.innerText || '').match(/ask to join|join now|request to join/i));
        if (btn) btn.click();
      });

      logger.info('GoogleMeetJoiner(meetingNavigation): Join button clicked');

      const stateCheck = await this.page.evaluate(() => {
        const hasAskToJoin = !!document.querySelector('button[aria-label*="Ask to join"]');
        const hasJoinNow = !!document.querySelector('button[aria-label*="Join now"], button[aria-label*="Ask to join"], button[data-tooltip*="Join now"], button[data-tooltip*="Ask to join"]');
        return { stillLobby: hasAskToJoin || hasJoinNow, url: window.location.href };
      });

      logger.info(`GoogleMeetJoiner(meetingNavigation): POST-JOIN STATE stillLobby=${stateCheck.stillLobby}`);
      joined = true;
    }

    await new Promise(r => setTimeout(r, 3000));
  }

  if (!joined) {
    if (typeof this._setStage === 'function') this._setStage('enter_meeting_failed');
    await this.page.screenshot({ path: 'meet_stuck.png' });
    logger.error('GoogleMeetJoiner(meetingNavigation): Meet join failed');
    throw new Error('Google Meet join failed');
  }

  logger.info('GoogleMeetJoiner(meetingNavigation): Meeting form submitted (name entered / join requested)');
}

async function waitForJoinConfirmation() {
  logger.info('GoogleMeetJoiner(meetingNavigation): STAGE: waitForJoinConfirmation started');

  const MEET_STATE = {
    INIT: 'INIT', JOINING: 'JOINING', LOBBY: 'LOBBY',
    IN_MEETING: 'IN_MEETING', REJECTED: 'REJECTED', FAILED: 'FAILED'
  };

  let state = MEET_STATE.INIT;
  let inMeetingStreak = 0;
  // Total lobby/waiting-room window comes from .env (BOT_HOST_WAIT_TIMEOUT_MS)
  // via config/settings.js — a single shared value for all platforms.
  // Poll cadence stays at 3 s (see sleep below).
  const maxAttempts = Math.max(1, Math.ceil(settings.bot.hostWaitTimeoutMs / 3000));

  // Logs a line EVERY TIME the MEET_STATE actually changes (not on every 3s
  // poll tick that stays in the same state) - this is the join lifecycle
  // state machine, so its transitions are worth a clear, always-on record.
  // Also mirrors into the owning MeetJoiner's own stage timeline, when this
  // is called bound to one (see meetJoiner.js), so both state machines read
  // as one consistent history.
  const setState = (next) => {
    if (next !== state) {
      logger.info(`GoogleMeetJoiner(meetingNavigation): STATE CHANGE: ${state} -> ${next}`);
      state = next;
      if (typeof this?._setStage === 'function') {
        this._setStage(`meet_state_${next.toLowerCase()}`);
      }
    }
    return state;
  };

  for (let i = 0; i < maxAttempts; i++) {
    const snapshot = await this.page.evaluate(() => {
      const bodyText = (document.body?.innerText || '').toLowerCase();
      const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
      const getText = (el) => [el.getAttribute('aria-label'), el.getAttribute('data-tooltip'), el.getAttribute('title'), el.innerText].filter(Boolean).join(' ').toLowerCase();

      const hasLeaveButton = buttons.some(button => {
        const text = getText(button);
        return text.includes('leave call') || text.includes('leave meeting') || text.includes('hang up') || text.includes('end call');
      });

      const hasJoinBtn = buttons.some(button => {
        const text = getText(button);
        return /\b(ask to join|join now|request to join|join meeting)\b/i.test(text);
      });

      const isWaitingToBeLetIn = bodyText.includes('someone will let you in') || bodyText.includes('wait for the host') || bodyText.includes('asking to join...');
      const isRejected = bodyText.includes("can't join") || bodyText.includes("meeting is full") || bodyText.includes("you were removed") || !!document.querySelector('[role="dialog"][aria-label*="cannot"]');

      const hasInMeetingUI = hasLeaveButton || buttons.some(button => {
        const text = getText(button);
        return text.includes('people') || text.includes('show everyone') || text.includes('chat') || text.includes('turn on captions');
      }) || !!document.querySelector('[data-self-name], [data-allocation-index], [data-grid-item-id], [aria-live="polite"]');

      const isTransitioning = bodyText.includes('joining...') || bodyText.includes('getting ready') || bodyText.includes('please wait');

      return { hasLeaveButton, hasJoinBtn, isWaitingToBeLetIn, isRejected, hasInMeetingUI, isTransitioning };
    });

    if (snapshot.isRejected) {
      setState(MEET_STATE.REJECTED);
      logger.error('GoogleMeetJoiner(meetingNavigation): Host/meeting rejected the bot (REJECTED)');
      return { success: false, state };
    }

    if (snapshot.hasInMeetingUI && !snapshot.hasJoinBtn && !snapshot.isWaitingToBeLetIn && !snapshot.isTransitioning) {
      inMeetingStreak++;
      if (inMeetingStreak >= 2) {
        setState(MEET_STATE.IN_MEETING);
        logger.info('GoogleMeetJoiner(meetingNavigation): MEETING confirmed (IN_MEETING)');
        return { success: true, state };
      }
      logger.info(`GoogleMeetJoiner(meetingNavigation): stream stability... (Streak: ${inMeetingStreak}/2)`);
    } else {
      inMeetingStreak = 0;
    }

    if (snapshot.isWaitingToBeLetIn || snapshot.hasJoinBtn) {
      setState(MEET_STATE.LOBBY);
      if ((i + 1) % 5 === 0) {
        logger.info(`GoogleMeetJoiner(meetingNavigation): LOBBY / KNOCKING (attempt ${i + 1}/${maxAttempts})`);
      }
    } else {
      setState(MEET_STATE.JOINING);
      if ((i + 1) % 5 === 0) {
        logger.info(`GoogleMeetJoiner(meetingNavigation): JOINING / HANDSHAKE (attempt ${i + 1}/${maxAttempts})`);
      }
    }

    await new Promise(r => setTimeout(r, 3000));
  }

  setState(MEET_STATE.FAILED);
  logger.error(`GoogleMeetJoiner(meetingNavigation): FAILED - no join confirmation after ${maxAttempts} attempts`);
  return { success: false, state: MEET_STATE.FAILED };
}

module.exports = { enterMeeting, waitForJoinConfirmation };
