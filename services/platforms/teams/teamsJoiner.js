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
    // 1) Detect the "can't find meeting / enter passcode" screen (searches all frames).
    const state = await this.readPasscodeScreen();

    if (!state.isPasscodeScreen) {
      return false;
    }

    logger.info(
      `TeamsAdapter(teamJoiner): Passcode screen detected. Displayed: "${state.text}"`
    );

    // 2) Resolve passcode value (config first, then URL params).
    let pass = this.passcode;
    if (!pass) {
      try {
        const cleanUrl = this.meetingUrl.replace(/[>\]"']+$/, '');
        const urlObj = new URL(cleanUrl);
        pass =
          urlObj.searchParams.get('p') ||
          urlObj.searchParams.get('passcode') ||
          urlObj.searchParams.get('pwd');
      } catch (e) {}
    }

    // 3) Locate the passcode field: selectors first, then Tab discovery.
    const field = await this.findPasscodeField();

    if (!field.found) {
      logger.warn(
        'TeamsAdapter(teamJoiner): Could not locate the passcode input even after Tab navigation. ' +
          (pass
            ? 'A passcode is available but NO field was found — aborting recovery (unexpected field/selector).'
            : 'No passcode is configured (this.passcode / URL ?p=?passcode=?pwd=). The user MUST provide the meeting passcode.')
      );
      return false;
    }

    logger.info(
      `TeamsAdapter(teamJoiner): Passcode input located via ${field.method} ` +
        `(tag=${field.tag}, type=${field.type}, id=${field.id}, name=${field.name}, placeholder=${field.placeholder}, data-tid=${field.dataTid}, frame=${field.frameName}).`
    );

    // 4) If we have a passcode, type it and submit.
    if (pass) {
      const typed = await this.typeIntoPasscode(field, pass);
      if (!typed) {
        logger.warn('TeamsAdapter(teamJoiner): Passcode field located but typing failed.');
        return false;
      }
      logger.info('TeamsAdapter(teamJoiner): Passcode typed. Submitting...');

      await field.frame.evaluate(() => {
        const submitBtn = Array.from(document.querySelectorAll('button')).find(b =>
          /rejoin|join|check|continue/i.test(b.innerText || '')
        );
        if (submitBtn) submitBtn.click();
      });
      // Enter as a fallback submit in case no visible button matched.
      await this.page.keyboard.press('Enter').catch(() => {});
      await new Promise(r => setTimeout(r, 2500));
      return true;
    }

    // No passcode available — surface what is on screen so the operator can act.
    logger.warn(
      `TeamsAdapter(teamJoiner): Passcode is REQUIRED but was not provided. Currently displayed: "${state.text}"`
    );
    return false;
  }

  // -----------------------------
  // READ THE PASSCODE ERROR SCREEN (across all frames)
  // -----------------------------
  async readPasscodeScreen() {
    const frames = this.page.frames();
    let text = '';
    let isPasscodeScreen = false;

    for (const frame of frames) {
      const res = await frame
        .evaluate(() => {
          const t = document.body ? document.body.innerText || '' : '';
          const low = t.toLowerCase();
          const hit =
            /we can'?t find this meeting/i.test(low) ||
            /we couldn'?t find a meeting/i.test(low) ||
            /meeting might have ended/i.test(low) ||
            /type (a )?meeting passcode/i.test(low) ||
            /enter (a )?meeting passcode/i.test(low) ||
            /meeting passcode/i.test(low) ||
            /rejoin call/i.test(low) ||
            !!document.querySelector(
              'input[data-tid*="passcode"], input[data-tid*="otp"]'
            );
          return { t: t.trim().slice(0, 400), hit };
        })
        .catch(() => ({ t: '', hit: false }));
      if (res.hit) isPasscodeScreen = true;
      if (res.t) text += (text ? ' | ' : '') + res.t;
    }

    return { isPasscodeScreen, text };
  }
