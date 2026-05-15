const path = require('path');
const { logger } = require('../../../utils/logger');

async function reactiveJoinFlow(page, botName) {
  logger.info('TeamsAdapter: Reactive Teams Join Flow Started');

  try {
    await new Promise(r => setTimeout(r, 4000));

    // 1. Click "Continue on this browser" (important for Teams)
    try {
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button, a'))
          .find(el => /continue on this browser/i.test(el.innerText));
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 5000));
    } catch {}

    const target = page;

    // 2. Turn off mic + camera
    await target.evaluate(() => {
      const mic = document.querySelector('[aria-label*="microphone"], [aria-label*="mic"]');
      if (mic && mic.getAttribute('aria-pressed') === 'true') mic.click();

      const cam = document.querySelector('[aria-label*="camera"], [aria-label*="video"]');
      if (cam && cam.getAttribute('aria-pressed') === 'true') cam.click();
    }).catch(() => {});

    // 3. Enter name (guest join)
    try {
      const nameInput = await target.waitForSelector('input[type="text"]', { timeout: 5000 });

      logger.info(`TeamsAdapter: Setting bot name → ${botName}`);

      await nameInput.click({ clickCount: 3 });
      await target.keyboard.press('Backspace');
      await nameInput.type(botName, { delay: 50 });
    } catch {
      logger.info("TeamsAdapter: Name input not required");
    }

    // 4. Click "Join now"
    try {
      await target.waitForFunction(() => {
        return Array.from(document.querySelectorAll('button'))
          .some(btn => /join now/i.test(btn.innerText));
      }, { timeout: 8000 });

      await target.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => /join now/i.test(b.innerText));
        if (btn) btn.click();
      });

      logger.info("TeamsAdapter: JOIN button clicked");
    } catch (e) {
      logger.error("TeamsAdapter: Join button not found");
    }

    // 5. Wait for meeting to load / lobby
    await new Promise(r => setTimeout(r, 8000));

    // 6. Enable captions
    await enableCaptions(target);

  } catch (e) {
    const errorPath = path.join(__dirname, '..', '..', '..', 'debug_join_error.png');
    await page.screenshot({ path: errorPath, fullPage: true });
    logger.error(`TeamsAdapter: Join Flow Failed: ${e.message}. Screenshot saved to: ${errorPath}`);
  }
}

async function enableCaptions(target) {
  logger.info('TeamsAdapter: Enabling captions...');

  try {
    // Open "More actions" (3 dots)
    await target.evaluate(() => {
      const btn = document.querySelector('[aria-label*="More"], [aria-label*="more"]');
      if (btn) btn.click();
    });

    await new Promise(r => setTimeout(r, 1500));

    // Click captions / transcript
    const clicked = await target.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button, span'))
        .find(el =>
          /captions|live captions|transcript/i.test(el.innerText)
        );

      if (btn) {
        btn.click();
        return true;
      }

      return false;
    });

    if (clicked) {
      logger.info("TeamsAdapter: Captions enabled");
    } else {
      logger.warn("TeamsAdapter: Captions button not found");
    }

  } catch (err) {
    logger.error("TeamsAdapter: Failed to enable captions - " + err.message);
  }
}

module.exports = { reactiveJoinFlow };