/**
 * root/services/platforms/teams/teamsJoiner.js
 *
 */
const { logger } = require('../../../utils/logger');

class TeamsJoiner {
  constructor(page, botName, meetingUrl, passcode) {
    this.page = page;
    this.botName = botName;
    this.meetingUrl = meetingUrl;
    this.passcode = passcode;

    this.captionMonitor = null;
    // FIX 2: allow socraticbot.js to inject a ParticipantTracker, matching
    // how google-meet's joiner is wired (joiner.setParticipantTracker(...))
    this.participantTracker = null;
  }

  // FIX 2: added — mirrors GoogleMeetJoiner's setParticipantTracker pattern
  setParticipantTracker(participantTracker) {
    this.participantTracker = participantTracker;
    logger.info('TeamsAdapter(teamJoiner): Participant tracker attached');
  }

  // -----------------------------
  // MAIN ENTRY
  // -----------------------------
  async joinMeeting() {
    logger.info('TeamsAdapter(teamJoiner): STAGE 1: Navigating to Microsoft Teams...');

    try {
      await this.page.setRequestInterception(true);
      this.page.removeAllListeners('request');

      this.page.on('request', (request) => {
        try {
          const url = request.url();
          if (
            url.startsWith('msteams:') ||
            url.startsWith('teamscmd:') ||
            url.startsWith('ms-teams:')
          ) {
            logger.info('TeamsAdapter(teamJoiner): Blocked Teams Desktop App launch attempt.');
            request.abort();
          } else {
            request.continue();
          }
        } catch (err) {}
      });
    } catch (e) {
      logger.warn('TeamsAdapter(teamJoiner): Request interception already handled or failed.');
    }

    await this.page.goto(this.meetingUrl, { waitUntil: 'networkidle2' });
    await this.page.keyboard.press('Escape').catch(() => {});

    await this.clickContinueOnBrowser();
    await this.handlePreJoin();
    await this.dismissAudioVideoPopup();
    await this.enterLobby();

    const wasAdmitted = await this.waitForJoinConfirmation();

    return wasAdmitted;
  }

  // -----------------------------
  // STAGE 2: CONTINUE ON BROWSER
  // -----------------------------
  async clickContinueOnBrowser() {
    try {
      logger.info('TeamsAdapter(teamJoiner): Waiting for "Continue on this browser" button...');

      await this.page.waitForFunction(() => {
        const btnTid = document.querySelector('button[data-tid="joinOnWeb"]');
        const btnText = Array.from(document.querySelectorAll('button, a')).find(el => {
          const t = (el.innerText || '').toLowerCase();
          return (
            t.includes('continue on this browser') ||
            t.includes('join on the web') ||
            t.includes('join in this browser') ||
            t.includes('join meeting from this browser')
          );
        });
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(
          el => (el.innerText || '').trim() === 'Cancel'
        );
        return !!(btnTid || btnText || cancelBtn);
      }, { timeout: 15000 });

      await this.page.evaluate(() => {
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(
          el => (el.innerText || '').trim() === 'Cancel'
        );
        if (cancelBtn) cancelBtn.click();

        const btnTid = document.querySelector('button[data-tid="joinOnWeb"]');
        if (btnTid) { btnTid.click(); return; }

        const btnText = Array.from(document.querySelectorAll('button, a')).find(el => {
          const t = (el.innerText || '').toLowerCase();
          return (
            t.includes('continue on this browser') ||
            t.includes('join on the web') ||
            t.includes('join in this browser') ||
            t.includes('join meeting from this browser')
          );
        });
        if (btnText) btnText.click();
      });

      logger.info('TeamsAdapter(teamJoiner): Clicked: Continue on this browser');
    } catch (e) {
      logger.info('TeamsAdapter(teamJoiner): Launcher screen not detected or already bypassed');
    }
  }

  // -----------------------------
  // STAGE 3: PRE-JOIN (mic/cam)
  // FIX 7: extracted the actual mute logic into muteMicAndCamera() so it can
  // be re-run after passcode-modal recovery without duplicating code.
  // -----------------------------
  async handlePreJoin() {
    logger.info('TeamsAdapter(teamJoiner): Handling Teams pre-join screen...');

    try {
      await new Promise(resolve => setTimeout(resolve, 6000));

      logger.info('TeamsAdapter(teamJoiner): Checking for Passcode Error Modal (Pre-join)...');
      await this.handlePasscodeModal();

      await this.muteMicAndCamera();
    } catch (e) {
      logger.error('TeamsAdapter(teamJoiner): Pre-join adjustments error: ' + e.message);
    }
  }

