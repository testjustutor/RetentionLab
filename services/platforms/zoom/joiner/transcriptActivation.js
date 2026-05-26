const { logger } = require('../../../../utils/logger');

class TranscriptActivation {
  constructor(page, getZoomFrame, findTranscriptInAnyFrame) {
    this.page = page;
    this.getZoomFrame = getZoomFrame;
    this.findTranscriptInAnyFrame = findTranscriptInAnyFrame;
  }

  // --- CORE UTILITIES ---
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async verifySidebarVisibility(frame) {
    for (let i = 0; i < 6; i++) {
      const isVisible = await frame.evaluate(() => {
        const header = Array.from(document.querySelectorAll('h1, h2, span, div')).find(el => el.innerText && el.innerText.trim() === "Transcript" && el.offsetWidth > 0);
        const container = document.querySelector('[class*="transcript"], [id*="transcript"], .zm-sidebar-pane');
        return !!(container || header);
      });
      if (isVisible) return true;
      await this.delay(500);
    }
    return await this.findTranscriptInAnyFrame();
  }

  async findTranscriptInAnyFrame() {
    const frames = this.page.frames();
    for (const candidate of frames) {
      const found = await candidate.evaluate(() => {
        const selectors = ['.transcript-item-area', '.zm-transcript-viewer', '.zm-sidebar-pane', '[aria-label*="Transcript"]'];
        if (selectors.some(sel => document.querySelector(sel))) return true;
        
        return !!Array.from(document.querySelectorAll('span, div, h1, h2, p, li')).find(el => el.innerText && /Transcript|Caption|Live Transcript/i.test(el.innerText) && el.offsetParent !== null);
      }).catch(() => false);
      
      if (found) return true;
    }
    return false;
  }

  // ==========================================
  // INDIVIDUAL STEP FUNCTIONS
  // ==========================================

