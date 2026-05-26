const { logger } = require('../../../../utils/logger');

module.exports = async function enableCaptionsIfPossible() {
  logger.info('captionManager: ENTER enableCaptionsIfPossible');

    logger.debug('captionManager: calling page.evaluate');

    const result = await this.page.evaluate(async () => {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));

      const log = (msg, data) => {
        window.__captionDebugLogs = window.__captionDebugLogs || [];
        window.__captionDebugLogs.push({ msg, data });
      };

      log('INIT evaluate');

      const getButtonText = (el) => {
        log('getButtonText:start');

        const aria = el.getAttribute('aria-label') || '';
        const label = el.getAttribute('label') || '';
        const tooltip = el.getAttribute('data-tooltip-id') || '';
        const inner = el.innerText || '';

        const text = `${aria} ${label} ${tooltip} ${inner}`.toLowerCase();

        log('getButtonText:result', text);

        return text;
      };

      const findCaptionButton = () => {
        log('findCaptionButton:start');

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

          log('findCaptionButton:selector', { selector, found: !!el });

          if (el) {
            return { element: el, selector };
          }
        }

        const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));

        log('findCaptionButton:fallback_count', allButtons.length);

        for (let i = 0; i < allButtons.length; i++) {
          const btn = allButtons[i];
          const text = getButtonText(btn);

          if (text.includes('caption') || text.includes('subtitles')) {
            log('findCaptionButton:fallback_found');
            return { element: btn, selector: 'text-search' };
          }
        }

        log('findCaptionButton:not_found');
        return null;
      };

      const findMoreOptionsButton = () => {
        log('findMoreOptionsButton:start');

        const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));

        for (let i = 0; i < allButtons.length; i++) {
          const btn = allButtons[i];
          const text = getButtonText(btn);

          if (
            text.includes('more options') ||
            text.includes('more actions') ||
            text.includes('options')
          ) {
            log('findMoreOptionsButton:found');
            return { element: btn, selector: 'more-options' };
          }
        }

        log('findMoreOptionsButton:not_found');
        return null;
      };

      const isClickable = (el) => {
        if (!el) {
          log('isClickable:null');
          return false;
        }

        const style = window.getComputedStyle(el);

        const ok =
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          el.offsetParent !== null;

        log('isClickable:result', ok);

        return ok;
      };

      const debugInfo = { attempts: [] };

      log('loop:start');

      for (let i = 0; i < 10; i++) {
        log('loop:iteration', i + 1);

        const captionResult = findCaptionButton();

        log('loop:caption_found', !!captionResult);

        if (captionResult) {
          const clickable = isClickable(captionResult.element);

          log('loop:caption_clickable', clickable);

          if (clickable) {
            log('loop:CLICK_CAPTION');
            captionResult.element.click();

            return {
              status: 'CAPTIONS_ENABLED',
              debug: debugInfo
            };
          }
        }

        if (i === 3) {
          log('loop:try_more_options');

          const moreResult = findMoreOptionsButton();

          if (moreResult && isClickable(moreResult.element)) {
            log('loop:CLICK_MORE_OPTIONS');
            moreResult.element.click();
            debugInfo.attempts.push('clicked more options');
          }
        }

        debugInfo.attempts.push(`attempt ${i + 1}`);

        await sleep(1000);
      }

      log('loop:CAPTIONS_NOT_FOUND');

      return {
        status: 'CAPTIONS_NOT_FOUND',
        debug: debugInfo
      };
    });

    logger.info(`captionManager: RESULT = ${result.status}`);
    logger.debug('captionManager debug info', result.debug);

    logger.debug('captionManager browser logs collected (if any)');

};