  // FIX 7: reusable mic/cam mute helper (was inline in handlePreJoin before)
  async muteMicAndCamera() {
    await this.page.evaluate(() => {
      const mic = document.querySelector('[data-track-action-scenario="callMuteAudio"], [aria-label*="Mute mic"], [data-state="mic-volume-renderer"]');
      if (mic && mic.getAttribute('aria-pressed') === 'true') mic.click();

      const cam = document.querySelector('[aria-label="Turn camera off"], [data-state="call-video"], [data-track-action-scenario="callStopVideo"], [data-track-module-name-new="videoOff"]');
      if (cam && cam.getAttribute('aria-pressed') === 'true') cam.click();
    });
  }

  // -----------------------------
  // STAGE 4: DISMISS AUDIO/VIDEO POPUP
  // -----------------------------
  async dismissAudioVideoPopup() {
    logger.info('TeamsAdapter(teamJoiner): Checking for "Continue without audio or video" popup...');

    for (let i = 0; i < 20; i++) {
      try {
        const dismissed = await this.page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b =>
            /continue without audio or video/i.test(b.innerText || '')
          );
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        });

        if (dismissed) {
          logger.info('TeamsAdapter(teamJoiner): Dismissed audio/video popup successfully');
          await new Promise(r => setTimeout(r, 1500));
          return;
        }
      } catch (e) {}

      await new Promise(r => setTimeout(r, 500));
    }

    logger.info('TeamsAdapter(teamJoiner): No audio/video popup found — continuing');
  }

  // -----------------------------
  // STAGE 5: ENTER NAME + JOIN
  // -----------------------------
  async enterLobby() {
    logger.info('TeamsAdapter(teamJoiner): Attempting to join Teams meeting...');

    try {
      const nameInputSelector = 'input[data-tid="prejoin-display-name-input"]';

      logger.info('TeamsAdapter(teamJoiner): Waiting for name input field...', nameInputSelector);
      await this.page.waitForSelector(nameInputSelector, { timeout: 15000 });

      await new Promise(r => setTimeout(r, 1000));

      await this.page.click(nameInputSelector, { clickCount: 3 });
      await this.page.keyboard.press('Backspace');

      await this.page.waitForFunction(
        (sel) => document.querySelector(sel)?.value === '',
        {},
        nameInputSelector
      );

      await this.page.type(nameInputSelector, this.botName, { delay: 60 });

      const finalValue = await this.page.$eval(nameInputSelector, el => el.value);
      if (finalValue !== this.botName) {
        logger.info(`Name mismatch ("${finalValue}"), retrying with fill...`);
        await this.page.$eval(nameInputSelector, (el, name) => {
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.value = name;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }, this.botName);
      }

      await new Promise(r => setTimeout(r, 1000));
      logger.info(`TeamsAdapter(teamJoiner): Set bot name to: ${this.botName}`);

      logger.info('TeamsAdapter(teamJoiner): Waiting for Join Now button to become enabled...');
      await this.page.evaluate(async () => {
        const delay = ms => new Promise(r => setTimeout(r, ms));

        for (let i = 0; i < 20; i++) {
          const btnTid = document.querySelector('button[data-tid="prejoin-join-button"]');
          if (btnTid && !btnTid.disabled) {
            btnTid.click();
            return;
          }

          const btnText = Array.from(document.querySelectorAll('button')).find(
            b => /join now/i.test(b.innerText || '') && !b.disabled
          );
          if (btnText) {
            btnText.click();
            return;
          }

          await delay(1500);
        }

        throw new Error('Join button not found or remained disabled after 10s');
      });

      logger.info('TeamsAdapter(teamJoiner): Clicked Join Now');
    } catch (e) {
      logger.error('TeamsAdapter(teamJoiner): Failed to join lobby: ' + e.message);
    }
  }

  // -----------------------------
  // PASSCODE MODAL HANDLER
  // -----------------------------
  async handlePasscodeModal() {
    const requiresPasscode = await this.page.evaluate(() => {
      const body = document.body.innerText;
      return (
        body.includes("We couldn't find a meeting") ||
        body.includes("Type a meeting passcode")
      );
    });

    if (requiresPasscode) {
      logger.info('TeamsAdapter(teamJoiner): Meeting passcode modal detected! Attempting recovery.');

      let pass = this.passcode;
      if (!pass) {
        try {
          const cleanUrl = this.meetingUrl.replace(/[>\])"']+$/, '');
          const urlObj = new URL(cleanUrl);
          pass =
            urlObj.searchParams.get('p') ||
            urlObj.searchParams.get('passcode') ||
            urlObj.searchParams.get('pwd');
        } catch (e) {}
      }

      if (pass) {
        logger.info(`TeamsAdapter(teamJoiner): Typing extracted passcode: ${pass}`);
        const passInput = 'input[data-tid="meeting-passcode-input"]';
        await this.page.waitForSelector(passInput, { timeout: 5000 }).catch(() => {});
        await this.page.click(passInput, { clickCount: 3 }).catch(() => {});
        await this.page.keyboard.press('Backspace');
        await this.page.type(passInput, pass, { delay: 100 }).catch(() => {});

        await this.page.evaluate(async () => {
          const delay = ms => new Promise(r => setTimeout(r, ms));
          const submitBtn = Array.from(document.querySelectorAll('button')).find(b =>
            /rejoin|join/i.test(b.innerText || '')
          );
          if (submitBtn) {
            submitBtn.click();
            await delay(4000);
          }
        });
        return true;
      } else {
        logger.warn('TeamsAdapter(teamJoiner): Passcode required but not found in configuration or URL.');
      }
    }
    return false;
  }

  // -----------------------------
  // STAGE 6: LOBBY WAIT
  // -----------------------------
  async waitForJoinConfirmation() {
    logger.info('TeamsAdapter(teamJoiner): Bot is in the lobby. Waiting for host to admit...');

    for (let i = 0; i < 200; i++) {
      const sessionState = await this.page.evaluate(() => {
        const text = document.body.innerText;

        const admittedSelectors = [
          '[aria-label="Mute mic"]',
          '[aria-label="Mute Mic"]',
          '[aria-label="No available camera found"]',
          '[aria-label="People"]',
          '[aria-label="Chat"]',
          '[aria-label="Raise"]',
          '[aria-label="Share"]',
          '[data-tid="toolbar-item-badge"]',
        ];

        const isAdmitted = admittedSelectors.some(sel => {
          try { return !!document.querySelector(sel); } catch { return false; }
        });

        const isStillInLobby =
          text.includes('Someone will let you in shortly') ||
          text.includes('Someone will let you in shortly.') ||
          text.toLowerCase().includes('someone will let you in shortly') ||
          text.includes('waiting in the lobby') ||
          text.includes("You're in the lobby") ||
          text.includes('waiting to be admitted');

        const needsPasscode =
          text.includes("We couldn't find a meeting") ||
          text.includes("Type a meeting passcode");

        return {
          isAdmitted,
          isStillInLobby,
          needsPasscode,
          pageTextSample: text.trim().slice(0, 300),
        };
      });
      
      if (sessionState.isAdmitted) {
        logger.info('TeamsAdapter(teamJoiner): SUCCESS: Host admitted the bot to the meeting');
        await new Promise(r => setTimeout(r, 2000));
        return true;
      }

      if (sessionState.needsPasscode) {
        logger.info('TeamsAdapter(teamJoiner): Passcode modal popped up while waiting!');
        const recovered = await this.handlePasscodeModal();
        if (recovered) {
          await new Promise(r => setTimeout(r, 2000));

          logger.info('TeamsAdapter(teamJoiner): Re-clicked Join Now after passcode recovery');
          await this.dismissAudioVideoPopup();

          // FIX 7: re-mute mic/cam after passcode recovery — previously this
          // step was skipped, risking an unmuted rejoin if the modal
          // interrupted before the original mute had settled.
          await this.muteMicAndCamera();

          await this.clickJoinNowButton();
          continue;
        }
      }

      if (i % 10 === 0) {
        logger.info('TeamsAdapter(teamJoiner): ...still waiting in lobby for host admission...');
      }

      await new Promise(r => setTimeout(r, 3000));
    }

    logger.warn('TeamsAdapter(teamJoiner): Admission timeout: Bot was never let into the meeting');
  }

  async clickJoinNowButton() {
    await this.page.evaluate(async () => {
      const delay = ms => new Promise(r => setTimeout(r, ms));

      for (let i = 0; i < 20; i++) {
        const btnTid = document.querySelector('button[data-tid="prejoin-join-button"]');

        if (btnTid && !btnTid.disabled) {
          btnTid.click();
          return;
        }

        const btnText = Array.from(document.querySelectorAll('button')).find(
          b => /join now/i.test(b.innerText || '') && !b.disabled
        );

        if (btnText) {
          btnText.click();
          return;
        }

        await delay(500);
      }

      throw new Error('Join button not found');
    });
  }

  // -----------------------------
  // POST-JOIN SETUP
  // FIX 1: startTranscriptMonitor() no longer runs its own caption-polling
  // setInterval. captionMonitor.js (TeamsCaptionMonitor, instantiated in
  // socraticbot.js) is now the SINGLE source of truth for caption capture
  // and persistence. This method now only does post-join housekeeping:
  // mute mic, enable captions in the UI so captionMonitor can read them.
  // -----------------------------
  async startTranscriptMonitor() {
    logger.info('TeamsAdapter(teamJoiner): Admitted! Running post-join setup (mute + enable captions)...');

    await this.muteMicAfterJoin();
    await this.enableCaptionsIfPossible();

    // NOTE: caption polling itself is handled entirely by
    // TeamsCaptionMonitor (captionMonitor.js), started separately in
    // socraticbot.js via this.captionMonitor.startPolling(). Do not add
    // a second polling loop here.
  }

  async muteMicAfterJoin() {
    await new Promise(r => setTimeout(r, 2000));

    await this.page.evaluate(() => {
      const mic =
        document.querySelector('button[data-track-action-scenario="callMuteAudio"]') ||
        document.querySelector('button[data-state="mic-volume-renderer"]') ||
        document.querySelector('button[data-inp="microphone-button"][aria-label="Mute mic"]') ||
        document.querySelector('button[id="microphone-button"][aria-label="Mute mic"]') ||
        Array.from(document.querySelectorAll('button')).find(b =>
          b.getAttribute('aria-label') === 'Mute mic'
        );

      if (mic) mic.click();
    });

    await new Promise(r => setTimeout(r, 1000));

    const isMuted = await this.page.evaluate(() => {
      const mic =
        document.querySelector('button[data-track-action-scenario="callUnmuteAudio"]') ||
        document.querySelector('button[data-state="mic-off"]') ||
        document.querySelector('button[aria-label="Unmute mic"]');
      return !!mic;
    });

    if (isMuted) {
      logger.info('TeamsAdapter(teamJoiner): Mic confirmed muted after joining.');
    } else {
      logger.warn('TeamsAdapter(teamJoiner): Could not confirm mic muted after joining.');
    }
  }

  // FIX 1: stopTranscriptMonitor() no longer needs to clear an interval
  // here since this class doesn't own a polling loop anymore. Kept as a
  // no-op passthrough for API compatibility with socraticbot.js's
  // `joiner.stopTranscriptMonitor()` call in stop().
  async stopTranscriptMonitor() {
    logger.info('TeamsAdapter(teamJoiner): Post-join monitor cleanup (no-op; caption polling owned by CaptionMonitor)');
  }

  async enableCaptionsIfPossible() {
    logger.info('TeamsAdapter(teamJoiner): Attempting to enable Teams captions...');
    try {
      await this.page.evaluate(() => {
        const moreBtn = document.querySelector('[aria-label*="More"], [aria-label*="more"]');
        if (moreBtn) moreBtn.click();
      });

      await new Promise(r => setTimeout(r, 1500));

      await this.page.evaluate(() => {
        const captionBtn = Array.from(
          document.querySelectorAll('button, span, div[role="menuitem"]')
        ).find(el => /captions|live captions|transcript/i.test(el.innerText));
        if (captionBtn) captionBtn.click();
      });
    } catch (e) {
      logger.warn('TeamsAdapter(teamJoiner): Captions not available or already enabled');
    }
  }
}

module.exports = TeamsJoiner;