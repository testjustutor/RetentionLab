/**
 * services/platforms/google-meet/preJoinMedia.js
 *
 * Forces the bot's microphone and/or camera OFF and VERIFIES it actually
 * happened, instead of trusting Puppeteer's launch flags alone.
 *
 * FEASIBILITY NOTE: --use-fake-ui-for-media-stream / --use-fake-device-for-
 * media-stream (see GoogleMeetAdapter.js's puppeteer.launch args) only
 * auto-grant the OS/browser media PERMISSION prompt and supply a fake
 * camera/mic device - they say nothing about whether Meet's own in-page
 * mic/camera TOGGLE ends up on or off once the page renders. Meet can (and
 * does) default either control to ON regardless of those flags, so this has
 * to be enforced and checked directly in the DOM, on both:
 *   - the pre-join/lobby screen (where a human would see their own camera
 *     preview + a mic/camera toggle before clicking "Ask to join"), and
 *   - the in-meeting toolbar once the bot has actually joined (Meet uses
 *     the same aria-label/tooltip wording for both, so the same detection
 *     logic below works for either - see GoogleMeetAdapter.js, which calls
 *     this both before AND after joining as a recheck).
 *
 * VERIFICATION, NOT ASSUMPTION: a click can fire on a button that turns out
 * not to be the right control, or Meet can re-render the toolbar mid-click.
 * So every attempt re-reads the control's actual label from the DOM after
 * clicking, rather than assuming success just because .click() didn't
 * throw. It keeps re-checking/re-clicking (default: up to 20 attempts,
 * ~500ms apart, per control - so up to ~10s each, ~20s worst case for both)
 * instead of giving up after a couple of tries, because a bot that joins
 * with a live mic/camera is a real, not cosmetic, problem.
 *
 * If every attempt is exhausted and the control is still confirmed ON (or
 * was never found at all - e.g. Meet's DOM/wording changed), this logs
 * loudly (WARN) with the exact state it ended on, but does not throw - a
 * bot that fails to attend a meeting at all because a selector didn't match
 * is a worse outcome than one that joins with an uncertain mic/camera
 * state; GoogleMeetAdapter.js's post-join recheck pass is the second line
 * of defense against exactly that case.
 *
 * INDEPENDENT TOGGLES: camera and microphone enforcement can be turned on/off
 * separately via the `camera`/`microphone` options (see featureConfig.js's
 * media.disableCameraOnJoin / media.muteMicOnJoin) - e.g. mute the mic but
 * leave the camera control completely untouched. When a control is disabled
 * here, it is not inspected or clicked at all.
 */
const { logger } = require('../../../utils/logger');

const DEFAULT_ATTEMPTS = 20;
const DEFAULT_INTERVAL_MS = 500;

/**
 * @param {object} page - Puppeteer page.
 * @param {object} [options]
 * @param {number} [options.attempts=20]
 * @param {number} [options.intervalMs=500]
 * @param {string} [options.label='pre-join']
 * @param {boolean} [options.camera=true] - enforce camera OFF. Pass false to
 *   skip the camera control entirely (featureConfig.media.disableCameraOnJoin
 *   = false).
 * @param {boolean} [options.microphone=true] - enforce microphone OFF. Pass
 *   false to skip the microphone control entirely (featureConfig.media.
 *   muteMicOnJoin = false).
 */
