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
        // Look for the element that holds the live text, not the container
        const transcriptList = document.querySelector('[aria-label*="Transcription List"], [role="application"]');
        
        // Look for any element that contains "Transcript" text without hardcoding classes
        const hasTranscriptText = Array.from(document.querySelectorAll('*'))
          .find(el => el.innerText && el.innerText.trim() === "Transcript" && el.offsetParent !== null);
        
        return !!(transcriptList && hasTranscriptText);
      });
      
      if (isVisible) return true;
      await this.delay(1500);
    }
    return await this.findTranscriptInAnyFrame();
  }

  async findTranscriptInAnyFrame() {
    const frames = this.page.frames();
    for (const candidate of frames) {
      const found = await candidate.evaluate(() => {
        // Use role and aria-label which are more stable than CSS classes
        const selectors = [
          '[aria-label*="Transcription List"]', 
          '[role="application"]',
          '#wc-container-right',
          '#full-transcription'
        ];
        
        // Check if any of our robust selectors exist
        if (selectors.some(sel => document.querySelector(sel))) return true;
        
        // Fallback: Check for the text header within the found frame
        return !!Array.from(document.querySelectorAll('.lt-header__title, .window-header-title'))
                      .find(el => el.innerText.trim() === "Transcript" && el.offsetParent !== null);
      }).catch(() => false);
      
      if (found) return true;
    }
    return false;
  }

  // ==========================================
  // INDIVIDUAL STEP FUNCTIONS
  // ==========================================

  async stepWakeUI(frame) {
    logger.info('ZoomJoiner(transcriptActivation): Action - Waking up UI');
    await frame.evaluate(() => document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })));
    await this.delay(800);
  }

  async stepClickMore(frame, phase) {
    logger.info(`ZoomJoiner(transcriptActivation): Action - Clicking "More" (${phase})`);
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

    if (!clicked) logger.warn(`ZoomJoiner(transcriptActivation): WARNING: "More" button not found (${phase})`);
    await this.delay(1200);
    return clicked;
  }

  async helperClickDropdown(frame, regexStr, ariaSelectors, stepName) {
    logger.info(`ZoomJoiner(transcriptActivation): ACTION: Clicking "${stepName}"`);

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
      logger.warn(`ZoomJoiner(transcriptActivation): WARNING: Failed to find target for ${stepName}`);
    } else {
      logger.info(`ZoomJoiner(transcriptActivation): SUCCESS: Clicked "${clicked}"`);
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
      ['[aria-label*="Transcript"]'], 
      "View Full Transcript"
    );
    await this.delay(300);
    return success;
  }

  // ==========================================
  // MAIN ORCHESTRATOR
  // ==========================================

  async executeNavigationSequence(frame) {
    logger.info('ZoomJoiner(transcriptActivation): PROCESS: Executing Optimized 2-Phase Flow...');

    try {
      // Helper to reset UI state
      const resetUI = async () => {
        if (this.page.keyboard) {
          await this.page.keyboard.press('Escape').catch(() => {});
          await this.delay(500);
        }
      };

      // ------------------------------------
      // PHASE 1: ATTEMPT BASIC ACTIVATION
      // ------------------------------------
      await this.stepWakeUI(frame);
      
      // Check state before clicking
      if (!(await this.verifySidebarVisibility(frame))) {
        const moreFound1 = await this.stepClickMore(frame, "Phase 1");
        if (moreFound1) {
          const folderFound1 = await this.stepClickCaptionsFolder(frame, "Phase 1");
          if (folderFound1) {
            await this.stepClickShowCaptions(frame);
            await this.handleHostPermissionPopup(frame);
          }
        }
      }

      await resetUI();

      // ------------------------------------
      // PHASE 2: STRICT VERIFICATION & FULL TRANSCRIPT
      // ------------------------------------
      if (await this.verifySidebarVisibility(frame)) {
        logger.info('ZoomJoiner(transcriptActivation): SUCCESS: Transcript active.');
        return { status: "SUCCESS" };
      }

      logger.info('ZoomJoiner(transcriptActivation): Sidebar not visible; forcing Full Transcript path...');
      
      await this.stepWakeUI(frame);
      const moreFound2 = await this.stepClickMore(frame, "Phase 2");
      
      if (moreFound2) {
        const folderFound2 = await this.stepClickCaptionsFolder(frame, "Phase 2");
        if (folderFound2) {
          await this.stepClickFullTranscript(frame);
        }
      }

      // Final Verify
      return (await this.verifySidebarVisibility(frame)) 
        ? { status: "SUCCESS" } 
        : { status: "FAIL" };

    } catch (err) {
      logger.error('ZoomJoiner(transcriptActivation): FAILED: ' + err.message);
      return { status: "FAIL" };
    }
  }

  // ==========================================
  // BOOTSTRAP & ERROR RECOVERY
  // ==========================================

  async startTranscriptMonitor(captionMonitor) {
    logger.info('ZoomJoiner(transcriptActivation): [SYSTEM] Starting DOM-Select Transcript Activation...');
    try {
      const frame = await this.getZoomFrame();
      let isVisible = await this.verifySidebarVisibility(frame);

      if (!isVisible) {

        logger.info('ZoomJoiner(transcriptActivation): Sidebar not detected. Starting activation flow...');
        const result = await this.executeNavigationSequence(frame);
        logger.info(`ZoomJoiner(transcriptActivation): First activation result: ${result.status}`);

        let isVisible = await this.verifySidebarVisibility(frame);
      }else{
        logger.info(`ZoomJoiner(transcriptActivation): Sidebar already active. Skipping activation flow. ${isVisible}`);
      }

      if (isVisible) {
        logger.info("ZoomJoiner(transcriptActivation): SUCCESS: Sidebar and Captions activated.");
        if (captionMonitor) captionMonitor.startPolling();
      } else {
        const result = await this.executeNavigationSequence(frame);
        logger.error("ZoomJoiner(transcriptActivation): ERROR: Sidebar did not open.");
      }
    } catch (err) {
      logger.error('ZoomJoiner(transcriptActivation): EXCEPTION in startTranscriptMonitor: ' + err.message);
    }
  }

  async handleHostPermissionPopup(frame) {
    logger.info('ZoomJoiner(transcriptActivation): [START] Checking for Caption Language modals...');
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
        logger.info(`ZoomJoiner(transcriptActivation): SUCCESS: Cleared Language Modal by clicking "${modalCleared}"`);
        // Give the modal 1 second to fade out so it doesn't block the next click
        await new Promise(res => setTimeout(res, 1000));
      } else {
        // 3. Fallback: If no button was clicked, hit Enter/Escape to clear trapped focus
        logger.info('ZoomJoiner(transcriptActivation): No modal detected, or exact button not found. Firing Escape sequence...');
        if (this.page.keyboard) {
          await this.page.keyboard.press('Enter').catch(() => {});
          await new Promise(res => setTimeout(res, 300));
          await this.page.keyboard.press('Escape').catch(() => {});
        }
      }
    } catch (err) {
      logger.error('ZoomJoiner(transcriptActivation): Modal Error: ' + err.message);
    }
  }
}

module.exports = TranscriptActivation;