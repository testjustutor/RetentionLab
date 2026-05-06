const path = require('path');
const { logger } = require('../../../utils/logger');

async function reactiveJoinFlow(page, botName, passcode) {
  logger.info('🚀 Reactive Zoom Join Flow Started');

  const continueBtnSelector = 'button.preview-join-button, .zm-btn--primary';
  const joinBtnSelector = 'button.preview-join-button, #joinBtn, .btn-join';

  try {
    await new Promise(r => setTimeout(r, 2000));

    const browserJoinBtn = await page.$('a[href*="join"]');
    if (browserJoinBtn) {
      logger.info("Join from Browser page → clicking");
      await browserJoinBtn.click();
      await new Promise(r => setTimeout(r, 3000));
    }

    let target = page;
    const frameHandle = await page.waitForSelector('#webclient, iframe[src*="zoom.us"]', { timeout: 2000 }).catch(() => null);
    if (frameHandle) {
      logger.info("Zoom iframe detected");
      target = await frameHandle.contentFrame();
    }

    await target.evaluate(() => {
      document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        if (!cb.checked) cb.click();
      });
      const muteBtn = document.querySelector('button[aria-label="Mute"], button[aria-label*="mic"]');
      if (muteBtn) muteBtn.click();
      const cameraBtn = document.querySelector('button[aria-label*="video"], button[aria-label*="camera"]');
      if (cameraBtn) cameraBtn.click();
    }).catch(() => {});

    const pInputSelector = 'input#input-for-pwd, #inputpass, input[name="inputpasscode"]';
    try {
      await target.waitForSelector(pInputSelector, { timeout: 2000 });
      logger.info("Passcode entry...");
      await target.type(pInputSelector, passcode, { delay: 50 });
    } catch (e) {
      logger.info("No passcode field found, skipping");
    }

    const nameSelector = 'input#input-for-name, .form-control';
    try {
      await target.waitForSelector(nameSelector, { timeout: 2000 });
      logger.info(`Setting Bot Name: ${botName}`);
      await target.click(nameSelector, { clickCount: 3 });
      await page.keyboard.press('Backspace');
      await target.type(nameSelector, botName, { delay: 50 });
    } catch (e) {
      logger.info("Name field already set or ready");
    }

    try {
      const continueBtn = await target.waitForSelector(continueBtnSelector, { timeout: 2000 });
      await continueBtn.click();
      logger.info("Preview/Continue clicked");
    } catch (e) {
      logger.info("No preview step found");
    }

    try {
      await target.waitForSelector(joinBtnSelector, { timeout: 2000 });
      await target.evaluate((sel) => {
        const btn = document.querySelector(sel);
        if (btn) {
          btn.classList.remove('zm-btn--disabled');
          btn.disabled = false;
        }
      }, joinBtnSelector);
      await target.click(joinBtnSelector);
      logger.info('✅ JOINED MEETING');
    } catch (e) {
      logger.error("Final Join button click failed");
    }

    await new Promise(r => setTimeout(r, 5000));
    await enableCaptions(target);

  } catch (e) {
    const errorPath = path.join(__dirname, '..', '..', '..', 'debug_join_error.png');
    await page.screenshot({ path: errorPath, fullPage: true });
    logger.error(`Join Flow Failed: ${e.message}. Screenshot saved to: ${errorPath}`);
  }
}

async function enableCaptions(target) {
  logger.info('⚙️  PROCESS: Enabling Captions...');

  try {
    const moreBtnSelector = '#moreButton button, [aria-label*="More meeting control"], button[aria-label*="More"], .more_button';
    await target.waitForSelector(moreBtnSelector, { timeout: 5000 });
    await target.click(moreBtnSelector);
    logger.info('  ↳ LOG: Clicked "More" button');
    await new Promise(r => setTimeout(r, 1200));

    const clickedLabel = await target.evaluate(() => {
      const matcher = /captions|live transcript|view full transcript|closed caption/i;
      const nodes = Array.from(document.querySelectorAll('.dropdown-item, .more-button__item-box, a[role="button"], button, li'));

      const exact = nodes.find(el => matcher.test(el.innerText));
      if (exact) {
        exact.click();
        return exact.innerText.trim();
      }

      const ariaSel = [
        '[aria-label*="Caption"]',
        '[aria-label*="Live Transcript"]',
        '[aria-label*="Closed Caption"]',
        '[aria-label*="transcript"]'
      ];

      for (const selector of ariaSel) {
        const el = document.querySelector(selector);
        if (el) {
          el.click();
          return el.getAttribute('aria-label') || el.innerText.trim();
        }
      }

      return null;
    });

    if (clickedLabel) {
      logger.info(`  ↳ LOG: Captions menu item clicked (${clickedLabel})`);
    } else {
      logger.warn('⚠️  WARNING: Could not find any captions/live-transcript item.');
       }

    await new Promise(r => setTimeout(r, 1500));
    const transcriptOpened = await target.evaluate(() => {
      if (document.querySelector('.transcript-item-area, .cc-transcript-text, #transcript-list-item, .zm-transcript-viewer')) {
        return true;
      }

      const link = Array.from(document.querySelectorAll('.dropdown-item, button, a'))
        .find(el => /view full transcript|show full transcript|show transcript/i.test(el.innerText));
      if (link) {
        link.click();
        return true;
      }

      return false;
    });

    if (transcriptOpened) {
      logger.info('✅ SUCCESS: Transcript interface appears active');
    } else {
      logger.warn('⚠️  NOTICE: Transcript panel not detected; continuing, but captions may require manual re-check');
    }

  } catch (err) {
    logger.error('❌ FAILED: Caption enable process interrupted - ' + err.message);
  }
}

module.exports = { reactiveJoinFlow };