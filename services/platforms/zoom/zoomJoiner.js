const { logger } = require('../../../utils/logger');
const fs = require('fs');
const path = require('path');

class ZoomJoiner {
  constructor(page, botName, passcode, meetingUrl) {
    this.page = page;
    this.botName = botName;
    this.passcode = passcode;
    this.meetingUrl = meetingUrl;
  }

  async joinMeeting() {
    logger.info('ZoomAdapter(zoomJoiner): STAGE 1: Navigating to Zoom (Deep Scan Flow)...');
    await this.page.goto(this.meetingUrl, { waitUntil: 'networkidle2' });

    let joined = false;
    let attempts = 0;

    while (!joined && attempts < 5) {
      attempts++;
      const allFrames = this.page.frames();
      logger.info(`ZoomAdapter(zoomJoiner): --- Join Attempt ${attempts} | Detected ${allFrames.length} frames ---`);

      for (let i = 0; i < allFrames.length; i++) {
        const frame = allFrames[i];
        const url = frame.url();
        
        if (!url || url === 'about:blank') continue;

        try {
          const analysis = await frame.evaluate((name, code) => {
            const findText = (regex) => Array.from(document.querySelectorAll('button, a, span, h1, div'))
              .find(el => regex.test(el.innerText));

            const hasLeave = !!document.querySelector('button[aria-label*="Leave"], .footer-button__leave-btn, #leave-btn');
            const nameInp = document.querySelector('input#input-for-name, input[placeholder*="name"], input[name*="name"]');
            const passInp = document.querySelector('input#inputpass, input[name*="pass"]');
            const joinBtn = Array.from(document.querySelectorAll('button')).find(b => /Join/i.test(b.innerText) || b.classList.contains('zm-btn--primary'));
            const launchLink = Array.from(document.querySelectorAll('a, button')).find(el => /Join from Your Browser/i.test(el.innerText));
            const cookieBtn = document.querySelector('#onetrust-accept-btn-handler, .optanon-allow-all');

            return {
              hasLeave,
              foundNameInput: !!nameInp,
              foundPassInput: !!passInp,
              foundJoinBtn: !!joinBtn,
              foundLaunchLink: !!launchLink,
              foundCookieBtn: !!cookieBtn,
              bodySnippet: document.body.innerText.substring(0, 100).replace(/\n/g, ' ')
            };
          }, this.botName, this.passcode);

          logger.info(`ZoomAdapter(zoomJoiner):  Frame[${i}] URL: ${url.substring(0, 50)}...`);
          logger.info(`ZoomAdapter(zoomJoiner):   - Content: "${analysis.bodySnippet}..."`);
          
          if (analysis.foundCookieBtn) {
            logger.info(`ZoomAdapter(zoomJoiner):  - [ACTION] Clicking Cookie Banner`);
            await frame.click('#onetrust-accept-btn-handler, .optanon-allow-all').catch(() => {});
          }

          if (analysis.foundLaunchLink) {
              logger.info(`ZoomAdapter(zoomJoiner): - [ACTION] Forcing "Join from Your Browser" flow`);
              
              await frame.evaluate(async () => {
                  // 1. Zoom often hides the link until 'Launch Meeting' is clicked at least once
                  const launchBtn = Array.from(document.querySelectorAll('button, a'))
                      .find(el => /Launch Meeting/i.test(el.innerText));
                  if (launchBtn) launchBtn.click();

                  // 2. Wait a split second then find and click the browser link
                  const browserLink = Array.from(document.querySelectorAll('a, button'))
                      .find(el => /Join from Your Browser/i.test(el.innerText));
                  
                  if (browserLink) {
                      browserLink.click();
                      return "CLICKED";
                  }
                  return "LINK_NOT_FOUND";
              });

              // 3. CRITICAL: Wait for the page to actually change to the web client
              await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {
                  logger.info("ZoomAdapter(zoomJoiner):  (Navigation timeout - might already be on the next page)");
              });
          }

          if (analysis.foundNameInput && !analysis.hasLeave) {
            logger.info(`ZoomAdapter(zoomJoiner): - [ACTION] Filling Name & Clicking Join`);
            await frame.type('input#input-for-name, input[placeholder*="name"]', this.botName);

            await frame.evaluate(async () => {
              const findAndClick = (text) => {
                const labels = Array.from(document.querySelectorAll('label, span, div'));
                const target = labels.find(el => el.innerText && el.innerText.includes(text));
                if (target) {
                  target.click(); 
                  return true;
                }
                return false;
              };

              findAndClick("Mute my microphone");
              findAndClick("Turn off my video");
            });
            await new Promise(r => setTimeout(r, 2000));

            if (analysis.foundPassInput) await frame.type('input#inputpass', this.passcode);
            await frame.evaluate(() => {
              const btn = Array.from(document.querySelectorAll('button')).find(b => /Join/i.test(b.innerText) || b.classList.contains('zm-btn--primary'));
              if (btn) btn.click();
            });
          }

          if (analysis.hasLeave) {
            joined = true;
            logger.info('ZoomAdapter(zoomJoiner): SUCCESS: Leave button detected!');
            break;
          }
        } catch (e) {
          logger.info(`ZoomAdapter(zoomJoiner): - Frame[${i}] is locked (Cross-Origin)`);
        }
      }

      if (joined) break;
      await new Promise(r => setTimeout(r, 5000));
    }

