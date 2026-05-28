const { logger } = require('../../../utils/logger');

class TeamsJoiner {
  constructor(page, botName, meetingUrl, passcode) {
    this.page = page;
    this.botName = botName;
    this.meetingUrl = meetingUrl;
    this.passcode = passcode;
  }

  // -----------------------------
  // MAIN ENTRY
  // -----------------------------
  async joinMeeting() {
    logger.info('TeamsAdapter: STAGE 1: Navigating to Microsoft Teams...');

    try {
      await this.page.setRequestInterception(true);
      this.page.on('request', (request) => {
        try {
          const url = request.url();
          if (
            url.startsWith('msteams:') ||
            url.startsWith('teamscmd:') ||
            url.startsWith('ms-teams:')
          ) {
            logger.info('TeamsAdapter: Blocked Teams Desktop App launch attempt.');
            request.abort();
          } else {
            request.continue();
          }
        } catch (err) {}
      });
    } catch (e) {
      logger.warn('TeamsAdapter: Request interception already handled or failed.');
    }

    await this.page.goto(this.meetingUrl, { waitUntil: 'networkidle2' });
    await this.page.keyboard.press('Escape').catch(() => {});

    // STAGE 2: Click "Continue on this browser"
    await this.clickContinueOnBrowser();

    // STAGE 3: Handle pre-join (mic/cam off)
    await this.handlePreJoin();

    // STAGE 4: ✅ Dismiss audio/video popup HERE — right before touching name input
    await this.dismissAudioVideoPopup();

    // STAGE 5: Enter name and join
    await this.enterLobby();
    
    // Dismiss popup again if Teams re-opened it
    // await this.dismissAudioVideoPopup();
    // await this.clickJoinNowButton();

    // STAGE 6: Wait for host to admit
    await this.waitForJoinConfirmation();


  }

  // -----------------------------
  // STAGE 2: CONTINUE ON BROWSER
  // -----------------------------
  async clickContinueOnBrowser() {
    try {
      logger.info('TeamsAdapter: Waiting for "Continue on this browser" button...');

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

      logger.info('TeamsAdapter: Clicked: Continue on this browser');
    } catch (e) {
      logger.info('TeamsAdapter: Launcher screen not detected or already bypassed');
    }
  }

  // -----------------------------
  // STAGE 3: PRE-JOIN (mic/cam)
  // -----------------------------
  async handlePreJoin() {
    logger.info('TeamsAdapter: Handling Teams pre-join screen...');

    try {
      await new Promise(resolve => setTimeout(resolve, 6000));

      logger.info('TeamsAdapter: Checking for Passcode Error Modal (Pre-join)...');
      await this.handlePasscodeModal();

      // Turn off mic and camera
      await this.page.evaluate(() => {
        const mic = document.querySelector('[aria-label*="microphone"], [aria-label*="mic"]');
        if (mic && mic.getAttribute('aria-pressed') === 'true') mic.click();

        const cam = document.querySelector('[aria-label*="camera"], [aria-label*="video"]');
        if (cam && cam.getAttribute('aria-pressed') === 'true') cam.click();
      });
    } catch (e) {
      logger.error('TeamsAdapter: Pre-join adjustments error: ' + e.message);
    }
  }