  async stepWakeUI(frame) {
    logger.info('ZoomAdapter(reactiveJoinFlow): Action - Waking up UI');
    await frame.evaluate(() => document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })));
    await this.delay(800);
  }

  async stepClickMore(frame, phase) {
    logger.info(`ZoomAdapter(reactiveJoinFlow): Action - Clicking "More" (${phase})`);
    const clicked = await frame.evaluate(() => {
      const selectors = [
        '#moreButton button',
        '[aria-label*="More meeting control"]',
        'button[aria-label*="More"]',
        '.more_button',
        '[role="button"][aria-label*="More"]'
      ];
      for (const sel of selectors) {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null) { 
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (!clicked) logger.warn(`ZoomAdapter(reactiveJoinFlow): WARNING: "More" button not found (${phase})`);
    await this.delay(1200);
    return clicked;
  }

  async helperClickDropdown(frame, regexStr, ariaSelectors, stepName) {
    logger.info(`ZoomAdapter(reactiveJoinFlow): ACTION: Clicking "${stepName}"`);

    const clicked = await frame.evaluate((regex, ariaSel) => {
      const matcher = new RegExp(regex, 'i');

      const nodes = Array.from(document.querySelectorAll(`
        .dropdown-item,
        .more-button__item-box,
        a[role="button"],
        button,
        li,
        div[role="button"],
        div[role="menuitem"],
        [aria-label],
        [data-testid]
      `));

      const visible = (el) => {
        if (!el) return false;

        const style = window.getComputedStyle(el);

        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          el.offsetWidth > 0 &&
          el.offsetHeight > 0
        );
      };

      const getText = (el) => {
        return [
          el.innerText,
          el.textContent,
          el.getAttribute('aria-label'),
          el.getAttribute('title'),
          el.getAttribute('data-testid')
        ]
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      };

      for (const el of nodes) {
        if (visible(el) && matcher.test(getText(el))) {
          el.click();
          return getText(el);
        }
      }

      for (const selector of ariaSel) {
        const el = document.querySelector(selector);

        if (visible(el)) {
          el.click();
          return selector;
        }
      }

      return null;
    }, regexStr, ariaSelectors);

    if (!clicked) {
      logger.warn(`ZoomAdapter(reactiveJoinFlow): WARNING: Failed to find target for ${stepName}`);
    } else {
      logger.info(`ZoomAdapter(reactiveJoinFlow): SUCCESS: Clicked "${clicked}"`);
    }

    await this.delay(1200);
    return clicked;
  }

  async stepClickCaptionsFolder(frame, phase) {
    return await this.helperClickDropdown(
      frame, 
      '^Captions?$|^Live Transcript$', 
      ['[aria-label*="Caption"]', '[aria-label*="Live Transcript"]'], 
      `Captions Folder (${phase})`
    );
  }

  async stepClickShowCaptions(frame) {
    const success = await this.helperClickDropdown(frame, 'show caption|enable caption', [], "Show Captions");
    await this.delay(300); // Additional buffer for the popup to close
    return success;
  }

  async stepClickFullTranscript(frame) {
    const success = await this.helperClickDropdown(
      frame, 
      'view full transcript|show full transcript|full transcript', 
      ['[aria-label*="Full Transcript"]'], 
      "View Full Transcript"
    );
    await this.delay(300);
    return success;
  }

  // ==========================================
  // MAIN ORCHESTRATOR
  // ==========================================

  async executeNavigationSequence(frame) {
    logger.info('ZoomAdapter(reactiveJoinFlow): PROCESS: Executing Modular 8-Step Caption/Transcript Flow...');

    try {
      // ------------------------------------
      // PHASE 1: TURN ON CAPTIONS
      // ------------------------------------
      await this.stepWakeUI(frame);

      const moreFound1 = await this.stepClickMore(frame, "Phase 1");
      if (!moreFound1) return { status: "FAIL" };

      const folderFound1 = await this.stepClickCaptionsFolder(frame, "Phase 1");
      if (folderFound1) {
        await this.stepClickShowCaptions(frame);
      }


      logger.info('ZoomAdapter(reactiveJoinFlow): Checking for intercepting Language Modal before starting Phase 2...');
      await this.handleHostPermissionPopup(frame);
      
      // Force close any dropdowns that might have accidentally stayed open
      if (this.page.keyboard) {
        await this.page.keyboard.press('Escape').catch(() => {});
      }
      await this.delay(500);

      // ------------------------------------
      // PHASE 2: CHECK SIDEBAR & FORCE FULL TRANSCRIPT
      // ------------------------------------

      logger.info('ZoomAdapter(reactiveJoinFlow): Checking if Sidebar is open...');
      let isSidebarOpen = await this.verifySidebarVisibility(frame);

      if (isSidebarOpen) {
        logger.info('ZoomAdapter(reactiveJoinFlow): SUCCESS: Transcript interface appears active');
        return { status: "SUCCESS" };
      }

      logger.info('ZoomAdapter(reactiveJoinFlow): Transcript sidebar not visible; forcing it open...');

      await this.stepWakeUI(frame);

      const moreFound2 = await this.stepClickMore(frame, "Phase 2");
      if (!moreFound2) return { status: "FAIL" };

      const folderFound2 = await this.stepClickCaptionsFolder(frame, "Phase 2");
      if (folderFound2) {
        await this.stepClickFullTranscript(frame);
      }

      // Final Verify
      isSidebarOpen = await this.verifySidebarVisibility(frame);

      if (isSidebarOpen) {
        logger.info('ZoomAdapter(reactiveJoinFlow): SUCCESS: Transcript interface appears active after strict flow');
        return { status: "SUCCESS" };
      } else {
        logger.warn('ZoomAdapter(reactiveJoinFlow): NOTICE: Transcript panel not detected; continuing, but captions may require manual re-check');
        return { status: "FAIL" };
      }

    } catch (err) {
      logger.error('ZoomAdapter(reactiveJoinFlow): FAILED: Caption enable process interrupted - ' + err.message);
      return { status: "FAIL" };
    }
  }

  // ==========================================
  // BOOTSTRAP & ERROR RECOVERY
  // ==========================================

  async startTranscriptMonitor(captionMonitor) {
    logger.info('ZoomAdapter(zoomJoiner): [SYSTEM] Starting DOM-Select Transcript Activation...');
    try {
      const frame = await this.getZoomFrame();

      const result = await this.executeNavigationSequence(frame);
      logger.info(`ZoomAdapter(zoomJoiner): First activation result: ${result.status}`);

      let isVisible = await this.verifySidebarVisibility(frame);
      logger.info(`ZoomAdapter(zoomJoiner): Sidebar visible after first attempt: ${isVisible}`);
      
      if (!isVisible) {
        logger.warn('ZoomAdapter(zoomJoiner): Sidebar not visible. Retrying sequence...');
        await this.delay(1500);

        const retryResult = await this.executeNavigationSequence(frame);
        logger.info(`ZoomAdapter(zoomJoiner): Retry activation result: ${retryResult.status}`);
        
        await this.handleHostPermissionPopup(frame);

        isVisible = await this.verifySidebarVisibility(frame);
        logger.info(`ZoomAdapter(zoomJoiner): Sidebar visible after retry: ${isVisible}`);
      }

      if (isVisible) {
        logger.info("ZoomAdapter(zoomJoiner): SUCCESS: Sidebar and Captions activated.");
        if (captionMonitor) captionMonitor.startPolling();
      } else {
        logger.error("ZoomAdapter(zoomJoiner): ERROR: Sidebar did not open.");
        await this.page.screenshot({ path: `./logs/image/blocker_check_${Date.now()}.png` }).catch(() => {});
      }
    } catch (err) {
      logger.error('ZoomAdapter(zoomJoiner): EXCEPTION in startTranscriptMonitor: ' + err.message);
    }
  }

  async handleHostPermissionPopup(frame) {
    logger.info('ZoomAdapter(reactiveJoinFlow): [START] Checking for Caption Language modals...');
    try {
      // 1. Give the modal half a second to fade in
      await new Promise(res => setTimeout(res, 800));

      // 2. Scan the DOM for the modal and click Save
      const modalCleared = await frame.evaluate(() => {
        const bodyText = document.body.innerText || "";
        
        // Check if this specific modal is on the screen
        const isLanguageModal = bodyText.includes('Set the caption language') || bodyText.includes('Caption Language');

        if (isLanguageModal) {
          // Hunt for the primary confirmation button
          const buttons = Array.from(document.querySelectorAll('button, .zm-btn'));
          const saveBtn = buttons.find(btn => {
            const text = btn.innerText.trim().toLowerCase();
            return text === 'save' || text === 'done' || text === 'ok' || text === 'confirm';
          });

          if (saveBtn && saveBtn.offsetParent !== null) {
            saveBtn.click();
            return saveBtn.innerText.trim();
          }
        }
        return null;
      });

      if (modalCleared) {
        logger.info(`ZoomAdapter(reactiveJoinFlow): SUCCESS: Cleared Language Modal by clicking "${modalCleared}"`);
        // Give the modal 1 second to fade out so it doesn't block the next click
        await new Promise(res => setTimeout(res, 1000));
      } else {
        // 3. Fallback: If no button was clicked, hit Enter/Escape to clear trapped focus
        logger.info('ZoomAdapter(reactiveJoinFlow): No modal detected, or exact button not found. Firing Escape sequence...');
        if (this.page.keyboard) {
          await this.page.keyboard.press('Enter').catch(() => {});
          await new Promise(res => setTimeout(res, 300));
          await this.page.keyboard.press('Escape').catch(() => {});
        }
      }
    } catch (err) {
      logger.error('ZoomAdapter(reactiveJoinFlow): Modal Error: ' + err.message);
    }
  }
}

module.exports = TranscriptActivation;