// -----------------------------
  // FIND THE PASSCODE INPUT — selectors first, then Tab+Enter discovery (all frames)
  // -----------------------------
  async findPasscodeField() {
    const frames = this.page.frames();
    const selectors = [
      'input[data-tid="meeting-passcode-input"]',
      'input[data-tid*="passcode"]',
      'input[data-tid*="otp"]',
      'input[type="password"]',
      'input[inputmode="numeric"]',
      'input[autocomplete="one-time-code"]',
      'input[name*="passcode"]',
      'input[placeholder*="passcode" i]',
      'input[placeholder*="OTP" i]',
      'input[aria-label*="passcode" i]',
      'input[aria-label*="password" i]'
    ];

    // A) Selectors across ALL frames.
    for (const frame of frames) {
      const info = await frame
        .evaluate((sels) => {
          for (const s of sels) {
            const el = document.querySelector(s);
            if (el) {
              return {
                found: true,
                tag: el.tagName,
                type: el.type,
                id: el.id,
                name: el.name,
                placeholder: el.placeholder,
                dataTid: el.getAttribute('data-tid')
              };
            }
          }
          return { found: false };
        }, selectors)
        .catch(() => ({ found: false }));

      if (info.found) {
        return {
          ...info,
          method: 'selector',
          frame,
          frameName: frame === this.page.mainFrame() ? 'main' : frame.name() || 'child'
        };
      }
    }

    // B) Real keyboard Tab navigation — logging each focused element until we
    //    land on an editable (input/textarea) field.
    logger.info(
      'TeamsAdapter(teamJoiner): No passcode field by selector — using Tab navigation to discover it.'
    );
    const tabFrames = [this.page.mainFrame(), ...this.page.frames()];

    for (let i = 0; i < 14; i++) {
      await this.page.keyboard.press('Tab').catch(() => {});
      await new Promise(r => setTimeout(r, 180));

      for (const frame of tabFrames) {
        const info = await frame
          .evaluate(() => {
            const ae = document.activeElement;
            if (!ae || (ae.tagName !== 'INPUT' && ae.tagName !== 'TEXTAREA')) return null;
            return {
              found: true,
              tag: ae.tagName,
              type: ae.type,
              id: ae.id,
              name: ae.name,
              placeholder: ae.placeholder,
              dataTid: ae.getAttribute('data-tid')
            };
          })
          .catch(() => null);

        if (info && info.found) {
          const fname = frame === this.page.mainFrame() ? 'main' : frame.name() || 'child';
          logger.info(
            `TeamsAdapter(teamJoiner): TAB ${i + 1} frame=${fname} → focused ${info.tag} ` +
              `type=${info.type} id=${info.id} name=${info.name} data-tid=${info.dataTid} placeholder=${info.placeholder}`
          );
          return { ...info, method: 'tab-navigation', frame, frameName: fname };
        }
      }
    }

    return { found: false };
  }

  // -----------------------------
  // TYPE THE PASSCODE INTO THE LOCATED FIELD
  // -----------------------------
  async typeIntoPasscode(field, pass) {
    return field.frame.evaluate((code) => {
      const candidates = [
        'input[data-tid*="passcode"]',
        'input[data-tid*="otp"]',
        'input[type="password"]',
        'input[inputmode="numeric"]',
        'input[name*="passcode"]',
        'input[placeholder*="passcode" i]',
        'input[placeholder*="OTP" i]'
      ];
      let input = null;
      for (const c of candidates) {
        const e = document.querySelector(c);
        if (e) { input = e; break; }
      }
      if (!input && document.activeElement && document.activeElement.tagName === 'INPUT') {
        input = document.activeElement;
      }
      if (!input) return false;

      input.focus();
      const proto = window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      if (setter) setter.call(input, '');
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // Best-effort real-typing simulation; React reliably recognizes execCommand.
      try {
        document.execCommand('insertText', false, code);
      } catch (e) {
        if (setter) setter.call(input, code);
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, pass);
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
          text.includes("We can't find this meeting") ||
          text.includes("Type a meeting passcode") ||
          text.includes('meeting might have ended') ||
          /type a meeting passcode/i.test(text) ||
          /can'?t find this meeting/i.test(text) ||
          /meeting passcode/i.test(text);

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

      // Also check across ALL frames - the light experience may render the
      // "can't find meeting / passcode" prompt inside an iframe that the
      // top-frame text check above would miss.
      const passcodeState = await this.readPasscodeScreen();

      if (sessionState.needsPasscode || passcodeState.isPasscodeScreen) {
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