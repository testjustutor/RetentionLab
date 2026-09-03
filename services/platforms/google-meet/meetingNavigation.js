/**
 * services/platforms/google-meet/meetingNavigation.js
 *
 */
const { logger } = require('../../../utils/logger');

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
    await this.page.screenshot({ path: 'meet_stuck.png' });
    logger.error('GoogleMeetJoiner(meetingNavigation): Meet join failed');
    throw new Error('Google Meet join failed');
  }
}

async function waitForJoinConfirmation() {
  logger.info('GoogleMeetJoiner:meetingNavigation for Meet session...');

  const MEET_STATE = {
    INIT: 'INIT', JOINING: 'JOINING', LOBBY: 'LOBBY',
    IN_MEETING: 'IN_MEETING', REJECTED: 'REJECTED', FAILED: 'FAILED'
  };

  let state = MEET_STATE.INIT;
  let inMeetingStreak = 0;
  const maxAttempts = 300; 

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
      state = MEET_STATE.REJECTED;
      logger.error('GoogleMeetJoiner:meetingNavigation by meeting');
      return { success: false, state };
    }

    if (snapshot.hasInMeetingUI && !snapshot.hasJoinBtn && !snapshot.isWaitingToBeLetIn && !snapshot.isTransitioning) {
      inMeetingStreak++;
      if (inMeetingStreak >= 2) {
        state = MEET_STATE.IN_MEETING;
        logger.info('GoogleMeetJoiner:meetingNavigation MEETING confirmed');
        return { success: true, state };
      }
      logger.info(`GoogleMeetJoiner:meetingNavigation stream stability... (Streak: ${inMeetingStreak}/2)`);
    } else {
      inMeetingStreak = 0;
    }

    if (snapshot.isWaitingToBeLetIn || snapshot.hasJoinBtn) {
      state = MEET_STATE.LOBBY;
      if ((i + 1) % 5 === 0) {
        logger.info(`GoogleMeetJoiner:meetingNavigation / KNOCKING (attempt ${i + 1}/${maxAttempts})`);
      }
    } else {
      state = MEET_STATE.JOINING;
      if ((i + 1) % 5 === 0) {
        logger.info(`GoogleMeetJoiner:meetingNavigation / HANDSHAKE (attempt ${i + 1}/${maxAttempts})`);
      }
    }

    await new Promise(r => setTimeout(r, 3000));
  }

  return { success: false, state: MEET_STATE.FAILED };
}

module.exports = { enterMeeting, waitForJoinConfirmation };