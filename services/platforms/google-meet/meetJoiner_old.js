const { logger } = require('../../../utils/logger');
const fs = require('fs');

class MeetJoiner {
  constructor(page, botName, meetingUrl) {
    this.page = page;
    this.botName = botName;
    this.meetingUrl = meetingUrl;

    this.captionInterval = null;
    this.isStopping = false;

    this.transcriptBuffer = [];
    this.seenRows = new Set();
  }

  setParticipantTracker(tracker) {
    this.participantTracker = tracker;
  }

  async joinMeeting() {
    logger.info('GoogleMeetAdapter(meetJoiner): STAGE 1: Navigating to Google Meet (Deep Scan Flow)...');

    await this.page.goto(this.meetingUrl, {
      waitUntil: 'networkidle2'
    });

    await this.handlePreJoinScreen();
    await this.enterMeeting();

    const confirmed = await this.waitForJoinConfirmation();
    if (!confirmed.success) {
      await this.page.screenshot({ path: 'meet_stuck.png' });
      logger.error(`GoogleMeetAdapter(meetJoiner): join confirmation failed (${confirmed.state})`);
      throw new Error(`Google Meet join confirmation failed (${confirmed.state})`);
    }
  }

  // -----------------------------
  // PRE JOIN CLEANUP
  // -----------------------------
  async handlePreJoinScreen() {
    logger.info('GoogleMeetAdapter(meetJoiner): Handling pre-join screen...');

    try {
      const result = await this.page.evaluate(async () => {
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();

        const getButtonText = (button) => normalize([
          button.getAttribute('aria-label'),
          button.getAttribute('data-tooltip'),
          button.getAttribute('data-tooltip-id'),
          button.getAttribute('title'),
          button.innerText
        ].filter(Boolean).join(' '));

        const getControlState = (kind) => {
          const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
          const control = buttons.find(button => {
            const text = getButtonText(button);
            return text.includes(kind) || (kind === 'microphone' && text.includes('mic'));
          });

          if (!control) {
            return { found: false, isOff: false, label: null };
          }

          const label = getButtonText(control);
          const isOff =
            label.includes(`turn on ${kind}`) ||
            (kind === 'microphone' && label.includes('turn on mic')) ||
            label.includes(`${kind} is off`) ||
            (kind === 'microphone' && label.includes('microphone is muted')) ||
            (kind === 'microphone' && label.includes('mic is off'));

          const isOn =
            label.includes(`turn off ${kind}`) ||
            (kind === 'microphone' && label.includes('turn off mic')) ||
            label.includes(`${kind} is on`) ||
            (kind === 'microphone' && label.includes('microphone is on')) ||
            (kind === 'microphone' && label.includes('mic is on'));

          return { found: true, isOff, isOn, label, control };
        };

        const ensureOff = async (kind) => {
          let state = getControlState(kind);

          for (let attempt = 0; attempt < 5; attempt++) {
            if (state.found && state.isOff) {
              return { kind, success: true, label: state.label, clicked: attempt > 0 };
            }

            if (state.found && state.isOn) {
              state.control.click();
              await sleep(700);
            } else {
              await sleep(700);
            }

            state = getControlState(kind);
          }

          return {
            kind,
            found: state.found,
            success: state.found ? state.isOff : true, // IMPORTANT FIX
            label: state.label,
            clicked: false
          };
        };

        const camera = await ensureOff('camera');
        const microphone = await ensureOff('microphone');

        return { camera, microphone };
      });

      logger.info(`GoogleMeetAdapter(meetJoiner): Pre-join media state: ${JSON.stringify(result)}`);

      const cameraOk = result.camera?.success || result.camera?.found === false;
      const micOk = result.microphone?.success || result.microphone?.found === false;

      if (!cameraOk || !micOk) {
        logger.warn(
          `GoogleMeetAdapter(meetJoiner): Media state uncertain (headless mode), continuing anyway: ${JSON.stringify(result)}`
        );
      }

    } catch (e) {
      logger.error('GoogleMeetAdapter(meetJoiner): Pre-join media setup failed:', e.message);
      throw e;
    }
  }

