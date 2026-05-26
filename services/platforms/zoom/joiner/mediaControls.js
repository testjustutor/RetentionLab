// mediaControls.js

/**
 * Prepares media state before fully joining the Zoom meeting.
 * Disables microphone and camera on the preview screen.
 */
module.exports.preparePreJoinMedia = async function preparePreJoinMedia(frame) {
  return await frame.evaluate(() => {
    // --- Helper Functions for Dynamic DOM Evaluation ---
    const isElementVisible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
    };

    const getElementText = (el) => {
      return `${el.innerText || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`.trim();
    };

    const clickTargetByRegex = (regex) => {
      const target = Array.from(document.querySelectorAll('button, label, span, div[role="button"]'))
        .find(el => isElementVisible(el) && regex.test(getElementText(el)));

      if (target) {
        target.click();
        return true;
      }
      return false;
    };

    const result = { muted: false, videoOff: false };

    // --- 1. Handle Microphone Pre-Join ---
    const micCheckbox = Array.from(document.querySelectorAll('input[type="checkbox"]'))
      .find(input => /mute.*microphone|do not connect.*audio/i.test(getElementText(input.closest('label') || input)));

    if (micCheckbox) {
      if (!micCheckbox.checked) micCheckbox.click();
      result.muted = true;
    } else {
      result.muted = clickTargetByRegex(/(^|\s)mute(\s|$)|mute audio|mute microphone/i);
    }

    // --- 2. Handle Camera Pre-Join ---
    const videoCheckbox = Array.from(document.querySelectorAll('input[type="checkbox"]'))
      .find(input => /turn off.*video|stop.*video|camera/i.test(getElementText(input.closest('label') || input)));

    if (videoCheckbox) {
      if (!videoCheckbox.checked) videoCheckbox.click();
      result.videoOff = true;
    } else {
      result.videoOff = clickTargetByRegex(/turn off my video|stop video|video off/i);
    }

    return result;
  });
};

/**
 * Ensures the microphone is muted and camera is off once inside the meeting.
 * Uses a verification loop and Alt+A as a fallback for the microphone.
 */
module.exports.ensureMicMuted = async function ensureMicMuted(frame) {
  let isMicMuted = false;
  let isVideoOff = false;
  let attempts = 0;
  const MAX_ATTEMPTS = 15; // Prevents infinite loops

  while ((!isMicMuted || !isVideoOff) && attempts < MAX_ATTEMPTS) {
    attempts++;

    // Wake up the Zoom toolbar to ensure controls are rendered in the DOM
    await frame.evaluate(() => {
      document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    });

    // Allow UI transition/fade-in animation to complete
    await new Promise(resolve => setTimeout(resolve, 800));

    // Evaluate current media state and click UI buttons if needed
    const state = await frame.evaluate(() => {
      const isVisible = (el) => el && window.getComputedStyle(el).display !== 'none' && el.offsetWidth > 0;

      const controls = Array.from(document.querySelectorAll('button, div[role="button"]'))
        .filter(isVisible)
        .map(el => ({
          el,
          text: `${el.innerText || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`.trim()
        }));

      // --- Check and Click Microphone ---
      const micMuted = !!controls.find(item => /unmute|join audio/i.test(item.text));
      const micActive = controls.find(item => /(^|\s)mute(\s|$)|mute audio|mute microphone/i.test(item.text));
      
      if (micActive) micActive.el.click();

      // --- Check and Click Video ---
      const videoOff = !!controls.find(item => /start video/i.test(item.text));
      const videoActive = controls.find(item => /stop video/i.test(item.text));
      
      if (videoActive) videoActive.el.click();

      return { micMuted, videoOff };
    });

    isMicMuted = state.micMuted;
    isVideoOff = state.videoOff;

    // Break early if verification passes (both are off)
    if (isMicMuted && isVideoOff) {
      break; 
    }

    // --- Fallback: Keyboard Shortcut for Mic ---
    // If UI clicks fail to mute the mic after 2 attempts, force Alt+A
    if (!isMicMuted && this.page && this.page.keyboard && attempts >= 2) {
      await this.page.keyboard.down('Alt');
      await this.page.keyboard.press('a');
      await this.page.keyboard.up('Alt');
    }

    // Wait before the next verification cycle
    await new Promise(resolve => setTimeout(resolve, 1500)); 
  }

  return {
    muted: isMicMuted,
    videoOff: isVideoOff,
    attempts: attempts,
    action: (isMicMuted && isVideoOff) ? 'verified-disabled' : 'max-attempts-reached'
  };
};