const { logger } = require('../../../../utils/logger');

module.exports = async function enableCaptionsIfPossible() {
  logger.info('captionManager: ENTER enableCaptionsIfPossible');

    const result = await this.page.evaluate(async () => {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));

      const log = (msg, data) => {
        window.__captionDebugLogs = window.__captionDebugLogs || [];
        window.__captionDebugLogs.push({ msg, data });
      };

      const getButtonText = (el) => {

        const aria = el.getAttribute('aria-label') || '';
        const label = el.getAttribute('label') || '';
        const tooltip = el.getAttribute('data-tooltip-id') || '';
        const inner = el.innerText || '';

        const text = `${aria} ${label} ${tooltip} ${inner}`.toLowerCase();

        return text;
      };

      const findCaptionButton = () => {

        const selectors = [
          'button[aria-label*="captions"]',
          'button[aria-label*="caption"]',
          'button[aria-label*="subtitle"]',
          'button[aria-label*="subtitles"]',
          'button[data-tooltip*="caption"]',
          'button[data-tooltip*="captions"]',
          'button[data-tooltip*="subtitle"]',
          'button[data-tooltip*="subtitles"]'
        ];

        for (let i = 0; i < selectors.length; i++) {
          const selector = selectors[i];
          const el = document.querySelector(selector);

          if (el) {
            return { element: el, selector };
          }
        }

        const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));

        for (let i = 0; i < allButtons.length; i++) {
          const btn = allButtons[i];
          const text = getButtonText(btn);

          if (text.includes('caption') || text.includes('subtitles')) {
            return { element: btn, selector: 'text-search' };
          }
        }

        return null;
      };

      const findMoreOptionsButton = () => {

        const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));

        for (let i = 0; i < allButtons.length; i++) {
          const btn = allButtons[i];
          const text = getButtonText(btn);

          if (
            text.includes('more options') ||
            text.includes('more actions') ||
            text.includes('options')
          ) {
            return { element: btn, selector: 'more-options' };
          }
        }

        return null;
      };

      const isClickable = (el) => {
        if (!el) {
          return false;
        }

        const style = window.getComputedStyle(el);

        const ok =
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          el.offsetParent !== null;
        return ok;
      };

      const debugInfo = { attempts: [] };

      for (let i = 0; i < 10; i++) {

        const captionResult = findCaptionButton();

        if (captionResult) {
          const clickable = isClickable(captionResult.element);

          if (clickable) {
            captionResult.element.click();

            return {
              status: 'CAPTIONS_ENABLED',
              debug: debugInfo
            };
          }
        }

        if (i === 3) {

          const moreResult = findMoreOptionsButton();

          if (moreResult && isClickable(moreResult.element)) {
            moreResult.element.click();
            debugInfo.attempts.push('clicked more options');
          }
        }

        debugInfo.attempts.push(`attempt ${i + 1}`);

        await sleep(1000);
      }

      return {
        status: 'CAPTIONS_NOT_FOUND',
        debug: debugInfo
      };
    });

};