  // -----------------------------
  // ENTER + JOIN
  // -----------------------------
  async enterMeeting() {
    logger.info('GoogleMeetAdapter(meetJoiner): Entering Meet session...');

    let joined = false;

    for (let i = 0; i < 20 && !joined; i++) {

      const state = await this.page.evaluate(() => {

        const getBtn = (keywords) =>
          Array.from(document.querySelectorAll('button'))
            .find(b =>
              (b.innerText || '').toLowerCase().includes(keywords)
            );

        const nameInput =
          document.querySelector('input[type="text"], input[aria-label*="name"]');

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
      if (state.allButtons.length > 0) {
        logger.info(`GoogleMeetAdapter(meetJoiner): Available buttons: ${state.allButtons.join(', ')}`);
      }

      if (state.hasNameInput) {
        await this.page.type('input[type="text"]', this.botName);
      }

      if (state.hasJoinBtn) {
        await this.page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button'))
            .find(b =>
              (b.innerText || '').match(/ask to join|join now|request to join/i)
            );

          if (btn) btn.click();
        });

        logger.info('GoogleMeetAdapter(meetJoiner): Join button clicked');

        const stateCheck = await this.page.evaluate(() => {
          const hasAskToJoin = !!document.querySelector('button[aria-label*="Ask to join"]');
          const hasJoinNow = !!document.querySelector('button[aria-label*="Join now"], button[aria-label*="Ask to join"], button[data-tooltip*="Join now"], button[data-tooltip*="Ask to join"]');
          const url = window.location.href;

          return {
            stillLobby: hasAskToJoin || hasJoinNow,
            url
          };
        });

        logger.info(`GoogleMeetAdapter(meetJoiner): POST-JOIN STATE stillLobby=${stateCheck.stillLobby}`);
        joined = true;
      }

      await new Promise(r => setTimeout(r, 3000));
    }

    if (!joined) {
      await this.page.screenshot({ path: 'meet_stuck.png' });
      logger.error('GoogleMeetAdapter(meetJoiner): Meet join failed');
      throw new Error('Google Meet join failed');
    }
  }

  // -----------------------------
  // WAIT JOIN CONFIRMATION
  // -----------------------------
  async waitForJoinConfirmation() {
    logger.info('GoogleMeetAdapter: Waiting for Meet session...');

    const MEET_STATE = {
      INIT: 'INIT',
      JOINING: 'JOINING',
      LOBBY: 'LOBBY',
      IN_MEETING: 'IN_MEETING',
      REJECTED: 'REJECTED',
      FAILED: 'FAILED'
    };

    let state = MEET_STATE.INIT;
    let inMeetingStreak = 0;

    const maxAttempts = 300; // 15 minutes at 3 seconds per attempt.

    for (let i = 0; i < maxAttempts; i++) {

      const snapshot = await this.page.evaluate(() => {
        const bodyText = (document.body?.innerText || '').toLowerCase();

        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        const getText = (el) => [
          el.getAttribute('aria-label'),
          el.getAttribute('data-tooltip'),
          el.getAttribute('title'),
          el.innerText
        ].filter(Boolean).join(' ').toLowerCase();

        const hasLeaveButton = buttons.some(button => {
          const text = getText(button);
          return text.includes('leave call') ||
            text.includes('leave meeting') ||
            text.includes('hang up') ||
            text.includes('end call');
        });

        const hasJoinBtn = buttons
          .some(button => {
            const text = getText(button);
            return /\b(ask to join|join now|request to join|join meeting)\b/i.test(text);
          });

        const isWaitingToBeLetIn =
          bodyText.includes('someone will let you in') ||
          bodyText.includes('wait for the host') ||
          bodyText.includes('asking to join...');

        const isRejected =
          bodyText.includes("can't join") ||
          bodyText.includes("meeting is full") ||
          bodyText.includes("you were removed") ||
          !!document.querySelector('[role="dialog"][aria-label*="cannot"]');

        const hasInMeetingUI =
          hasLeaveButton ||
          buttons.some(button => {
            const text = getText(button);
            return text.includes('people') ||
              text.includes('show everyone') ||
              text.includes('chat') ||
              text.includes('present now') ||
              text.includes('raise hand') ||
              text.includes('turn on captions') ||
              text.includes('turn off captions') ||
              text.includes('turn on microphone') ||
              text.includes('turn off microphone') ||
              text.includes('turn on camera') ||
              text.includes('turn off camera');
          }) ||
          !!document.querySelector('[data-self-name], [data-allocation-index], [data-grid-item-id], [aria-live="polite"]');

        const isTransitioning =
          bodyText.includes('joining...') ||
          bodyText.includes('getting ready') ||
          bodyText.includes('please wait');

        return {
          hasLeaveButton,
          hasJoinBtn,
          isWaitingToBeLetIn,
          isRejected,
          hasInMeetingUI,
          isTransitioning
        };
      });

      // 1. REJECTION EXITS
      if (snapshot.isRejected) {
        state = MEET_STATE.REJECTED;
        logger.error('GoogleMeetAdapter: REJECTED by meeting');
        return { success: false, state };
      }

      // 2. STABILITY CONFIRMATION STREAKS
      if (snapshot.hasInMeetingUI && !snapshot.hasJoinBtn && !snapshot.isWaitingToBeLetIn && !snapshot.isTransitioning) {
        inMeetingStreak++;

        if (inMeetingStreak >= 2) {
          state = MEET_STATE.IN_MEETING;
          logger.info('GoogleMeetAdapter: IN MEETING confirmed');
          return { success: true, state };
        }
        logger.info(`GoogleMeetAdapter: Verifying stream stability... (Streak: ${inMeetingStreak}/2)`);
      } else {
        inMeetingStreak = 0;
      }

      // 3. LOBBY STATE ROUTING
      if (snapshot.isWaitingToBeLetIn || snapshot.hasJoinBtn) {
        state = MEET_STATE.LOBBY;
        logger.info(`GoogleMeetAdapter: LOBBY / KNOCKING (attempt ${i + 1}/${maxAttempts})`);
      } else {
        state = MEET_STATE.JOINING;
        logger.info(`GoogleMeetAdapter: JOINING / HANDSHAKE (attempt ${i + 1}/${maxAttempts})`);
      }

      await new Promise(r => setTimeout(r, 3000));
    }

    state = MEET_STATE.FAILED;
    logger.warn('GoogleMeetAdapter: TIMEOUT waiting for join');
    return { success: false, state };
  }

