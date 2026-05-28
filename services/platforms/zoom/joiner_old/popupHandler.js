const { logger } = require('../../../../utils/logger');

class PopupHandler {
  constructor(page) {
    this.page = page;
  }

  async handleHostPermissionPopup(frame) {
    logger.info('ZoomJoiner(popupHandler): [START] handleHostPermissionPopup: Checking for Zoom modals...');

    try {
      logger.info('ZoomJoiner(popupHandler): test phase 1: Entering Retry Loop');

      let result = { status: 'not_found' };

      // Retry for up to 5 seconds because Zoom modals have fade-in animations
      for (let i = 0; i < 2; i++) {
        result = await frame.evaluate(async () => {
          const delay = (ms) => new Promise(res => setTimeout(res, ms));

          // 1. Get all buttons on the page
          const buttons = Array.from(document.querySelectorAll('button'));

          // 2. Look for the "Save", "Confirm", or "Done" button
          const saveBtn = buttons.find(btn => {
            const text = btn.innerText.toLowerCase();

            return text.includes('save') ||
                   text.includes('confirm') ||
                   text.includes('done');
          });

          // 3. Look for the specific Language Modal text
          const bodyText = document.body.innerText;

          const isModalVisible =
            bodyText.includes('Language') ||
            bodyText.includes('Captions');

          if (saveBtn && isModalVisible) {
            saveBtn.click();

            return {
              status: 'success',
              type: 'Caption Language Modal',
              btn: saveBtn.innerText
            };
          }

          return { status: 'not_found' };
        });

        if (result.status === 'success') break;

        // Wait 500ms before next attempt
        await new Promise(res => setTimeout(res, 500));
      }

      logger.info(`ZoomJoiner(popupHandler): test phase 17: Result received`);

      if (result.status === 'success') {
        logger.info(`ZoomJoiner(popupHandler): [DETECTED] Found target modal: ${result.type}`);
        logger.info(`ZoomJoiner(popupHandler): [ACTION] Clicked "${result.btn}" button successfully.`);
      } else {
        logger.info('ZoomJoiner(popupHandler): [SKIP] No active Caption/Permission modals found after 5s retry.');

        // --- FAILSAFE ---
        // If the modal is visible but we can't "find" the button via text,
        // hitting "Enter" usually triggers the primary blue button (Save).
        logger.info('ZoomJoiner(popupHandler): [FAILSAFE] Pressing Enter/Escape keys to clear potential stuck modal...');

        if (this.page.keyboard) {
          await this.page.keyboard.press('Enter').catch(() => {});

          await new Promise(res => setTimeout(res, 300));

          await this.page.keyboard.press('Escape').catch(() => {});

          await new Promise(res => setTimeout(res, 300));
        }
      }

    } catch (err) {
      logger.error('ZoomJoiner(popupHandler): EXCEPTION in handleHostPermissionPopup: ' + err.message);
    }

    logger.info('ZoomJoiner(popupHandler): [FINISH] handleHostPermissionPopup: Check complete.');
  }
}

module.exports = PopupHandler;