/**
 * root/services/platforms/zoom/zoomJoiner.js
 *
 */
const { logger } = require('../../../utils/logger');

class ZoomJoiner {
  constructor(page, botName, passcode, meetingUrl) {
    this.page = page;
    this.botName = botName;
    this.passcode = passcode;
    this.meetingUrl = meetingUrl;
    // FIX: guards against re-submitting the name/Join form on every polling
    // pass. Previously `_fillNameAndJoin` re-ran on every loop iteration
    // (every 5s) for as long as the name input remained in the DOM and
    // `hasLeave` hadn't appeared yet — e.g. while sitting on a "waiting to
    // be admitted" screen that still technically contains the name field.
    // That repeatedly cleared/retyped the name and re-clicked Join, which
    // can interrupt an in-progress admission or trip Zoom's own abuse
    // protections.
    this.joinSubmitted = false;
  }

  // ─────────────────────────────────────────────
  // MAIN JOIN
  // ─────────────────────────────────────────────
  async joinMeeting() {
    logger.info('ZoomAdapter(zoomJoiner): STAGE 1: Navigating to Zoom...');
    await this.page.goto(this.meetingUrl, { waitUntil: 'networkidle2' });

    let joined = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 120;

    while (!joined && attempts < MAX_ATTEMPTS) {
      attempts++;
      const allFrames = this.page.frames();
      logger.info(`ZoomAdapter(zoomJoiner): --- Join Attempt ${attempts}/${MAX_ATTEMPTS} | Detected ${allFrames.length} frames ---`);

      for (let i = 0; i < allFrames.length; i++) {
        const frame = allFrames[i];
        const url = frame.url();

        if (!url || url === 'about:blank') continue;
        if (this._isCrossOriginFrame(url)) {
          logger.info(`ZoomAdapter(zoomJoiner): Frame[${i}] Skipped (cross-origin): ${url.substring(0, 60)}`);
          continue;
        }

        try {
          const analysis = await this._analyzeFrame(frame);
          if (!analysis) continue;

          logger.info(`ZoomAdapter(zoomJoiner): Frame[${i}] URL: ${url.substring(0, 70)}`);
          logger.info(`ZoomAdapter(zoomJoiner): Content: "${analysis.bodySnippet}"`);

          if (analysis.isMeetingEnded) {
            logger.warn('ZoomAdapter(zoomJoiner): Meeting has ended — aborting join');
            throw new Error('Zoom meeting has already ended');
          }

          if (analysis.isWaitingForHost) {
            if (attempts % 6 === 0) {
              logger.info(`ZoomAdapter(zoomJoiner): Waiting for host (${Math.round(attempts * 5 / 60)} min elapsed)...`);
            }
            continue; // FIX: only skip this frame, not the rest of the pass
          }

          await this._handleFrameActions(frame, analysis);

          if (analysis.hasLeave) {
            joined = true;
            logger.info('ZoomAdapter(zoomJoiner): SUCCESS: Bot is in the meeting');
            await this.muteMicAfterJoin();
            break;
          }

        } catch (e) {
          if (e.message.includes('already ended')) throw e;
          logger.info(`ZoomAdapter(zoomJoiner): Frame[${i}] skipped: ${e.message.substring(0, 80)}`);
        }
      }

      if (joined) break;
      await new Promise(r => setTimeout(r, 5000));
    }

    if (!joined) {
      await this.page.screenshot({ path: './logs/image/stuck_debug.png' }).catch(() => {});
      logger.error('ZoomAdapter(zoomJoiner): FAILED after max attempts — saved stuck_debug.png');
      throw new Error('Zoom join failed');
    }
  }

  // ─────────────────────────────────────────────
  // FRAME FILTER
  // ─────────────────────────────────────────────

  _isCrossOriginFrame(url) {
    return (
      url.includes('google.com/recaptcha') ||
      url.includes('recaptcha') ||
      url.includes('gstatic.com') ||
      url.includes('youtube.com') ||
      url.includes('doubleclick')
    );
  }