  // -----------------------------
  // STAGE 4: DISMISS AUDIO/VIDEO POPUP
  // ✅ Separated into its own method, called right before enterLobby
  // -----------------------------
  async dismissAudioVideoPopup() {
    logger.info('TeamsAdapter: Checking for "Continue without audio or video" popup...');

    // Poll for up to 10 seconds (20 × 500ms)
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
          logger.info('TeamsAdapter: Dismissed audio/video popup successfully');
          // Wait for the popup to fully close before proceeding
          await new Promise(r => setTimeout(r, 1500));
          return;
        }
      } catch (e) {
        // page.evaluate can throw if page is mid-navigation — safe to ignore
      }

      await new Promise(r => setTimeout(r, 500));
    }

    // Not an error — the popup may simply not appear on all meeting types
    logger.info('TeamsAdapter: No audio/video popup found — continuing');
  }

  // -----------------------------
  // STAGE 5: ENTER NAME + JOIN
  // -----------------------------
  async enterLobby() {
    logger.info('TeamsAdapter: Attempting to join Teams meeting...');

    try {
      const nameInputSelector = 'input[data-tid="prejoin-display-name-input"]';

      // ✅ Wait for the name input — it must be visible and not obscured
      logger.info('TeamsAdapter: Waiting for name input field...',nameInputSelector);
      await this.page.waitForSelector(nameInputSelector, { timeout: 1500 });

      // ✅ Small settle delay — Teams re-renders after popup closes
      await new Promise(r => setTimeout(r, 1000));

      // Clear + type bot name
      await this.page.click(nameInputSelector, { clickCount: 3 });
      await this.page.keyboard.press('Backspace');
      await this.page.type(nameInputSelector, this.botName, { delay: 80 });

      logger.info(`TeamsAdapter: Set bot name to: ${this.botName}`);

      // ✅ Wait for Join button to become enabled, then click
      logger.info('TeamsAdapter: Waiting for Join Now button to become enabled...');
      await this.page.evaluate(async () => {
        const delay = ms => new Promise(r => setTimeout(r, ms));

        for (let i = 0; i < 20; i++) {
          // Teams Enterprise
          const btnTid = document.querySelector('button[data-tid="prejoin-join-button"]');
          if (btnTid && !btnTid.disabled) {
            btnTid.click();
            return;
          }

          // Teams Personal / Live
          const btnText = Array.from(document.querySelectorAll('button')).find(
            b => /join now/i.test(b.innerText || '') && !b.disabled
          );
          if (btnText) {
            btnText.click();
            return;
          }

          await delay(500);
        }

        throw new Error('Join button not found or remained disabled after 10s');
      });

      logger.info('TeamsAdapter: Clicked Join Now');
    } catch (e) {
      logger.error('TeamsAdapter: Failed to join lobby: ' + e.message);
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
      logger.info('TeamsAdapter: Meeting passcode modal detected! Attempting recovery.');

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
        logger.info(`TeamsAdapter: Typing extracted passcode: ${pass}`);
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
        logger.warn('TeamsAdapter: Passcode required but not found in configuration or URL.');
      }
    }
    return false;
  }

  // -----------------------------
  // STAGE 6: LOBBY WAIT
  // -----------------------------
  async waitForJoinConfirmation() {
    logger.info('TeamsAdapter: Bot is in the lobby. Waiting for host to admit...');

    for (let i = 0; i < 200; i++) {
      const sessionState = await this.page.evaluate(() => {
        const text = document.body.innerText;

        // const admitted =
        //   !!document.querySelector('[aria-label*="Leave"]') ||
        //   !!document.querySelector('[aria-label*="Hang up"]') ||
        //   !!document.querySelector('[data-tid="call-controls"]') ||
        //   !!document.querySelector('[data-tid="toggle-mute"]') ||
        //   !!document.querySelector('[data-tid="toggle-video"]') ||
        //   !!document.querySelector('[data-tid="meeting-stage"]') ||
        //   !!document.querySelector('[data-tid="roster-button"]') ||
        //   bodyHTML.includes('ts-calling-screen') ||
        //   bodyHTML.includes('calling-screen') ||
        //   bodyHTML.includes('control-bar') ||
        //   bodyHTML.includes('meeting-stage');

        return {
          isAdmitted: !!(
            document.querySelector('[data-tid="meeting-title"]') ||
            document.querySelector('.meeting-control-bar') ||
            document.querySelector('[aria-label*="Hang up"]')
          ),
          // isAdmitted: admitted,
          isStillInLobby:
            text.includes('Someone will let you in shortly') ||
            text.includes('Someone will let you in shortly.') ||
            text.includes('someone will let you in shortly') ||
            text.includes('someone will let you in shortly.') ||
            text.includes('waiting in the lobby'),
          needsPasscode:
            text.includes("We couldn't find a meeting") ||
            text.includes("Type a meeting passcode")
        };
      });

      logger.info('TeamsAdapter: sessionState is: ',sessionState);
      
      if (sessionState.isAdmitted) {
        logger.info('TeamsAdapter: SUCCESS: Host admitted the bot to the meeting');
        await new Promise(r => setTimeout(r, 2000));
        return true;
      }

      if (sessionState.needsPasscode) {
        logger.info('TeamsAdapter: Passcode modal popped up while waiting!');
        const recovered = await this.handlePasscodeModal();
        if (recovered) {
          await new Promise(r => setTimeout(r, 2000));

          logger.info('TeamsAdapter: Re-clicked Join Now after passcode recovery');
          await this.dismissAudioVideoPopup();
          await this.clickJoinNowButton();

          continue;
        }
      }

      if (i % 10 === 0) {
        logger.info('TeamsAdapter: ...still waiting in lobby for host admission...');
      }

      await new Promise(r => setTimeout(r, 3000));
    }

    logger.warn('TeamsAdapter: Admission timeout: Bot was never let into the meeting');
  }


  async clickJoinNowButton() {
    await this.page.evaluate(async () => {
      const delay = ms => new Promise(r => setTimeout(r, ms));

      for (let i = 0; i < 20; i++) {
        const btnTid = document.querySelector(
          'button[data-tid="prejoin-join-button"]'
        );

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
  // CAPTION MONITOR
  // -----------------------------
  async startTranscriptMonitor() {
    logger.info('TeamsAdapter: Admitted! Starting Teams transcript monitor...');
    await this.enableCaptionsIfPossible();

    setInterval(async () => {
      try {
        const captions = await this.page.evaluate(() => {
          const captionContainer =
            document.querySelector('.pt-captions-container') ||
            document.querySelector('[data-tid="closed-captions-renderer"]');

          if (captionContainer) return captionContainer.innerText;

          const nodes = Array.from(
            document.querySelectorAll('div[data-tid="caption-text"]')
          );
          return nodes.map(n => n.innerText).join('\n');
        });

        if (captions && captions.trim().length > 0) {
          logger.info(`TeamsAdapter: TEAMS CAPTION: ${captions.slice(-150)}`);
        }
      } catch (e) {
        logger.error('TeamsAdapter: Teams caption monitor error:', e.message);
      }
    }, 4000);
  }

  async enableCaptionsIfPossible() {
    logger.info('TeamsAdapter: Attempting to enable Teams captions...');
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
      logger.warn('TeamsAdapter: Captions not available or already enabled');
    }
  }
}

module.exports = TeamsJoiner;