async function ensureMicCameraOff(page, {
  attempts = DEFAULT_ATTEMPTS,
  intervalMs = DEFAULT_INTERVAL_MS,
  label = 'pre-join',
  camera: enforceCamera = true,
  microphone: enforceMicrophone = true,
} = {}) {
  if (!enforceCamera && !enforceMicrophone) {
    logger.info(`GoogleMeetAdapter(preJoinMedia): [${label}] Camera and microphone enforcement both disabled via featureConfig - skipping.`);
    return { cameraOk: true, micOk: true, camera: { skipped: true }, microphone: { skipped: true } };
  }

  const wanted = [enforceCamera && 'camera', enforceMicrophone && 'microphone'].filter(Boolean).join(' and ');
  logger.info(`GoogleMeetAdapter(preJoinMedia): [${label}] Ensuring ${wanted} ${enforceCamera && enforceMicrophone ? 'are' : 'is'} OFF...`);

  try {
    const result = await page.evaluate(async (maxAttempts, waitMs, wantCamera, wantMicrophone) => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();

      const getButtonText = (button) => normalize([
        button.getAttribute('aria-label'),
        button.getAttribute('data-tooltip'),
        button.getAttribute('data-tooltip-id'),
        button.getAttribute('title'),
        button.innerText
      ].filter(Boolean).join(' '));

      const getControlState = (kind) => {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        const control = buttons.find((button) => {
          const text = getButtonText(button);
          return text.includes(kind) || (kind === 'microphone' && text.includes('mic'));
        });

        if (!control) {
          return { found: false, isOff: false, isOn: false, label: null, control: null };
        }

        const btnLabel = getButtonText(control);
        const isOff =
          btnLabel.includes(`turn on ${kind}`) ||
          btnLabel.includes(`${kind} is off`) ||
          (kind === 'microphone' && (
            btnLabel.includes('turn on mic') ||
            btnLabel.includes('mic is off') ||
            btnLabel.includes('microphone is muted')
          ));

        const isOn =
          btnLabel.includes(`turn off ${kind}`) ||
          btnLabel.includes(`${kind} is on`) ||
          (kind === 'microphone' && (
            btnLabel.includes('turn off mic') ||
            btnLabel.includes('mic is on') ||
            btnLabel.includes('microphone is on')
          ));

        return { found: true, isOff, isOn, label: btnLabel, control };
      };

      const ensureOff = async (kind) => {
        let state = getControlState(kind);
        let clickCount = 0;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          // VERIFY before trusting any prior click: re-read the DOM state
          // fresh on every loop iteration rather than assuming the last
          // click (if any) succeeded.
          if (state.found && state.isOff) {
            return { kind, found: true, success: true, label: state.label, attemptsUsed: attempt, clicks: clickCount };
          }

          if (state.found && state.isOn) {
            state.control.click();
            clickCount++;
          }
          // If the control isn't found yet, it may simply not have rendered
          // yet (screen still loading) - keep waiting/re-scanning instead of
          // giving up on the first miss.

          await sleep(waitMs);
          state = getControlState(kind);
        }

        // Exhausted every attempt - report exactly what we ended on so the
        // caller logs the real state, never a silent assumed success.
        return {
          kind,
          found: state.found,
          success: state.found ? state.isOff : false,
          label: state.label,
          attemptsUsed: maxAttempts,
          clicks: clickCount
        };
      };

      const camera = wantCamera ? await ensureOff('camera') : { skipped: true, success: true };
      const microphone = wantMicrophone ? await ensureOff('microphone') : { skipped: true, success: true };

      return { camera, microphone };
    }, attempts, intervalMs, enforceCamera, enforceMicrophone);

    const cameraOk = !!(result.camera && result.camera.success);
    const micOk = !!(result.microphone && result.microphone.success);

    if (cameraOk && micOk) {
      const cameraPart = result.camera.skipped ? 'camera: skipped (disabled in config)' : `camera: "${result.camera.label}" (${result.camera.clicks} click(s))`;
      const micPart = result.microphone.skipped ? 'microphone: skipped (disabled in config)' : `microphone: "${result.microphone.label}" (${result.microphone.clicks} click(s))`;
      logger.info(`GoogleMeetAdapter(preJoinMedia): [${label}] Verified OFF - ${cameraPart}, ${micPart}`);
    } else {
      // Distinguish "control not found at all" (selector/wording drift,
      // wrong screen) from "found but still ON after every retry" - both
      // matter, but for different reasons, so both are logged explicitly.
      logger.warn(
        `GoogleMeetAdapter(preJoinMedia): [${label}] Could NOT verify OFF after ${attempts} attempts (~${Math.round((attempts * intervalMs) / 1000)}s) - ` +
        `camera: ${JSON.stringify(result.camera)}, microphone: ${JSON.stringify(result.microphone)}`
      );
    }

    return { cameraOk, micOk, camera: result.camera, microphone: result.microphone };
  } catch (e) {
    logger.error(`GoogleMeetAdapter(preJoinMedia): [${label}] Mic/camera off check failed:`, e.message);
    return { cameraOk: false, micOk: false, error: e.message };
  }
}

module.exports = ensureMicCameraOff;