  // ─────────────────────────────────────────────
  // FRAME ANALYSIS
  // ─────────────────────────────────────────────

  async _analyzeFrame(frame) {
    return frame.evaluate(() => {
      const body = document.body;
      if (!body) return null;
      const text = body.innerText || '';

      return {
        hasLeave: !!(
          document.querySelector('button[aria-label*="Leave"]') ||
          document.querySelector('.footer-button__leave-btn') ||
          document.querySelector('#leave-btn')
        ),
        foundNameInput: !!document.querySelector('input#input-for-name, input[placeholder*="name" i], input[name*="name" i]'),
        foundPassInput: !!document.querySelector('input#inputpass, input[name*="pass" i]'),
        foundJoinBtn: !!Array.from(document.querySelectorAll('button')).find(
          b => /^join$/i.test((b.innerText || '').trim()) || b.classList.contains('zm-btn--primary')
        ),
        foundLaunchLink: !!Array.from(document.querySelectorAll('a, button')).find(
          el => /join from your browser/i.test(el.innerText || '')
        ),
        foundCookieBtn: !!document.querySelector('#onetrust-accept-btn-handler, .optanon-allow-all'),
        isWaitingForHost:
          text.includes('Waiting for the host to start') ||
          text.includes('waiting for the host') ||
          text.includes('The meeting has not started') ||
          text.includes('Please wait for the host'),
        isMeetingEnded:
          text.includes('This meeting has been ended') ||
          text.includes('meeting is over') ||
          text.includes('meeting has ended'),
        bodySnippet: text.substring(0, 120).replace(/\n/g, ' '),
      };
    });
  }

  // ─────────────────────────────────────────────
  // FRAME ACTIONS
  // ─────────────────────────────────────────────

  async _handleFrameActions(frame, analysis) {
    if (analysis.foundCookieBtn) {
      logger.info('ZoomAdapter(zoomJoiner): [ACTION] Dismissing cookie banner');
      await frame.click('#onetrust-accept-btn-handler, .optanon-allow-all').catch(() => {});
    }

    if (analysis.foundLaunchLink) {
      await this._clickJoinFromBrowser(frame);
    }

    // FIX: gate on this.joinSubmitted so the name is filled in and Join is
    // clicked exactly once per join attempt, instead of on every polling
    // pass while the name input is still present in the DOM (e.g. during
    // the post-click "joining..." transition or an admission-pending
    // screen that hasn't swapped the form out yet).
    if (analysis.foundNameInput && !analysis.hasLeave && !this.joinSubmitted) {
      this.joinSubmitted = true;
      await this._fillNameAndJoin(frame, analysis);
    }
  }

  // ─────────────────────────────────────────────
  // CLICK JOIN FROM BROWSER
  // ─────────────────────────────────────────────

