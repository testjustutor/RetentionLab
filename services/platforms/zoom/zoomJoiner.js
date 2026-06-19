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
            break;
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

    if (analysis.foundNameInput && !analysis.hasLeave) {
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
  // REST OF METHODS — unchanged
  // ─────────────────────────────────────────────
  async checkCaptionsEnabled() {
    logger.info('ZoomAdapter(zoomJoiner): CHECK: Verifying if Host has enabled Live Captions...');
    const frame = this.page.frames().find(f => f.url().includes('zoom.us')) || this.page;

    const status = await frame.evaluate(() => {
      const captionBtn = document.querySelector(
        '.footer-button-base__button-label[aria-label*="Caption"], .cc-button'
      );
      const moreBtn = document.querySelector('.more-button, [aria-label*="more options"]');
      const hasText = document.body.innerText.match(/Captions|Transcript/i);

      if (captionBtn || hasText) return 'ENABLED';
      if (moreBtn) return 'CHECK_MORE_MENU';
      return 'DISABLED';
    });

    if (status === 'DISABLED') {
      logger.warn('ZoomAdapter(zoomJoiner): ALERT: Live Captions are NOT enabled by the Host.');
      return false;
    }

    logger.info('ZoomAdapter(zoomJoiner): CONFIRMED: Captioning capability detected.');
    return true;
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

  async startTranscriptMonitor(captionMonitor) {
    logger.info('ZoomAdapter(zoomJoiner): Starting Transcript Activation...');
    const frame = this.page.frames().find(f => f.url().includes('zoom.us/wc')) || this.page;

    try {
      const result = await this.executeNavigationSequence(frame);
      result.logs.forEach(l => logger.info(l));

      await this.handleHostPermissionPopup(frame);

      const isVisible = await this.verifySidebarVisibility(frame);
      logger.info(`ZoomAdapter(zoomJoiner): sidebarVisible: ${isVisible}`);

      if (isVisible) {
        logger.info('ZoomAdapter(zoomJoiner): SUCCESS: Sidebar and Captions activated.');
        if (captionMonitor) captionMonitor.startPolling();
      } else {
        logger.error('ZoomAdapter(zoomJoiner): ERROR: Sidebar did not open.');
        await this.page.screenshot({ path: `./logs/image/blocker_check_${Date.now()}.png` }).catch(() => {});
      }
    } catch (err) {
      logger.error('ZoomAdapter(zoomJoiner): EXCEPTION in startTranscriptMonitor: ' + err.message);
    }
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

      const findAndClick = (regex, label) => {
        const target = getVisibleElements().find(
          el => regex.test((el.innerText || el.ariaLabel || '').trim())
        );
        if (target) {
          log(`${label}_CLICKING`, { text: (target.innerText || target.ariaLabel).trim() });
          target.click();
          return true;
        }
        return false;
      };

      findAndClick(/More/i, 'STEP1_MORE');
      await delay(2000);
      findAndClick(/more options|^More$/i, 'STEP2_NESTED');
      await delay(2000);
      findAndClick(/Captions|Transcript/i, 'STEP3_CAPTIONS_MENU');
      await delay(2000);
      findAndClick(/View Full Transcript|Show Transcript/i, 'STEP4_OPEN_SIDEBAR');
      await delay(4000);
      findAndClick(/More/i, 'STEP5_REOPEN_MORE');
      await delay(1500);
      findAndClick(/more options|^More$/i, 'STEP5_REOPEN_NESTED');
      await delay(1500);
      findAndClick(/Captions|Transcript/i, 'STEP5_REOPEN_CAPTIONS');
      await delay(1500);
      const hasView = findAndClick(/Show Captions|Enable Captions/i, 'STEP5_SHOW_CAPTIONS_TOGGLE');

      return { status: hasView ? 'SUCCESS' : 'FAIL', logs };
    });
  }
}

module.exports = ZoomJoiner;