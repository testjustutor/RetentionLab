/**
 * root/services/platforms/google-meet/preJoinMedia.js
 *
 */
const { logger } = require('../../../utils/logger');

module.exports = async function handlePreJoinScreen() {
  logger.info('GoogleMeetJoiner(preJoinMedia): Handling pre-join screen...');

  try {
    const result = await this.page.evaluate(async () => {
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
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
        const control = buttons.find(button => {
          const text = getButtonText(button);
          return text.includes(kind) || (kind === 'microphone' && text.includes('mic'));
        });

        if (!control) {
          return { found: false, isOff: false, label: null };
        }

        const label = getButtonText(control);
        const isOff =
          label.includes(`turn on ${kind}`) ||
          (kind === 'microphone' && label.includes('turn on mic')) ||
          label.includes(`${kind} is off`) ||
          (kind === 'microphone' && label.includes('microphone is muted')) ||
          (kind === 'microphone' && label.includes('mic is off'));

        const isOn =
          label.includes(`turn off ${kind}`) ||
          (kind === 'microphone' && label.includes('turn off mic')) ||
          label.includes(`${kind} is on`) ||
          (kind === 'microphone' && label.includes('microphone is on')) ||
          (kind === 'microphone' && label.includes('mic is on'));

        return { found: true, isOff, isOn, label, control };
      };

      const ensureOff = async (kind) => {
        let state = getControlState(kind);

        for (let attempt = 0; attempt < 5; attempt++) {
          if (state.found && state.isOff) {
            return { kind, success: true, label: state.label, clicked: attempt > 0 };
          }

          if (state.found && state.isOn) {
            state.control.click();
            await sleep(700);
          } else {
            await sleep(700);
          }

          state = getControlState(kind);
        }

        return {
          kind,
          found: state.found,
          success: state.found ? state.isOff : true, 
          label: state.label,
          clicked: false
        };
      };

      const camera = await ensureOff('camera');
      const microphone = await ensureOff('microphone');

      return { camera, microphone };
    });

    logger.info(`GoogleMeetJoiner(preJoinMedia): Pre-join media state: ${JSON.stringify(result)}`);

    const cameraOk = result.camera?.success || result.camera?.found === false;
    const micOk = result.microphone?.success || result.microphone?.found === false;

    if (!cameraOk || !micOk) {
      logger.warn(
        `GoogleMeetJoiner(preJoinMedia): Media state uncertain (headless mode), continuing anyway: ${JSON.stringify(result)}`
      );
    }

  } catch (e) {
    logger.error('GoogleMeetJoiner(preJoinMedia): Pre-join media setup failed:', e.message);
    throw e;
  }
};