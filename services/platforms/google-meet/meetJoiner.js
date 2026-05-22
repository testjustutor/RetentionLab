const { logger } = require('../../../utils/logger');
const fs = require('fs');
const path = require('path');

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
    if (!confirmed) {
      await this.page.screenshot({ path: 'meet_stuck.png' });
      logger.error('GoogleMeetAdapter(meetJoiner): join confirmation failed');
      throw new Error('Google Meet join confirmation failed');
    }
  }

  // -----------------------------
  // PRE JOIN CLEANUP
  // -----------------------------
  async handlePreJoinScreen() {
    logger.info('GoogleMeetAdapter(meetJoiner): Handling pre-join screen...');

    try {
      await this.page.evaluate(() => {
        const clickIfExists = (selectors) => {
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) el.click();
          }
        };

        clickIfExists([
          '[aria-label*="camera"]',
          '[aria-label*="microphone"]',
          'button[aria-label*="Turn off"]'
        ]);
      });

      await new Promise(r => setTimeout(r, 1500));

    } catch (e) {
      logger.info('GoogleMeetAdapter(meetJoiner): Pre-join cleanup skipped');
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
    logger.info('GoogleMeetAdapter(meetJoiner): Waiting for Meet session to load...');

    for (let i = 0; i < 15; i++) {
      const ok = await this.page.evaluate(() => {
        const hasLeaveButton = !!document.querySelector('button[aria-label*="Leave call"], button[aria-label*="Leave meeting"], button[aria-label*="Hang up"], button[aria-label*="End call"], button[data-tooltip*="Leave call"], button[data-tooltip*="Leave meeting"], button[data-tooltip*="Hang up"], button[data-tooltip*="End call"]');
        const hasChatButton = !!document.querySelector('button[aria-label*="Chat"], button[data-tooltip*="Chat"], [aria-label*="Chat with everyone"], [data-tooltip*="Open chat"]');
        const hasPeoplePanel = !!document.querySelector('button[aria-label*="People"], button[aria-label*="Participants"], [data-tooltip*="Show everyone"], [data-tooltip*="People"]');
        const hasPresentButton = !!document.querySelector('button[aria-label*="Present now"], button[data-tooltip*="Present now"]');
        const url = window.location.href;
        const isMeetUrl = url.includes('meet.google.com');
        const isPreview = url.includes('/preview') || url.includes('/join');
        const hasJoinBtn = !!document.querySelector('button[aria-label*="Join now"], button[aria-label*="Ask to join"], button[data-tooltip*="Join now"], button[data-tooltip*="Ask to join"]');

        return hasLeaveButton || hasChatButton || hasPeoplePanel || hasPresentButton || (isMeetUrl && !isPreview && !hasJoinBtn);
      });

      if (ok) {
        logger.info('GoogleMeetAdapter(meetJoiner): Successfully joined Google Meet');
        return true;
      }

      await new Promise(r => setTimeout(r, 3000));
    }

    logger.warn('GoogleMeetAdapter(meetJoiner): Could not confirm join state');
    return false;
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
            'button[jsname="RrG0hf"]',
            'button[aria-label*="caption"]',
            'button[aria-label*="subtitles"]',
            'button[data-tooltip*="caption"]',
            'button[data-tooltip*="subtitles"]',
            'button[data-tooltip*="Turn on captions"]',
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
                this.handleCaptionEvent(line);
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