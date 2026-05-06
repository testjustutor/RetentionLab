const path = require('path');
const { logger } = require('../../../utils/logger');

async function reactiveJoinFlow(page, botName) {
  logger.info('GoogleMeetAdapter(reativeJoinFlow): Reactive Meet Join Flow Started');

  try {
    await new Promise(r => setTimeout(r, 3000));

    // 1. Handle "Join from browser" page (if any)
    const browserJoinBtn = await page.$('a[href*="join"]');
    if (browserJoinBtn) {
      logger.info("GoogleMeetAdapter(reativeJoinFlow): Clicking 'Join from browser'");
      await browserJoinBtn.click();
      await new Promise(r => setTimeout(r, 4000));
    }

    const target = page;

    // 2. Turn off mic + camera
    await target.evaluate(() => {
      const micBtn = document.querySelector('[aria-label*="microphone"], [aria-label*="mic"]');
      if (micBtn && micBtn.getAttribute('aria-pressed') === 'false') micBtn.click();

      const camBtn = document.querySelector('[aria-label*="camera"], [aria-label*="video"]');
      if (camBtn && camBtn.getAttribute('aria-pressed') === 'false') camBtn.click();
    }).catch(() => {});

    // 3. Enter name (if required)
    try {
      const nameInput = await target.waitForSelector('input[type="text"]', { timeout: 4000 });
      logger.info(`GoogleMeetAdapter(reativeJoinFlow): Setting bot name → ${botName}`);

      await nameInput.click({ clickCount: 3 });
      await target.keyboard.press('Backspace');
      await nameInput.type(botName, { delay: 50 });
    } catch (e) {
      logger.info("GoogleMeetAdapter(reativeJoinFlow): Name input not required");
    }

    // 4. Click "Ask to join" / "Join now"
    try {
      await target.waitForFunction(() => {
        return Array.from(document.querySelectorAll('button'))
          .some(btn => /join|ask to join/i.test(btn.innerText));
      }, { timeout: 5000 });

      await target.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => /join|ask to join/i.test(b.innerText));
        if (btn) btn.click();
      });

      logger.info("GoogleMeetAdapter(reativeJoinFlow): JOIN button clicked");
    } catch (e) {
      logger.error("GoogleMeetAdapter(reativeJoinFlow): Join button not found");
    }

    // 5. Wait for meeting to load
    await new Promise(r => setTimeout(r, 6000));

    // 6. Enable captions (Meet-style)
    await enableCaptions(target);

  } catch (e) {
    const errorPath = path.join(__dirname, '..', '..', '..', 'debug_join_error.png');
    await page.screenshot({ path: errorPath, fullPage: true });
    logger.error(`GoogleMeetAdapter(reativeJoinFlow): Join Flow Failed: ${e.message}. Screenshot saved to: ${errorPath}`);
  }
}

async function enableCaptions(target) {
  logger.info('GoogleMeetAdapter(reativeJoinFlow): Enabling captions...');

  try {
    await target.evaluate(() => {
      // Try direct captions button
      const btn =
        document.querySelector('[aria-label*="Turn on captions"]') ||
        document.querySelector('[aria-label*="captions"]');

      if (btn) {
        btn.click();
        return true;
      }

      return false;
    });

    logger.info("GoogleMeetAdapter(reativeJoinFlow): Captions toggled");

  } catch (err) {
    logger.warn("GoogleMeetAdapter(reativeJoinFlow): Could not enable captions");
  }
}

module.exports = { reactiveJoinFlow };