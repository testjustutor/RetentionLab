// chatManager.js

const { logger } = require('../../../../utils/logger');

module.exports = async function sendChatRequest() {

  logger.info('ZoomJoiner(chatManager): JT MODE: Sending chat request for captions...');

  const frame = await this.getZoomFrame();

  try {

    await frame.evaluate((name) => {

      const chatBtn = document.querySelector(
        '.footer-button-base__button-label[aria-label*="Chat"], .chat-button'
      );

      if (chatBtn) {
        chatBtn.click();
      }

      setTimeout(() => {

        const textarea = document.querySelector(
          '.chat-box__chat-textarea, #chat-textarea, textarea[placeholder*="message"]'
        );

        if (textarea) {

          const msg = `Hi everyone, I'm ${name}. To help me transcribe this meeting, please click "Captions" and "Enable Auto-Transcription" in your Zoom toolbar. Thanks!`;

          textarea.value = msg;

          textarea.dispatchEvent(
            new Event('input', { bubbles: true })
          );

          const enterEvent = new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            keyCode: 13,
            key: 'Enter'
          });

          textarea.dispatchEvent(enterEvent);
        }

      }, 1500);

    }, this.botName);

  } catch (e) {

    logger.error(
      'ZoomJoiner(chatManager): Chat Request Error: ' + e.message
    );
  }
};