    if (!joined) {
      await this.page.screenshot({ path: './logs/image/stuck_debug.png' });
      logger.error('ZoomAdapter(zoomJoiner): FAILED: Saved stuck_debug.png. Check the logs above to see which frame had the buttons.');
      throw new Error('Zoom join failed');
    }
  }

  async checkCaptionsEnabled() {
    logger.info('ZoomAdapter(zoomJoiner): CHECK: Verifying if Host has enabled Live Captions...');
    const frame = this.page.frames().find(f => f.url().includes('zoom.us')) || this.page;

    const status = await frame.evaluate(() => {
      const captionBtn = document.querySelector('.footer-button-base__button-label[aria-label*="Caption"], .cc-button');
      const moreBtn = document.querySelector('.more-button, [aria-label*="more options"]');
      const hasText = document.body.innerText.match(/Captions|Transcript/i);

      if (captionBtn || hasText) return "ENABLED";
      if (moreBtn) return "CHECK_MORE_MENU";
      return "DISABLED";
    });

    if (status === "DISABLED") {
      logger.warn('ZoomAdapter(zoomJoiner):  ALERT: Live Captions are NOT enabled by the Host.');
      logger.info('ZoomAdapter(zoomJoiner): Action: On the Host Zoom app, click "More" -> "Captions" -> "Enable Auto-Transcription".');
      return false;
    }

    logger.info('ZoomAdapter(zoomJoiner): CONFIRMED: Captioning capability detected.');
    return true;
  }

  async sendChatRequest() {
    logger.info('ZoomAdapter(zoomJoiner): JT MODE: Sending chat request for captions...');
    const frame = this.page.frames().find(f => f.url().includes('zoom.us')) || this.page;

    try {
      await frame.evaluate((name) => {
        const chatBtn = document.querySelector('.footer-button-base__button-label[aria-label*="Chat"], .chat-button');
        if (chatBtn) chatBtn.click();

        setTimeout(() => {
          const textarea = document.querySelector('.chat-box__chat-textarea, #chat-textarea, textarea[placeholder*="message"]');
          if (textarea) {
            const msg = `Hi everyone, I'm ${name}. To help me transcribe this meeting, please click "Captions" and "Enable Auto-Transcription" in your Zoom toolbar. Thanks!`;
            
            textarea.value = msg;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            
            const enterEvent = new KeyboardEvent('keydown', {
              bubbles: true, cancelable: true, keyCode: 13, key: 'Enter'
            });
            textarea.dispatchEvent(enterEvent);
          }
        }, 1500);
      }, this.botName);
    } catch (e) {
      logger.error('ZoomAdapter(zoomJoiner): Chat Request Error: ' + e.message);
    }
  }

  async startTranscriptMonitor(captionMonitor) {
    logger.info('ZoomAdapter(zoomJoiner): [SYSTEM] Starting Step-by-Step Transcript Activation...');
    const frame = this.page.frames().find(f => f.url().includes('zoom.us/wc')) || this.page;

    try {
      const result = await this.executeNavigationSequence(frame);
      result.logs.forEach(l => logger.info(l));

      await this.handleHostPermissionPopup(frame);

      const isVisible = await this.verifySidebarVisibility(frame);
      logger.info(`ZoomAdapter(zoomJoiner): FINAL_VARIABLE_sidebarVisible: ${isVisible}`);

      if (isVisible) {
        logger.info("ZoomAdapter(zoomJoiner): SUCCESS: Sidebar and Captions activated.");
        if (captionMonitor) captionMonitor.startPolling();
      } else {
        logger.error("ZoomAdapter(zoomJoiner): ERROR: Sidebar did not open. Checking for blocking popups...");
        await this.page.screenshot({ path: `./logs/image/blocker_check_${Date.now()}.png` });
      }

    } catch (err) {
      logger.error('ZoomAdapter(zoomJoiner): EXCEPTION in startTranscriptMonitor: ' + err.message);
    }
  }

  async handleHostPermissionPopup(frame) {
      logger.info('ZoomAdapter(zoomJoiner): [START] handleHostPermissionPopup: Checking for Zoom modals...');

      try {
          logger.info('ZoomAdapter(zoomJoiner): test phase 1: Entering Retry Loop');
          
          let result = { status: 'not_found' };
          
          // Retry for up to 5 seconds because Zoom modals have fade-in animations
          for (let i = 0; i < 2; i++) {
              result = await frame.evaluate(async () => {
                  const delay = (ms) => new Promise(res => setTimeout(res, ms));
                  
                  // 1. Get all buttons on the page
                  const buttons = Array.from(document.querySelectorAll('button'));
                  
                  // 2. Look for the "Save", "Confirm", or "Done" button
                  const saveBtn = buttons.find(btn => {
                      const text = btn.innerText.toLowerCase();
                      return text.includes('save') || text.includes('confirm') || text.includes('done');
                  });

                  // 3. Look for the specific Language Modal text
                  const bodyText = document.body.innerText;
                  const isModalVisible = bodyText.includes('Language') || bodyText.includes('Captions');

                  if (saveBtn && isModalVisible) {
                      saveBtn.click();
                      return { status: 'success', type: 'Caption Language Modal', btn: saveBtn.innerText };
                  }

                  return { status: 'not_found' };
              });

              if (result.status === 'success') break;
              
              // Wait 500ms before next attempt
              await new Promise(res => setTimeout(res, 500));
          }

          logger.info(`ZoomAdapter(zoomJoiner): test phase 17: Result received`);

          if (result.status === 'success') {
              logger.info(`ZoomAdapter(zoomJoiner): [DETECTED] Found target modal: ${result.type}`);
              logger.info(`ZoomAdapter(zoomJoiner): [ACTION] Clicked "${result.btn}" button successfully.`);
          } else {
              logger.info('ZoomAdapter(zoomJoiner): [SKIP] No active Caption/Permission modals found after 5s retry.');
              
              // --- FAILSAFE ---
              // If the modal is visible but we can't "find" the button via text, 
              // hitting "Enter" usually triggers the primary blue button (Save).
              logger.info('ZoomAdapter(zoomJoiner): [FAILSAFE] Pressing Enter key to clear potential stuck modal...');
              // await page.keyboard.press('Enter');
          }

      } catch (err) {
          logger.error('ZoomAdapter(zoomJoiner): EXCEPTION in handleHostPermissionPopup: ' + err.message);
      }
      
      logger.info('ZoomAdapter(zoomJoiner): [FINISH] handleHostPermissionPopup: Check complete.');
  }

  async verifySidebarVisibility(frame) {
    logger.info('ZoomAdapter(zoomJoiner): Waiting for Sidebar to settle in DOM (Deep Text Scan)...');
    
    const isVisible = await frame.evaluate(async () => {
      const delay = (ms) => new Promise(res => setTimeout(res, ms));
      
      for (let i = 0; i < 10; i++) {
        const elements = Array.from(document.querySelectorAll('h1, h2, span, div'));
        const header = elements.find(el => 
          el.innerText && 
          el.innerText.trim() === "Transcript" && 
          el.offsetWidth > 0
        );

        if (header) {
          const container = document.querySelector('[class*="transcript"], [id*="transcript"], .zm-sidebar-pane');
          if (container || header) return true;
        }
        await delay(500);
      }
      return false;
    });

    if (isVisible) {
      logger.info(`ZoomAdapter(zoomJoiner): SIDEBAR_CONFIRMED: Found via text "Transcript"`);
      return true;
    }

    const backupSelectors = ['.transcript-item-area', '.zm-transcript-viewer', '.zm-sidebar-pane'];
    for (const sel of backupSelectors) {
      const found = await frame.waitForSelector(sel, { timeout: 2000 }).then(() => true).catch(() => false);
      if (found) {
        logger.info(`ZoomAdapter(zoomJoiner): SIDEBAR_CONFIRMED: Found via backup selector ${sel}`);
        return true;
      }
    }

    return false;
  }

  async executeNavigationSequence(frame) {
    return await frame.evaluate(async () => {
      const delay = (ms) => new Promise(res => setTimeout(res, ms));
      const logs = [];
      const log = (varName, value) => logs.push(`[STEP-LOG] ${new Date().toLocaleTimeString()} | ${varName}: ${JSON.stringify(value)}`);

      const getVisibleElements = () => {
        return Array.from(document.querySelectorAll('button, .dropdown-item, li, span, div[role="menuitem"]'))
          .filter(el => {
            const s = window.getComputedStyle(el);
            return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetWidth > 0;
          });
      };

      const findAndClick = (regex, label) => {
        const visible = getVisibleElements();
        const target = visible.find(el => regex.test((el.innerText || el.ariaLabel || "").trim()));
        if (target) {
          const rect = target.getBoundingClientRect();
          log(`${label}_CLICKING`, { text: (target.innerText || target.ariaLabel).trim(), x: rect.left + rect.width/2, y: rect.top + rect.height/2 });
          target.click();
          return true;
        }
        return false;
      };

      findAndClick(/More/i, "STEP1_MORE");
      await delay(2000);

      findAndClick(/more options|^More$/i, "STEP2_NESTED");
      await delay(2000);

      findAndClick(/Captions|Transcript/i, "STEP3_CAPTIONS_MENU");
      await delay(2000);

      findAndClick(/View Full Transcript|Show Transcript/i, "STEP4_OPEN_SIDEBAR");
      await delay(4000); 
      
      findAndClick(/More/i, "STEP5_REOPEN_MORE");
      await delay(1500);
      findAndClick(/more options|^More$/i, "STEP5_REOPEN_NESTED");
      await delay(1500);
      findAndClick(/Captions|Transcript/i, "STEP5_REOPEN_CAPTIONS");
      await delay(1500);
      
      const hasView = findAndClick(/Show Captions|Enable Captions/i, "STEP5_SHOW_CAPTIONS_TOGGLE");

      return { status: hasView ? "SUCCESS" : "FAIL", logs };
    });
  }


}

module.exports = ZoomJoiner;