  // -----------------------------
  // CAPTIONS ENABLE
  // -----------------------------
  async enableCaptionsIfPossible() {
    logger.info('GoogleMeetAdapter(meetJoiner): Searching Meet captions button...');

    try {
      const result = await this.page.evaluate(async () => {

        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        const normalize = (value) => (value || '').toLowerCase();

        const getButtonText = (el) => {
          const aria = el.getAttribute('aria-label') || '';
          const label = el.getAttribute('label') || '';
          const tooltip = el.getAttribute('data-tooltip-id') || ''; // Match Google's specific ID
          const inner = el.innerText || '';
          return `${aria} ${label} ${tooltip} ${inner}`.toLowerCase();
        };

        const findCaptionButton = () => {
          const directSelectors = [
            'button[aria-label*="captions"]',
            'button[aria-label*="caption"]',
            'button[aria-label*="subtitle"]',
            'button[aria-label*="subtitles"]',
            'button[data-tooltip*="caption"]',
            'button[data-tooltip*="captions"]',
            'button[data-tooltip*="subtitle"]',
            'button[data-tooltip*="subtitles"]',
            'button[data-tooltip*="Turn on caption"]',
            'button[data-tooltip*="Turn on captions"]',
            'button[data-tooltip*="Turn on subtitle"]',
            'button[data-tooltip*="Turn on subtitles"]'
          ];

          for (const selector of directSelectors) {
            const el = document.querySelector(selector);
            if (el) return { element: el, selector: selector };
          }

          const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
          const captionBtn = allButtons.find((btn) => {
            const text = getButtonText(btn);
            return text.includes('caption') || text.includes('subtitles');
          });

          return captionBtn ? { element: captionBtn, selector: 'text-search' } : null;
        };

        const findMoreOptionsButton = () => {
          const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
          const moreBtn = allButtons.find((btn) => {
            const text = getButtonText(btn);
            return text.includes('more options') || text.includes('more actions') || text.includes('options');
          });
          return moreBtn ? { element: moreBtn, selector: 'more-options' } : null;
        };

        const isClickable = (el) => {
          if (!el) return false;
          const style = window.getComputedStyle(el);
          return style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
        };

        let debugInfo = { attempts: [], foundButtons: [] };

        for (let i = 0; i < 10; i++) {
          const captionResult = findCaptionButton();
          if (captionResult && isClickable(captionResult.element)) {
            captionResult.element.click();
            return { status: 'CAPTIONS_ENABLED', debug: debugInfo };
          }

          if (i === 3) {
            const moreResult = findMoreOptionsButton();
            if (moreResult && isClickable(moreResult.element)) {
              moreResult.element.click();
              debugInfo.attempts.push('clicked more options');
            }
          }

          debugInfo.attempts.push(`attempt ${i + 1}: caption=${!!captionResult}, clickable=${captionResult ? isClickable(captionResult.element) : false}`);
          if (captionResult) {
            debugInfo.foundButtons.push({
              selector: captionResult.selector,
              text: getButtonText(captionResult.element),
              clickable: isClickable(captionResult.element)
            });
          }

          await sleep(1000);
        }

        return { status: 'CAPTIONS_NOT_FOUND', debug: debugInfo };
      });

      logger.info(`GoogleMeetAdapter(meetJoiner): Captions result: ${result.status}`);
      if (result.debug) {
        logger.info(`GoogleMeetAdapter(meetJoiner): Debug: ${JSON.stringify(result.debug)}`);
      }

    } catch (err) {
      logger.warn('GoogleMeetAdapter(meetJoiner): Caption enable failed:', err.message);
    }
  }

