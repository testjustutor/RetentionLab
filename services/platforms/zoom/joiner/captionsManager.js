const { logger } = require('../../../../utils/logger');

class CaptionsManager {
  constructor(page, getZoomFrame) {
    this.page = page;
    this.getZoomFrame = getZoomFrame;
  }

  /**
   * CORE TAB HUNTING ALGORITHM
   * Presses Tab, reads the focused element, and presses Enter if it matches.
   */
  async tabHunter(frame, regexPattern, maxTabs = 35) {
    for (let i = 0; i < maxTabs; i++) {
      await this.page.keyboard.press('Tab');
      await new Promise(r => setTimeout(r, 80)); // Brief pause for DOM to shift focus

      const matchText = await frame.evaluate((pattern) => {
        const el = document.activeElement;
        // Ignore the body if it's the only thing focused
        if (!el || el.tagName === 'BODY') return null;

        // Read all possible text sources from the focused element
        const text = [
          el.innerText,
          el.getAttribute('aria-label'),
          el.getAttribute('title')
        ].filter(Boolean).join(' ').trim();

        if (new RegExp(pattern, 'i').test(text)) return text;
        return null;
      }, regexPattern);

      if (matchText) {
        logger.info(`ZoomJoiner(captionsManager): [TAB HUNT] FOUND Match! Focused on: "${matchText}"`);
        logger.info(`ZoomJoiner(captionsManager): [TAB HUNT] Pressing 'Enter' on target...`);
        
        await this.page.keyboard.press('Enter'); // Activate the button
        await new Promise(r => setTimeout(r, 1000)); // Wait for dropdown/popup to open
        return true;
      }
    }
    
    logger.warn(`ZoomJoiner(captionsManager): [TAB HUNT] FAILED to find /${regexPattern}/ after ${maxTabs} tabs.`);
    return false;
  }

  async checkCaptionsEnabled() {
    logger.info('ZoomJoiner(captionsManager): CHECK: Verifying Captions via KEYBOARD TAB NAVIGATION...');
    const frame = await this.getZoomFrame();

    try {
      // 1. Reset Focus to the top of the document
      await frame.click('body').catch(() => {});
      await this.page.keyboard.press('Escape'); // Close any stray menus
      await new Promise(r => setTimeout(r, 500));

      // 2. Check if already active
      const isAlreadyEnabled = await frame.evaluate(() => {
        return !!document.querySelector('.transcript-item-area, .zm-transcript-viewer') ||
               !!document.body.innerText.match(/Captions|Transcript/i);
      });

      if (isAlreadyEnabled) {
        logger.info('ZoomJoiner(captionsManager): STATUS: Captions are already fully enabled.');
        return true;
      }

      // ==========================================
      // STRATEGY: TAB THROUGH THE MAIN TOOLBAR
      // ==========================================
      logger.info('ZoomJoiner(captionsManager): Tabbing through main toolbar looking for Captions or More...');
      
      let foundDirectCaption = false;
      let foundMore = false;

      // Custom loop to check for BOTH "Captions" and "More" on the same tab cycle
      for (let i = 0; i < 35; i++) {
        await this.page.keyboard.press('Tab');
        await new Promise(r => setTimeout(r, 80));

        const detectedType = await frame.evaluate(() => {
          const el = document.activeElement;
          if (!el || el.tagName === 'BODY') return null;
          
          const text = `${el.innerText} ${el.getAttribute('aria-label')} ${el.title}`.trim();
          
          if (/Caption|Live Transcript/i.test(text)) return 'CAPTION';
          if (/^More$|More options/i.test(text)) return 'MORE';
          return null;
        });

        if (detectedType === 'CAPTION') {
          logger.info(`ZoomJoiner(captionsManager): [TAB HUNT] Found direct 'Captions' button. Pressing Enter.`);
          await this.page.keyboard.press('Enter');
          foundDirectCaption = true;
          break; // Stop tabbing
        } else if (detectedType === 'MORE') {
          logger.info(`ZoomJoiner(captionsManager): [TAB HUNT] Found 'More' button. Pressing Enter.`);
          await this.page.keyboard.press('Enter');
          foundMore = true;
          break; // Stop tabbing
        }
      }

      await new Promise(r => setTimeout(r, 1000)); // Wait for popup/dropdown to settle

      // ==========================================
      // DRILL DOWN INTO OPENED MENUS
      // ==========================================
      if (foundDirectCaption) {
        logger.info('ZoomJoiner(captionsManager): Direct popup opened. Hunting for "Show Captions"...');
        
        // Tab through the popup to find "Show Caption"
        const clickedShow = await this.tabHunter(frame, 'show caption|enable caption', 10);
        if (clickedShow) return true;

      } else if (foundMore) {
        logger.info('ZoomJoiner(captionsManager): More dropdown opened. Hunting for "Captions" menu item...');
        
        // Tab through the More dropdown to find "Captions"
        const clickedMenuCap = await this.tabHunter(frame, 'captions|live transcript', 15);
        
        if (clickedMenuCap) {
          logger.info('ZoomJoiner(captionsManager): Captions secondary popup opened. Hunting for "Show Captions"...');
          
          // Tab through the secondary popup to find "Show Captions"
          const clickedShow = await this.tabHunter(frame, 'show caption|enable caption', 10);
          
          // If "Show Captions" wasn't there, hunt for "Full Transcript" as fallback
          if (!clickedShow) {
             logger.info('ZoomJoiner(captionsManager): "Show Captions" missing. Hunting for "Full Transcript"...');
             await this.tabHunter(frame, 'full transcript|view transcript', 5);
          }
          return true;
        }
      }

      return false; // If we reach here, host disabled captions

    } catch (e) {
      logger.error('ZoomJoiner(captionsManager): Tab Navigation Error: ' + e.message);
      return false;
    }
  }

  async sendChatRequest(botName) {
    logger.info('ZoomJoiner(captionsManager): JT MODE: Sending chat request for captions...');
    const frame = await this.getZoomFrame();

    try {
      await frame.click('body').catch(() => {});
      
      if (this.page && this.page.keyboard) {
        logger.info('ZoomJoiner(captionsManager): Firing Alt+H to open Chat panel...');
        await this.page.keyboard.down('Alt');
        await this.page.keyboard.press('h');
        await this.page.keyboard.up('Alt');
      }

      await new Promise(r => setTimeout(r, 1500));

      await frame.evaluate((name) => {
        const textarea = document.querySelector('.chat-box__chat-textarea, #chat-textarea, textarea[placeholder*="message"]');
        if (textarea) {
            textarea.value = `Hi everyone, I'm ${name}. To help me transcribe this meeting, please click "Captions" and "Enable Auto-Transcription" in your Zoom toolbar. Thanks!`;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 13, key: 'Enter' }));
        }
      }, botName);
      
      logger.info('ZoomJoiner(captionsManager): Chat request sent successfully.');
    } catch (e) {
      logger.error('ZoomJoiner(captionsManager): Chat Request Error: ' + e.message);
    }
  }
}

module.exports = CaptionsManager;