  async _clickJoinFromBrowser(frame) {
    logger.info('ZoomAdapter(zoomJoiner): [ACTION] Clicking "Join from Your Browser"');

    await frame.evaluate(() => {
      const launchBtn = Array.from(document.querySelectorAll('button, a'))
        .find(el => /launch meeting/i.test(el.innerText || ''));
      if (launchBtn) launchBtn.click();
    });

    await new Promise(r => setTimeout(r, 1500));

    await frame.evaluate(() => {
      const browserLink = Array.from(document.querySelectorAll('a, button'))
        .find(el => /join from your browser/i.test(el.innerText || ''));
      if (browserLink) browserLink.click();
    });

    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 })
      .catch(() => logger.info('ZoomAdapter(zoomJoiner): Navigation timeout — continuing'));
  }

  // ─────────────────────────────────────────────
  // FILL NAME + MUTE + JOIN
  // ─────────────────────────────────────────────

  async _fillNameAndJoin(frame, analysis) {
    logger.info('ZoomAdapter(zoomJoiner): [ACTION] Filling name and joining');

    await frame.evaluate(() => {
      const inp = document.querySelector('input#input-for-name, input[placeholder*="name" i]');
      if (inp) { inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    });

    await frame.type('input#input-for-name, input[placeholder*="name" i]', this.botName, { delay: 60 });

    await this._muteMicPreJoin(frame);

    if (analysis.foundPassInput && this.passcode) {
      await this._fillPasscode(frame);
    }

    await new Promise(r => setTimeout(r, 1000));
    await this._clickJoinButton(frame);
    logger.info('ZoomAdapter(zoomJoiner): [ACTION] Clicked Join — waiting for admission');
  }

  // ─────────────────────────────────────────────
  // PRE-JOIN MIC MUTE
  // ─────────────────────────────────────────────

async _muteMicPreJoin(frame) {
  await new Promise(r => setTimeout(r, 1000)); // wait for pre-join UI to render

  await frame.evaluate(() => {
    const getVisible = () =>
      Array.from(document.querySelectorAll('button, .dropdown-item, li, span, div[role="menuitem"]'))
        .filter(el => {
          const s = window.getComputedStyle(el);
          return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetWidth > 0;
        });

    const findAndClick = (regex) =>
      getVisible().find(el => regex.test((el.innerText || el.ariaLabel || '').trim()));

    // Mic — only click if currently unmuted
    const micBtn = findAndClick(/^Mute$|Mute my mic|mute microphone|turn off mic/i);
    if (micBtn) micBtn.click();

    // Camera — only click if currently on
    const camBtn = findAndClick(/^Stop Video$|turn off camera|stop my video|stop camera/i);
    if (camBtn) camBtn.click();
  });

  await new Promise(r => setTimeout(r, 1000));

  // Confirm both
  const { micMuted, camOff } = await frame.evaluate(() => {
    const text = (el) => (el?.innerText || el?.getAttribute('aria-label') || '').trim();
    const allBtns = Array.from(document.querySelectorAll('button'));

    const micMuted = allBtns.some(b => /^Unmute$|unmute my mic|unmute microphone/i.test(text(b)));
    const camOff   = allBtns.some(b => /^Start Video$|start my video|turn on camera/i.test(text(b)));

    return { micMuted, camOff };
  });

  logger.info(`ZoomAdapter(zoomJoiner): Pre-join mic muted: ${micMuted}, camera off: ${camOff}`);

  if (!micMuted) logger.warn('ZoomAdapter(zoomJoiner): Could not confirm mic muted on pre-join.');
  if (!camOff)   logger.warn('ZoomAdapter(zoomJoiner): Could not confirm camera off on pre-join.');
}

  // ─────────────────────────────────────────────
  // FILL PASSCODE
  // ─────────────────────────────────────────────

  async _fillPasscode(frame) {
    await frame.evaluate(() => {
      const inp = document.querySelector('input#inputpass');
      if (inp) { inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    await frame.type('input#inputpass', this.passcode, { delay: 60 });
  }

  // ─────────────────────────────────────────────
  // CLICK JOIN BUTTON
  // ─────────────────────────────────────────────

  async _clickJoinButton(frame) {
    await frame.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        b => /^join$/i.test((b.innerText || '').trim()) || b.classList.contains('zm-btn--primary')
      );
      if (btn) btn.click();
    });
  }

  async muteMicAfterJoin() {
    await new Promise(r => setTimeout(r, 2000));

    const frame = this.page.frames().find(f => f.url().includes('zoom.us')) || this.page;

    await frame.evaluate(() => {
      const mic =
        document.querySelector('button[aria-label="Mute"]') ||
        document.querySelector('button[aria-label="mute my microphone"]') ||
        document.querySelector('.join-audio-by-voip__join-btn') ||
        Array.from(document.querySelectorAll('button')).find(b =>
          /^mute$/i.test((b.getAttribute('aria-label') || b.innerText || '').trim())
        );
      if (mic) mic.click();
    });

    // Confirm
    await new Promise(r => setTimeout(r, 1000));

    const isMuted = await frame.evaluate(() => {
      const mic =
        document.querySelector('button[aria-label="Unmute"]') ||
        document.querySelector('button[aria-label="unmute my microphone"]') ||
        Array.from(document.querySelectorAll('button')).find(b =>
          /^unmute$/i.test((b.getAttribute('aria-label') || b.innerText || '').trim())
        );
      return !!mic;
    });

    if (isMuted) {
      logger.info('ZoomAdapter(zoomJoiner): Mic confirmed muted after joining.');
    } else {
      logger.warn('ZoomAdapter(zoomJoiner): Could not confirm mic muted after joining.');
    }
  }

  // ─────────────────────────────────────────────
  // CAPTIONS: CHECK IF ENABLED
  // ─────────────────────────────────────────────
  //
  // FIX (was: checkCaptionsEnabled): the previous version treated a page
  // containing the literal word "Captions" or "Transcript" ANYWHERE in
  // body.innerText as proof that captions were already ON. Zoom's own
  // footer button is labeled "Captions" whether the feature is off, on,
  // host-controlled, or unsupported — so `hasText` was true on almost
  // every call regardless of actual state. That made this function report
  // ENABLED nearly 100% of the time, which meant sendChatRequest() (the
  // fallback that asks the host to turn captions on) never fired even when
  // captions were genuinely off.
  //
  // This version instead looks for state that can only be true when
  // captions/transcript are ACTUALLY active: a toggled/pressed caption
  // button, a live caption bubble on screen, or existing transcript rows
  // in the sidebar. Anything else is treated as "not yet confirmed on",
  // which is a safer default — it just means we may send an extra chat
  // nudge, not that we miss turning captions on.
  async checkCaptionsEnabled() {
    logger.info('ZoomAdapter(zoomJoiner): CHECK: Verifying if captions/transcript are actually active...');
    const frame = this.page.frames().find(f => f.url().includes('zoom.us')) || this.page;

    const status = await frame.evaluate(() => {
      // 1. Caption/CC button reporting an "on"/"pressed" state
      const ccButton = document.querySelector(
        'button[aria-label*="caption" i][aria-pressed="true"], ' +
        'button[aria-label*="caption" i][aria-checked="true"], ' +
        '.cc-button[aria-pressed="true"]'
      );

      // 2. Live caption bubble actually rendering text on screen
      const liveCaptionBubble = document.querySelector(
        '.live-transcription-subtitle, .caption-bubble, [class*="live-caption"]'
      );

      // 3. Transcript sidebar already has content rows
      const transcriptRows = document.querySelectorAll('.lt-full-transcript__item');

      if (ccButton || liveCaptionBubble || transcriptRows.length > 0) {
        return 'ENABLED';
      }

      // Caption feature exists in the UI but we can't confirm it's ON
      const captionButtonPresent = !!document.querySelector(
        'button[aria-label*="caption" i], .cc-button'
      );

      return captionButtonPresent ? 'PRESENT_BUT_UNCONFIRMED' : 'DISABLED';
    });

    if (status === 'ENABLED') {
      logger.info('ZoomAdapter(zoomJoiner): CONFIRMED: Captions/transcript are actively running.');
      return true;
    }

    if (status === 'PRESENT_BUT_UNCONFIRMED') {
      logger.warn('ZoomAdapter(zoomJoiner): Captions control exists but ON-state could not be confirmed — treating as not enabled.');
    } else {
      logger.warn('ZoomAdapter(zoomJoiner): ALERT: Live Captions are NOT enabled by the Host.');
    }
    return false;
  }

  async sendChatRequest() {
    logger.info('ZoomAdapter(zoomJoiner): Sending chat request for captions...');
    const frame = this.page.frames().find(f => f.url().includes('zoom.us')) || this.page;

    try {
      await frame.evaluate((name) => {
        const chatBtn = document.querySelector(
          '.footer-button-base__button-label[aria-label*="Chat"], .chat-button'
        );
        if (chatBtn) chatBtn.click();

        setTimeout(() => {
          const textarea = document.querySelector(
            '.chat-box__chat-textarea, #chat-textarea, textarea[placeholder*="message"]'
          );
          if (textarea) {
            const msg = `Hi everyone, I'm ${name}. To help me transcribe this meeting, please click "Captions" and "Enable Auto-Transcription" in your Zoom toolbar. Thanks!`;
            textarea.value = msg;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new KeyboardEvent('keydown', {
              bubbles: true, cancelable: true, keyCode: 13, key: 'Enter'
            }));
          }
        }, 1500);
      }, this.botName);
    } catch (e) {
      logger.error('ZoomAdapter(zoomJoiner): Chat Request Error: ' + e.message);
    }
  }

  async startTranscriptMonitor(captionMonitor, maxRetries = 6) {
    logger.info('ZoomAdapter(zoomJoiner): Starting Transcript Activation...');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logger.info(`ZoomAdapter(zoomJoiner): === Caption activation attempt ${attempt}/${maxRetries} ===`);
      const frame = this.page.frames().find(f => f.url().includes('zoom.us/wc')) || this.page;

      try {
        // Close any stray open menu from a previous failed attempt before
        // retrying, so we always start from a known "nothing open" state.
        await this.page.keyboard.press('Escape').catch(() => {});
        await new Promise(r => setTimeout(r, 500));

        const result = await this.executeNavigationSequence(frame);
        result.logs.forEach(l => logger.info(l));

        if (result.status !== 'SUCCESS') {
          logger.warn(`ZoomAdapter(zoomJoiner): Attempt ${attempt} failed at ${result.failedAt || 'unknown step'} — retrying...`);
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }

        await this.handleHostPermissionPopup(frame);

        const isVisible = await this.verifySidebarVisibility(frame);
        logger.info(`ZoomAdapter(zoomJoiner): sidebarVisible: ${isVisible}`);

        if (!isVisible) {
          logger.warn(`ZoomAdapter(zoomJoiner): Attempt ${attempt}: sidebar did not open — retrying...`);
          await this.page.screenshot({ path: `./logs/image/blocker_check_attempt${attempt}_${Date.now()}.png` }).catch(() => {});
          continue;
        }

        logger.info('ZoomAdapter(zoomJoiner): SUCCESS: Sidebar opened.');

        const captionsToggled = await this.enableLiveCaptions(frame);
        logger.info(`ZoomAdapter(zoomJoiner): Live captions toggle result: ${captionsToggled}`);

        const confirmed = await this.verifyCaptionsProducingOutput(frame);
        if (!confirmed) {
          logger.warn(`ZoomAdapter(zoomJoiner): Attempt ${attempt}: captions toggled but no output confirmed — retrying...`);
          continue;
        }

        logger.info(`ZoomAdapter(zoomJoiner): SUCCESS on attempt ${attempt}: captions confirmed active.`);
        if (captionMonitor) captionMonitor.startPolling();
        return true;

      } catch (err) {
        logger.error(`ZoomAdapter(zoomJoiner): EXCEPTION in attempt ${attempt}: ${err.message}`);
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    logger.error(`ZoomAdapter(zoomJoiner): FAILED to activate captions after ${maxRetries} attempts.`);
    return false;
  }

  // ─────────────────────────────────────────────
  // VERIFY CAPTIONS ARE PRODUCING OUTPUT
  // ─────────────────────────────────────────────
  //
  // Polls briefly (up to ~10s) for either populated transcript rows in the
  // sidebar or a live caption bubble on screen. This is the missing
  // "did it actually work" check — everything before this only confirms a
  // click happened, not that captions ended up in the ON state.
  async verifyCaptionsProducingOutput(frame, timeoutMs = 10000, intervalMs = 1000) {
    const attempts = Math.ceil(timeoutMs / intervalMs);

    for (let i = 0; i < attempts; i++) {
      const active = await frame.evaluate(() => {
        const hasRows = document.querySelectorAll('.lt-full-transcript__item').length > 0;
        const hasBubble = !!document.querySelector(
          '.live-transcription-subtitle, .caption-bubble, [class*="live-caption"]'
        );
        const ccPressed = !!document.querySelector(
          'button[aria-label*="caption" i][aria-pressed="true"], .cc-button[aria-pressed="true"]'
        );
        return hasRows || hasBubble || ccPressed;
      }).catch(() => false);

      if (active) return true;
      await new Promise(r => setTimeout(r, intervalMs));
    }

    return false;
  }

  // ─────────────────────────────────────────────
  // ENABLE LIVE CAPTIONS (post-sidebar toggle)
  // ─────────────────────────────────────────────
  async enableLiveCaptions(frame) {
    // Preferred path: once the transcript sidebar is open, Zoom often
    // exposes a dedicated Closed-Caption ("CC") toggle directly in the
    // main toolbar. This is far more reliable than re-walking the "More"
    // menu, whose structure/labels can differ now that the sidebar is
    // showing.
    //
    // FIX: attribute selectors like [aria-label*="Turn On Captions"] are
    // CASE-SENSITIVE. Zoom's real labels vary in casing/wording across
    // versions/locales (e.g. "closed caption", "cc", "Captions"), so any
    // selector using the wrong case silently never matches and always
    // fell through to the slower "More" menu fallback. All caption-related
    // attribute selectors below now use the `i` (case-insensitive) flag.
    const direct = await frame.evaluate(() => {
      // Toolbar-style button match (pinned CC icon)
      const toolbarBtn =
        document.querySelector('button[aria-label*="Show Captions" i]') ||
        document.querySelector('button[aria-label*="Enable Captions" i]') ||
        document.querySelector('button[aria-label*="Turn On Captions" i]') ||
        document.querySelector('button[aria-label*="Closed Caption" i]') ||
        document.querySelector('button[aria-label*="caption" i]') ||
        document.querySelector('.cc-button');

      if (toolbarBtn) {
        toolbarBtn.click();
        return toolbarBtn.getAttribute('aria-label') || toolbarBtn.innerText.trim();
      }

      // "Show Captions" can also render as a non-<button> row inside an
      // ALREADY-OPEN "More" popup menu (icon + label stacked in a div/li/
      // role=menuitem). The toolbar-only selectors above never match this
      // shape, so scan visible menu-item-like elements for a label match
      // before falling back to the full re-open-the-menu sequence below.
      const isVisible = (el) => {
        const s = window.getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
      };

      const menuItemCandidates = Array.from(
        document.querySelectorAll('[role="menuitem"], .dropdown-item, li, div[class*="menu-item" i]')
      ).filter(isVisible);

      const showCaptionsItem = menuItemCandidates.find(el =>
        /^show captions$|^turn on captions$|^enable captions$/i.test((el.innerText || '').trim())
      );

      if (showCaptionsItem) {
        showCaptionsItem.click();
        return showCaptionsItem.innerText.trim();
      }

      return null;
    });

    if (direct) {
      logger.info(`ZoomAdapter(zoomJoiner): Captions enabled via direct toolbar control ("${direct}")`);
      return true;
    }

    // Fallback: walk the "More" menu again, but this time explicitly
    // EXCLUDE anything inside the transcript sidebar from candidate
    // matches, and require an exact (not substring) label match so
    // sidebar headers like "Transcript" can no longer be picked up by
    // accident.
    return frame.evaluate(async () => {
      const delay = ms => new Promise(r => setTimeout(r, ms));

      const inSidebar = (el) =>
        !!el.closest('.transcript-item-area, .zm-transcript-viewer, .zm-sidebar-pane, [class*="sidebar"], [id*="transcript"]');

      const getCandidates = (regex) =>
        Array.from(document.querySelectorAll('button, .dropdown-item, li, div[role="menuitem"]'))
          .filter(el => {
            if (inSidebar(el)) return false;
            const s = window.getComputedStyle(el);
            if (s.display === 'none' || s.visibility === 'hidden' || el.offsetWidth === 0) return false;
            return regex.test((el.innerText || el.ariaLabel || '').trim());
          });

      const clickFirst = (regex) => {
        const el = getCandidates(regex)[0];
        if (el) { el.click(); return (el.innerText || el.ariaLabel || '').trim(); }
        return null;
      };

      clickFirst(/^More$/i);
      await delay(1500);
      clickFirst(/^more options$/i);
      await delay(1500);
      // Exact match on the menu item label, not a substring — avoids
      // matching "View Full Transcript" or sidebar text that also
      // contains the word "Captions"/"Transcript".
      clickFirst(/^Captions$/i);
      await delay(1500);

      const toggled =
        clickFirst(/^Show Captions$/i) ||
        clickFirst(/^Enable Captions$/i) ||
        clickFirst(/^Turn On Captions$/i);

      return !!toggled;
    });
  }

  async handleHostPermissionPopup(frame) {
    logger.info('ZoomAdapter(zoomJoiner): Checking for Zoom modals...');

    try {
      let result = { status: 'not_found' };

      for (let i = 0; i < 2; i++) {
        result = await frame.evaluate(async () => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const saveBtn = buttons.find(btn => {
            const text = (btn.innerText || '').toLowerCase();
            return text.includes('save') || text.includes('confirm') || text.includes('done');
          });

          const bodyText = document.body.innerText;
          const isModalVisible = bodyText.includes('Language') || bodyText.includes('Captions');

          if (saveBtn && isModalVisible) {
            saveBtn.click();
            return { status: 'success', type: 'Caption Language Modal', btn: saveBtn.innerText };
          }

          return { status: 'not_found' };
        });

        if (result.status === 'success') break;
        await new Promise(r => setTimeout(r, 500));
      }

      if (result.status === 'success') {
        logger.info(`ZoomAdapter(zoomJoiner): Dismissed modal: ${result.type} via "${result.btn}"`);
      } else {
        logger.info('ZoomAdapter(zoomJoiner): No caption modals found');
      }
    } catch (err) {
      logger.error('ZoomAdapter(zoomJoiner): EXCEPTION in handleHostPermissionPopup: ' + err.message);
    }
  }

  async verifySidebarVisibility(frame) {
    logger.info('ZoomAdapter(zoomJoiner): Waiting for Sidebar...');

    const isVisible = await frame.evaluate(async () => {
      const delay = ms => new Promise(r => setTimeout(r, ms));

      for (let i = 0; i < 10; i++) {
        const header = Array.from(document.querySelectorAll('h1, h2, span, div'))
          .find(el => el.innerText && el.innerText.trim() === 'Transcript' && el.offsetWidth > 0);

        if (header) {
          const container = document.querySelector(
            '[class*="transcript"], [id*="transcript"], .zm-sidebar-pane'
          );
          if (container || header) return true;
        }
        await delay(500);
      }
      return false;
    });

    if (isVisible) {
      logger.info('ZoomAdapter(zoomJoiner): SIDEBAR_CONFIRMED via "Transcript" text');
      return true;
    }

    for (const sel of ['.transcript-item-area', '.zm-transcript-viewer', '.zm-sidebar-pane']) {
      const found = await frame.waitForSelector(sel, { timeout: 2000 })
        .then(() => true).catch(() => false);
      if (found) {
        logger.info(`ZoomAdapter(zoomJoiner): SIDEBAR_CONFIRMED via ${sel}`);
        return true;
      }
    }

    return false;
  }

  async executeNavigationSequence(frame) {
    // FIX: this sequence now ONLY opens the transcript sidebar (steps
    // 1-4). The old steps 5+ that tried to also toggle "Show Captions" by
    // re-walking the "More" menu have been removed from here and moved
    // into enableLiveCaptions(), which is called separately (and only)
    // once we've confirmed the sidebar is actually visible. See
    // startTranscriptMonitor() and enableLiveCaptions() for why.
    return await frame.evaluate(async () => {
      const delay = ms => new Promise(r => setTimeout(r, ms));
      const logs = [];
      const log = (varName, value) =>
        logs.push(`[STEP-LOG] ${new Date().toLocaleTimeString()} | ${varName}: ${JSON.stringify(value)}`);

      const getVisibleElements = () =>
        Array.from(document.querySelectorAll('button, .dropdown-item, li, span, div[role="menuitem"]'))
          .filter(el => {
            const s = window.getComputedStyle(el);
            return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetWidth > 0;
          });

      // DIAGNOSTIC: dump every visible button's aria-label/text + id/class
      // so if STEP1 still misses, we see the REAL selector for the
      // toolbar "More" button in this Zoom web client version instead of
      // guessing regexes blind.
      const toolbarDump = Array.from(document.querySelectorAll('button'))
        .filter(b => {
          const s = window.getComputedStyle(b);
          return s.display !== 'none' && s.visibility !== 'hidden' && b.offsetWidth > 0;
        })
        .map(b => ({
          text: (b.innerText || '').trim(),
          ariaLabel: b.getAttribute('aria-label') || '',
          id: b.id || '',
          cls: (b.className || '').toString().substring(0, 60)
        }));
      log('TOOLBAR_BUTTON_DUMP', toolbarDump);

      // POLL instead of fixed delay: wait up to `timeoutMs` for a
      // matching element to actually appear/render before clicking it,
      // re-checking every 300ms. Fixed delays fire the click regardless
      // of whether the menu has rendered yet, so on a slow frame the
      // click can land before the target exists.
      const waitAndClick = async (regex, label, timeoutMs = 4000) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          const target = getVisibleElements().find(
            el => regex.test((el.innerText || el.ariaLabel || '').trim())
          );
          if (target) {
            log(`${label}_CLICKING`, { text: (target.innerText || target.ariaLabel).trim(), waitedMs: Date.now() - start });
            target.click();
            return true;
          }
          await delay(300);
        }
        log(`${label}_NOT_FOUND`, { waitedMs: timeoutMs });
        return false;
      };

      const moreToolbarBtn = document.querySelector(
        '#moreButton button, [aria-label*="More meeting control" i], button[aria-label="More"]'
      );
      let step1Ok;
      if (moreToolbarBtn) {
        log('STEP1_MORE_CLICKING', { text: moreToolbarBtn.getAttribute('aria-label') || moreToolbarBtn.innerText });
        moreToolbarBtn.click();
        step1Ok = true;
      } else {
        step1Ok = await waitAndClick(/^More$/i, 'STEP1_MORE');
      }
      if (!step1Ok) return { status: 'FAIL', logs, failedAt: 'STEP1' };

      const directCaptionsBtn = document.querySelector(
        'button[aria-label*="Show Captions" i], button[aria-label*="Enable Captions" i], .new-lt-button'
      );
      if (directCaptionsBtn) {
        log('STEP_DIRECT_CAPTIONS_CLICK', { text: directCaptionsBtn.innerText || directCaptionsBtn.getAttribute('aria-label') });
        directCaptionsBtn.click();
        await delay(1500);
        
        await this.handleHostPermissionPopup(frame);
        return { status: 'SUCCESS', logs, failedAt: null };
      }

      await waitAndClick(/^more options$|^More$/i, 'STEP2_NESTED', 2500);

      const step3Ok = await waitAndClick(/^Captions$/i, 'STEP3_CAPTIONS_MENU');
      if (!step3Ok) return { status: 'FAIL', logs, failedAt: 'STEP3' };

      const hasView = await waitAndClick(/View Full Transcript|Show Transcript/i, 'STEP4_OPEN_SIDEBAR');
      await delay(1500);

      return { status: hasView ? 'SUCCESS' : 'FAIL', logs, failedAt: hasView ? null : 'STEP4' };

    });
  }
}

module.exports = ZoomJoiner;