  // -----------------------------
  // 🚀 FIXED TRANSCRIPT MONITOR (MAIN FIX)
  // -----------------------------
  async startTranscriptMonitor(captionMonitor) {
    logger.info('GoogleMeetAdapter(meetJoiner): Starting Meet transcript monitor...');

    this.captionMonitor = captionMonitor;

    const INVALID_PATTERNS = [
      /camera not found/i,
      /microphone not found/i,
      /make sure your camera is plugged in/i,
      /try again/i,
      /raise hand/i,
      /present now/i,
      /controls/i,
      /you are muted/i,
      /you have joined the call/i,
      /your camera is off/i,
      /your microphone is off/i,
      /your hand is lowered/i,
      /there (is|are) .* other person/i,
      /no one else is in the call/i
    ];

    const isValid = (text) => {
      if (!text || text.trim().length < 2) return false;
      return !INVALID_PATTERNS.some(p => p.test(text));
    };

    this.captionInterval = setInterval(async () => {      if (this.isStopping || (this.page && this.page.isClosed && this.page.isClosed())) {
        if (this.captionInterval) {
          clearInterval(this.captionInterval);
          this.captionInterval = null;
        }
        return;
      }
      try {

        // ✅ FIX: target real Meet caption region instead of full DOM
        const captions = await this.page.evaluate(() => {

          const selectors = [
            '[aria-live="polite"]',
            '[jsname="dsyhDe"]',
            '[jsname="tgaKEf"]',
            '[class*="caption"]'
          ];

          let text = '';

          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.innerText) {
              text += el.innerText + '\n';
            }
          }

          return text.trim();
        });

        if (isValid(captions)) {

          const lines = captions
            .split('\n')
            .map(t => t.trim())
            .filter(Boolean);

          if (lines.length > 0) {
            const transcriptData = lines.map(line => ({
              name: 'Participant',
              text: line,
              time: new Date().toLocaleTimeString()
            }));

            if (this.captionMonitor) {
              await this.captionMonitor.processAndSaveTranscript(transcriptData);
            }

            for (const line of lines) {
              const key = `Participant:${line}`;
              if (!this.seenRows.has(key)) {
                this.seenRows.add(key);
                logger.info(`GoogleMeetAdapter(meetJoiner): CAPTION: ${line}`);
                this.transcriptBuffer.push({
                  name: 'Participant',
                  text: line,
                  time: new Date().toLocaleTimeString()
                });
                await this.handleCaptionEvent(line);
                if (this.captionMonitor && this.captionMonitor.filePath) {
                  try {
                    fs.appendFileSync(this.captionMonitor.filePath, `[${new Date().toLocaleTimeString()}] Participant: ${line}\n`);
                  } catch (err) {
                    logger.error('GoogleMeetAdapter(meetJoiner): File append error:', err.message);
                  }
                }
              }
            }

          }
        }

      } catch (err) {
        const nonFatal = /target closed|execution context|context was destroyed|page closed|cannot find context|cannot find object|protocol error/i;
        const message = err && err.message ? err.message : '';

        if (this.isStopping || (this.page && this.page.isClosed && this.page.isClosed()) || nonFatal.test(message)) {
          if (this.captionInterval) {
            clearInterval(this.captionInterval);
            this.captionInterval = null;
          }
          return;
        }

        logger.error('GoogleMeetAdapter(meetJoiner): caption error:', message || err);
      }
    }, 3000);
  }

  // -----------------------------
  // STOP + SAVE TRANSCRIPT
  // -----------------------------
  stopTranscriptMonitor() {    this.isStopping = true;    if (this.captionInterval) {
      clearInterval(this.captionInterval);
      this.captionInterval = null;
    }
  }

  getTranscript() {
    return this.transcriptBuffer;
  }

  async handleCaptionEvent(line) {
    if (!this.participantTracker) return;

    const text = line.trim();

    // JOIN EVENT
    const joinMatch = text.match(/(.+?) joined/i);
    if (joinMatch) {
      const name = joinMatch[1].trim();

      logger.info(`GoogleMeetAdapter(meetJoiner): JOIN detected from caption → ${name}`);

      await this.participantTracker.handleParticipantJoin(name);
      return;
    }

    // LEAVE EVENT
    const leaveMatch = text.match(/(.+?) (has )?left the meeting/i);
    if (leaveMatch) {
      const name = leaveMatch[1].trim();

      logger.info(`GoogleMeetAdapter(meetJoiner): LEAVE detected from caption → ${name}`);

      await this.participantTracker.handleParticipantLeave(name);
      return;
    }
  }
}

module.exports = MeetJoiner;
