/**
 * services/platforms/zoom/zoomJoiner.js
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
  // Looks for state that can only be true when captions/transcript are
  // ACTUALLY active: a "Hide Captions" button (current Zoom UI's own
  // on-state indicator — see screenshot), a toggled/pressed caption
  // button, a live caption bubble on screen, or existing transcript rows
  // in the sidebar. Anything else is treated as "not yet confirmed on".
  async checkCaptionsEnabled() {
    logger.info('ZoomAdapter(zoomJoiner): CHECK: Verifying if captions/transcript are actually active...');
    const frame = this.page.frames().find(f => f.url().includes('zoom.us')) || this.page;

    const status = await frame.evaluate(() => {
      // 1. Current Zoom UI's clearest on-state signal: the toolbar button
      // itself is labeled "Hide Captions" once captions are running.
      const hideCaptionsBtn = document.querySelector('button[aria-label*="Hide Captions" i]');

      // 2. Caption/CC button reporting an "on"/"pressed" state (older UI)
      const ccButton = document.querySelector(
        'button[aria-label*="caption" i][aria-pressed="true"], ' +
        'button[aria-label*="caption" i][aria-checked="true"], ' +
        '.cc-button[aria-pressed="true"]'
      );

      // 3. Live caption bubble actually rendering text on screen
      const liveCaptionBubble = document.querySelector(
        '.live-transcription-subtitle, .caption-bubble, [class*="live-caption"]'
      );

      // 4. Transcript sidebar already has content rows
      const transcriptRows = document.querySelectorAll('.lt-full-transcript__item');

      if (hideCaptionsBtn || ccButton || liveCaptionBubble || transcriptRows.length > 0) {
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

  // ─────────────────────────────────────────────
  // MAIN TRANSCRIPT ACTIVATION LOOP
  // ─────────────────────────────────────────────
  //
  // Current Zoom UI exposes "Show Captions" directly via the "More" (...)
  // menu, followed by a one-time "Set the caption language" modal, then
  // a persistent "Hide Captions" toolbar button + caret dropdown that
  // exposes "View full transcript". See enableLiveCaptions() for the full
  // 6-step sequence this drives.
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

        const sequenceOk = await this.enableLiveCaptions(frame);
        if (!sequenceOk) {
          logger.warn(`ZoomAdapter(zoomJoiner): Attempt ${attempt}: caption/transcript sequence failed — retrying...`);
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }

        const isVisible = await this.verifySidebarVisibility(frame);
        logger.info(`ZoomAdapter(zoomJoiner): sidebarVisible: ${isVisible}`);

        if (!isVisible) {
          logger.warn(`ZoomAdapter(zoomJoiner): Attempt ${attempt}: transcript sidebar did not open — retrying...`);
          await this.page.screenshot({ path: `./logs/image/blocker_check_attempt${attempt}_${Date.now()}.png` }).catch(() => {});
          continue;
        }

        logger.info('ZoomAdapter(zoomJoiner): SUCCESS: Sidebar opened.');

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
  // sidebar or a live caption bubble on screen. This is the "did it
  // actually work" check — everything before this only confirms a click
  // happened, not that captions ended up in the ON state.
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
        const hideCaptionsBtn = !!document.querySelector('button[aria-label*="Hide Captions" i]');
        return hasRows || hasBubble || ccPressed || hideCaptionsBtn;
      }).catch(() => false);

      if (active) return true;
      await new Promise(r => setTimeout(r, intervalMs));
    }

    return false;
  }

  // ─────────────────────────────────────────────
  // DIAGNOSTIC: dump every visible interactive element's identifying
  // info (text, aria-label, tag, id, class, and — critically — its
  // *position in the DOM relative to a reference element* when one is
  // given). This is what actually replaces guessing: instead of assuming
  // a selector, the first failure on a given selector logs the real
  // candidates so the exact selector can be locked in from the log
  // output rather than inferred from a screenshot a second time.
  // ─────────────────────────────────────────────
  async _dumpInteractiveElements(frame, label, referenceSelector = null) {
    const dump = await frame.evaluate((refSel) => {
      const isVisible = (el) => {
        const s = window.getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
      };
      const els = Array.from(document.querySelectorAll('button, [role="menuitem"], a, div[tabindex]'))
        .filter(isVisible)
        .map(el => ({
          tag: el.tagName.toLowerCase(),
          text: (el.innerText || '').trim().substring(0, 40),
          ariaLabel: el.getAttribute('aria-label') || '',
          ariaHaspopup: el.getAttribute('aria-haspopup') || '',
          id: el.id || '',
          cls: (el.className || '').toString().substring(0, 60),
        }));

      let refInfo = null;
      if (refSel) {
        const ref = document.querySelector(refSel);
        if (ref) {
          const parent = ref.parentElement;
          refInfo = {
            refFound: true,
            parentTag: parent ? parent.tagName.toLowerCase() : null,
            parentCls: parent ? (parent.className || '').toString().substring(0, 80) : null,
            siblingCount: parent ? parent.children.length : 0,
            siblings: parent ? Array.from(parent.children).map(c => ({
              tag: c.tagName.toLowerCase(),
              text: (c.innerText || '').trim().substring(0, 30),
              ariaLabel: c.getAttribute('aria-label') || '',
              cls: (c.className || '').toString().substring(0, 60),
            })) : [],
          };
        } else {
          refInfo = { refFound: false };
        }
      }

      return { els, refInfo };
    }, referenceSelector).catch(() => null);

    if (dump) {
      logger.warn(`ZoomAdapter(zoomJoiner): DIAGNOSTIC_DUMP[${label}] interactiveElements=${JSON.stringify(dump.els)}`);
      if (dump.refInfo) {
        logger.warn(`ZoomAdapter(zoomJoiner): DIAGNOSTIC_DUMP[${label}] referenceContext=${JSON.stringify(dump.refInfo)}`);
      }
    }
  }

  // ─────────────────────────────────────────────
  // NATIVE CLICK (root-cause fix)
  // ─────────────────────────────────────────────
  //
  // WHY THIS EXISTS: every previous version of this method called
  // `el.click()` from *inside* `frame.evaluate()`. That's a purely
  // synthetic DOM API call — it does NOT dispatch real mousedown/mouseup/
  // pointerdown events, and it does not set `event.isTrusted = true`.
  // Zoom's web client (like most modern React/Vue apps) frequently wires
  // its actual interaction handlers to pointer/mouse events rather than
  // the high-level "click" DOM event, and some of that wiring silently
  // ignores untrusted synthetic events. Net effect: the element gets
  // focused/highlighted (you can literally see the outline appear, as in
  // your screenshot), but the app's own click handler never fires — which
  // matches "it can focus on that but not click" exactly.
  //
  // FIX: use `frame.evaluateHandle()` to get a live handle to the actual
  // DOM node, convert it to a Puppeteer `ElementHandle`, and call
  // `elementHandle.click()`. That goes through the CDP `Input.dispatchMouseEvent`
  // pipeline — a REAL, trusted mouse click at the element's real screen
  // coordinates — which is what actually triggers pointer/mouse-based
  // handlers.
  //
  // `finderFn` must be a function that RETURNS the element (not a
  // boolean) when run in the page, e.g. `() => document.querySelector(...)`.
  async _pollAndClickNative(frame, finderFn, timeoutMs = 5000, intervalMs = 300) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      let handle = null;
      try {
        handle = await frame.evaluateHandle(finderFn);
        const el = handle.asElement ? handle.asElement() : null;
        if (el) {
          // Scroll into view defensively — click() does this internally
          // too, but doing it explicitly avoids edge cases with elements
          // partially behind other floating panels.
          await el.evaluate(node => node.scrollIntoView({ block: 'center', inline: 'center' })).catch(() => {});
          await el.click({ delay: 50 });
          await handle.dispose().catch(() => {});
          return true;
        }
      } catch (e) {
        // Element may have detached/re-rendered mid-click (common right
        // after a menu opens) — just retry on the next poll tick.
      }
      if (handle) await handle.dispose().catch(() => {});
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return false;
  }

  // Boolean-condition poll (no click) — used where we only need to WAIT
  // for something to become true, e.g. confirming a label swapped.
  async _pollUntilTrue(frame, conditionFn, timeoutMs = 4000, intervalMs = 300) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const ok = await frame.evaluate(conditionFn).catch(() => false);
      if (ok) return true;
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return false;
  }

  // ─────────────────────────────────────────────
  // KEYBOARD TAB-SCAN + ACTIVATE (primary strategy)
  // ─────────────────────────────────────────────
  //
  // This replicates, exactly, the manual workflow that's confirmed to
  // work: press Tab repeatedly, read whatever the browser's native focus
  // order lands on (document.activeElement), and once its visible text /
  // aria-label matches what we're looking for, press Enter to activate
  // it. This sidesteps DOM-selector guessing entirely — the browser's own
  // accessibility/focus order does the finding, and Tab/Enter sent via
  // Puppeteer's `page.keyboard` are real, trusted key events (keydown →
  // keypress → keyup), so whatever handler a genuine keypress would
  // trigger, this triggers too. No synthetic-event trust issues.
  //
  // `matchFn(label, info)` receives the focused element's label (its
  // aria-label if present, else its innerText) and the raw info object
  // `{tag, text, ariaLabel}`, and returns true when this is the target
  // element. Every tab stop is logged so a failed scan still gives full
  // visibility into what the real focus order actually was.
  async _tabScanAndActivate(frame, matchFn, { maxTabs = 25, tabDelayMs = 200, label = 'TAB_SCAN' } = {}) {
    const page = this.page;

    for (let i = 1; i <= maxTabs; i++) {
      await page.keyboard.press('Tab');
      await new Promise(r => setTimeout(r, tabDelayMs));

      const focused = await frame.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body || el === document.documentElement) return null;
        return {
          tag: el.tagName ? el.tagName.toLowerCase() : '',
          text: (el.innerText || '').trim(),
          ariaLabel: el.getAttribute ? (el.getAttribute('aria-label') || '') : '',
        };
      }).catch(() => null);

      if (!focused) continue;

      const candidateLabel = (focused.ariaLabel || focused.text || '').trim();
      logger.info(`ZoomAdapter(zoomJoiner): [${label}] tab ${i}/${maxTabs}: focused="${candidateLabel}" (tag=${focused.tag})`);

      if (candidateLabel && matchFn(candidateLabel, focused)) {
        logger.info(`ZoomAdapter(zoomJoiner): [${label}] MATCH on tab ${i} ("${candidateLabel}") — pressing Enter`);
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 400));
        return true;
      }
    }

    logger.warn(`ZoomAdapter(zoomJoiner): [${label}] no match found within ${maxTabs} tab presses`);
    return false;
  }

  // Press Tab exactly `count` times without any text matching, then
  // Enter. Used where the target is a fixed number of tab-stops away
  // from wherever focus currently sits (e.g. the caret directly after
  // "Show Captions"), rather than something to search for by label.
  async _tabNTimesThenEnter(frame, count, { tabDelayMs = 200 } = {}) {
    const page = this.page;
    let lastFocused = null;

    for (let i = 1; i <= count; i++) {
      await page.keyboard.press('Tab');
      await new Promise(r => setTimeout(r, tabDelayMs));

      lastFocused = await frame.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        return {
          tag: el.tagName ? el.tagName.toLowerCase() : '',
          text: (el.innerText || '').trim(),
          ariaLabel: el.getAttribute ? (el.getAttribute('aria-label') || '') : '',
        };
      }).catch(() => null);
    }

    const label = lastFocused ? (lastFocused.ariaLabel || lastFocused.text || '(unlabeled)') : '(none)';
    logger.info(`ZoomAdapter(zoomJoiner): TAB_N: pressed Tab ${count}x — landed on "${label}" — pressing Enter`);
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 400));
    return !!lastFocused;
  }

  // ─────────────────────────────────────────────
  // ENABLE LIVE CAPTIONS + OPEN TRANSCRIPT SIDEBAR
  // ─────────────────────────────────────────────
  //
  // Follows the CONFIRMED-WORKING manual keyboard workflow:
  //
  //   STEP 1: Tab-scan until focus lands on "More" (...) — press Enter
  //           (opens the toolbar panel)
  //   STEP 2: Tab repeatedly until focus lands on an element whose label
  //           contains "captions" (Show/Hide/View Captions) — press Enter
  //   STEP 3: A "Set the caption language" modal may appear — Tab-scan
  //           for "Save" and press Enter
  //   STEP 4: Confirm the toolbar button now reads "Hide Captions"
  //   STEP 5: Press Tab exactly once more (lands on the caret next to
  //           Hide Captions) — press Enter
  //   STEP 6: Tab repeatedly until focus lands on "View full transcript"
  //           — press Enter
  //
  // If captions are already ON (e.g. a retry after a partial failure),
  // steps 1–4 are skipped and we go straight to STEP 5.
  async enableLiveCaptions(frame) {
    const delay = ms => new Promise(r => setTimeout(r, ms));

    const alreadyOn = await frame.evaluate(() => {
      return !!document.querySelector('button[aria-label*="Hide Captions" i]');
    });

    if (!alreadyOn) {
      // ── STEP 1: Tab-scan until focus lands on the "More" button, then
      // Enter. This is its own dedicated loop — it ONLY looks for "More"
      // and does nothing else until that specific match is found and
      // activated. Only once STEP 1 succeeds does control move on to the
      // STEP 2 loop (which scans for "captions" instead).
      //
      // NOTE: this replaces the previous native-mouse-click approach for
      // STEP1. Trade-off to be aware of: if a native browser-chrome
      // element (e.g. Chrome's own "Restore pages?" infobar from an
      // unclean profile shutdown) has OS-level focus when this starts,
      // Tab presses will cycle through ITS buttons first, not the page's,
      // and this loop can run out its maxTabs without ever reaching
      // "More". If that becomes a problem in practice, the fix is to
      // ensure the page/frame has focus before this loop starts (e.g.
      // `await this.page.bringToFront()` or an initial click into the
      // page body) rather than reverting to the native-click approach.
      const step1 = await this._tabScanAndActivate(
        frame,
        (label) => /^more$/i.test(label) || /more meeting control/i.test(label),
        { maxTabs: 25, tabDelayMs: 200, label: 'STEP1_FIND_MORE' }
      );

      if (!step1) {
        logger.warn('ZoomAdapter(zoomJoiner): STEP1 failed — could not find "More" button while tabbing.');
        await this._dumpInteractiveElements(frame, 'STEP1_MORE_BUTTON');
        return false;
      }
      logger.info('ZoomAdapter(zoomJoiner): STEP1 OK — activated "More" via Tab + Enter.');
      await delay(800);

      // ── STEP 2: Tab-scan for "captions" in the focused element's
      // label, then Enter. Matches "Show Captions" / "Captions" / any
      // label containing the word, exactly like the manual process.
      // This loop only starts once STEP 1 above has completed.
      const step2 = await this._tabScanAndActivate(
        frame,
        (label) => /caption/i.test(label),
        { maxTabs: 25, tabDelayMs: 200, label: 'STEP2_FIND_CAPTIONS' }
      );

      if (!step2) {
        logger.warn('ZoomAdapter(zoomJoiner): STEP2 failed — no "captions" label found while tabbing.');
        await this._dumpInteractiveElements(frame, 'STEP2_SHOW_CAPTIONS');
        return false;
      }
      logger.info('ZoomAdapter(zoomJoiner): STEP2 OK — activated "Captions" via Tab + Enter.');
      await delay(1000);

      // ── STEP 3: "Set the caption language" modal → Tab-scan for
      // "Save" and press Enter. Only appears the first time captions are
      // enabled in a meeting; absence is non-fatal.
      const modalPresent = await frame.evaluate(() => {
        const bodyText = (document.body.innerText || '').toLowerCase();
        return bodyText.includes('caption language') || bodyText.includes('set the caption language');
      });

      if (modalPresent) {
        const saved = await this._tabScanAndActivate(
          frame,
          (label) => /^save$/i.test(label),
          { maxTabs: 10, tabDelayMs: 200, label: 'STEP3_FIND_SAVE' }
        );
        logger.info(`ZoomAdapter(zoomJoiner): STEP3 (caption language modal): ${saved ? 'saved via Tab+Enter' : 'save_not_activated'}`);
      } else {
        logger.info('ZoomAdapter(zoomJoiner): STEP3 (caption language modal): no_modal');
      }
      await delay(1000);

      // Some accounts show a separate consent modal ("This meeting is
      // being transcribed... OK") instead of / in addition to the
      // language modal — sweep for it too before checking final state.
      await this.handleHostPermissionPopup(frame);

      // ── STEP 4: confirm captions are actually ON now.
      const confirmedOn = await this._pollUntilTrue(frame, () => {
        return !!document.querySelector('button[aria-label*="Hide Captions" i]');
      }, 4000);

      if (!confirmedOn) {
        logger.warn('ZoomAdapter(zoomJoiner): STEP4 failed — "Hide Captions" button not found after Save.');
        await this._dumpInteractiveElements(frame, 'STEP4_HIDE_CAPTIONS_CONFIRM');
        return false;
      }
      logger.info('ZoomAdapter(zoomJoiner): STEP4 OK — captions confirmed ON ("Hide Captions" button present).');

      // ── STEP 5: exactly one more Tab from wherever we are now lands
      // on the caret next to "Hide Captions" — press Enter to open the
      // Captions dropdown, matching the manual process precisely.
      const step5 = await this._tabNTimesThenEnter(frame, 1);

      if (!step5) {
        logger.warn('ZoomAdapter(zoomJoiner): STEP5 failed — Tab did not land on a focusable element.');
        await this._dumpInteractiveElements(frame, 'STEP5_CAPTIONS_CARET', 'button[aria-label*="Hide Captions" i]');
        return false;
      }
      logger.info('ZoomAdapter(zoomJoiner): STEP5 OK — opened Captions dropdown via Tab + Enter.');
      await delay(800);
    } else {
      logger.info('ZoomAdapter(zoomJoiner): Captions already ON — skipping STEP1–4.');

      // Still need to open the Captions dropdown — Tab-scan directly for
      // its trigger since we don't know how many tabs away it is from
      // wherever focus currently sits on a retry.
      const step5 = await this._tabScanAndActivate(
        frame,
        (label) => /caption/i.test(label) && /more|option|setting/i.test(label),
        { maxTabs: 25, tabDelayMs: 200, label: 'STEP5_FIND_CARET_RETRY' }
      );

      if (!step5) {
        logger.warn('ZoomAdapter(zoomJoiner): STEP5 (retry path) failed — could not find Captions dropdown trigger.');
        await this._dumpInteractiveElements(frame, 'STEP5_CAPTIONS_CARET_RETRY');
        return false;
      }
      logger.info('ZoomAdapter(zoomJoiner): STEP5 (retry path) OK — opened Captions dropdown via Tab + Enter.');
      await delay(800);
    }

    // ── STEP 6: Tab-scan for "full transcript" in the focused element's
    // label, then Enter — exactly like the manual process.
    const step6 = await this._tabScanAndActivate(
      frame,
      (label) => /full transcript/i.test(label) || /show transcript/i.test(label),
      { maxTabs: 15, tabDelayMs: 200, label: 'STEP6_FIND_TRANSCRIPT' }
    );

    if (!step6) {
      logger.warn('ZoomAdapter(zoomJoiner): STEP6 failed — no "full transcript" label found while tabbing.');
      await this._dumpInteractiveElements(frame, 'STEP6_VIEW_FULL_TRANSCRIPT');
      return false;
    }
    logger.info('ZoomAdapter(zoomJoiner): STEP6 OK — activated "View full transcript" via Tab + Enter.');
    await delay(800);

    return true;
  }

  // ─────────────────────────────────────────────
  // HANDLE MODALS (caption language / transcription consent)
  // ─────────────────────────────────────────────
  //
  // FIX: previously only matched buttons containing "save"/"confirm"/
  // "done" and modal text containing "Language"/"Captions". That missed
  // the "This meeting is being transcribed" consent modal, whose only
  // action button is "OK". Both button text and modal-body matching are
  // widened below to catch that case.
  async handleHostPermissionPopup(frame) {
    logger.info('ZoomAdapter(zoomJoiner): Checking for Zoom modals...');

    try {
      const isModalVisible = await frame.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return (
          bodyText.includes('Language') ||
          bodyText.includes('Captions') ||
          bodyText.includes('being transcribed') ||
          bodyText.includes('transcript')
        );
      });

      if (!isModalVisible) {
        logger.info('ZoomAdapter(zoomJoiner): No caption modals found');
        return;
      }

      // Native click (see _pollAndClickNative comment) — a synthetic
      // el.click() here previously risked the same "focuses but doesn't
      // activate" issue on the modal's Save/OK button.
      const clicked = await this._pollAndClickNative(frame, () => {
        return Array.from(document.querySelectorAll('button')).find(btn => {
          const text = (btn.innerText || '').trim().toLowerCase();
          return text === 'save' || text === 'confirm' || text === 'done' || text === 'ok';
        }) || null;
      }, 2500);

      if (clicked) {
        logger.info('ZoomAdapter(zoomJoiner): Dismissed modal (native click on Save/Confirm/Done/OK).');
      } else {
        logger.warn('ZoomAdapter(zoomJoiner): Modal text detected but could not click its action button.');
        await this._dumpInteractiveElements(frame, 'MODAL_ACTION_BUTTON');
      }
    } catch (err) {
      logger.error('ZoomAdapter(zoomJoiner): EXCEPTION in handleHostPermissionPopup: ' + err.message);
    }
  }

  // ─────────────────────────────────────────────
  // VERIFY TRANSCRIPT SIDEBAR VISIBLE
  // ─────────────────────────────────────────────

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
}

module.exports = ZoomJoiner;