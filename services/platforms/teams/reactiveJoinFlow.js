/**
 * root/services/platforms/teams/reactiveJoinFlow.js
 *
 */
const path = require('path');
const { logger } = require('../../../utils/logger');

// ─────────────────────────────────────────────
// MIC + CAMERA MUTE WITH RETRY
// ─────────────────────────────────────────────

async function muteMicWithRetry(page, maxAttempts = 10, intervalMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const muted = await page.evaluate(() => {
        const micBtn = document.querySelector(
          '[aria-label*="microphone"], [aria-label*="mic"]'
        );
        if (!micBtn) return false;

        const isMuted =
          micBtn.getAttribute('aria-pressed') === 'true' ||
          micBtn.getAttribute('aria-label')?.toLowerCase().includes('unmute');

        if (!isMuted) micBtn.click();

        return isMuted;
      });

      if (muted) {
        logger.info(`TeamsAdapter(reactiveJoinFlow): Mic muted successfully (attempt ${attempt})`);
        return true;
      }

      logger.warn(`TeamsAdapter(reactiveJoinFlow): Mic not muted yet, retrying... (${attempt}/${maxAttempts})`);
      await new Promise(r => setTimeout(r, intervalMs));

    } catch (err) {
      logger.error(`TeamsAdapter(reactiveJoinFlow): Mic mute attempt ${attempt} failed:`, err);
      await new Promise(r => setTimeout(r, intervalMs));
    }
  }

  logger.warn('TeamsAdapter(reactiveJoinFlow): Mic mute failed after all attempts — continuing anyway');
  return false;
}

async function muteCamera(page) {
  try {
    await page.evaluate(() => {
      const cam = document.querySelector('[aria-label*="camera"], [aria-label*="video"]');
      if (cam && cam.getAttribute('aria-pressed') === 'true') cam.click();
    });
    logger.info('TeamsAdapter(reactiveJoinFlow): Camera turned off');
  } catch {}
}

// ─────────────────────────────────────────────
// CAPTIONS
// ─────────────────────────────────────────────

async function enableCaptions(target) {
  logger.info('TeamsAdapter(reactiveJoinFlow): Enabling captions...');
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
        .find(el => /captions|live captions|transcript/i.test(el.innerText));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      logger.info('TeamsAdapter(reactiveJoinFlow): Captions enabled');
    } else {
      logger.warn('TeamsAdapter(reactiveJoinFlow): Captions button not found');
    }
  } catch (err) {
    logger.error('TeamsAdapter(reactiveJoinFlow): Failed to enable captions - ' + err.message);
  }
}

// ─────────────────────────────────────────────
// MAIN JOIN FLOW
// ─────────────────────────────────────────────

async function reactiveJoinFlow(page, botName) {
  logger.info('TeamsAdapter(reactiveJoinFlow): Reactive Teams Join Flow Started');
  try {
    await new Promise(r => setTimeout(r, 4000));

    // 1. Click "Continue on this browser"
    try {
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button, a'))
          .find(el => /continue on this browser/i.test(el.innerText));
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 5000));
    } catch {}

    const target = page;

    // 2. Turn off mic (with retry) + camera
    await muteMicWithRetry(target);
    await muteCamera(target);

    // 3. Enter name (guest join)
    try {
      const nameInput = await target.waitForSelector('input[type="text"]', { timeout: 5000 });
      logger.info(`TeamsAdapter(reactiveJoinFlow): Setting bot name → ${botName}`);
      await nameInput.click({ clickCount: 3 });
      await target.keyboard.press('Backspace');
      await nameInput.type(botName, { delay: 50 });
    } catch {
      logger.info('TeamsAdapter(reactiveJoinFlow): Name input not required');
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
      logger.info('TeamsAdapter(reactiveJoinFlow): JOIN button clicked');
    } catch (e) {
      logger.error('TeamsAdapter(reactiveJoinFlow): Join button not found');
    }

    // 5. Wait for meeting to load / lobby
    await new Promise(r => setTimeout(r, 8000));

    // 6. Enable captions
    await enableCaptions(target);

  } catch (e) {
    const errorPath = path.join(__dirname, '..', '..', '..', 'debug_join_error.png');
    await page.screenshot({ path: errorPath, fullPage: true });
    logger.error(`TeamsAdapter(reactiveJoinFlow): Join Flow Failed: ${e.message}. Screenshot saved to: ${errorPath}`);
  }
}

module.exports = { reactiveJoinFlow };