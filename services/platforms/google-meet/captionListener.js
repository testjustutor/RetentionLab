const TranscriptModel = require('../../../models/transcriptModel');
const { logger } = require('../../../utils/logger.js');

class CaptionListener {
  constructor(page, sessionId) {
    this.page = page;
    this.sessionId = sessionId;
    this.intervalId = null;
    this.seenRows = new Set();
    this.currentActiveSpeaker = null;
  }

  async start() {
    logger.info('GoogleMeetAdapter(captionListener): Caption listener started (Tracking Active Speakers)');
    this.intervalId = setInterval(async () => {
      try {
        await this.pollCaptions(); 
      } catch (err) {
        logger.error('GoogleMeetAdapter(captionListener): Error in caption listener loop:', err.message);
      }
    }, 3000);
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('GoogleMeetAdapter(captionListener): Caption listener stopped');
    }
  }

  async pollCaptions() {
    try {
      const frame = this.page.frames().find(f => f.url().includes('zoom.us')) || this.page;

      const snippets = await frame.evaluate(() => {
        const sidebar = document.querySelector('.transcript-item-area, .zm-transcript-viewer, .zm-sidebar-pane__content');
        if (!sidebar) return [];

        const items = Array.from(sidebar.querySelectorAll('div, li, span'))
          .filter(el => {
            const text = el.innerText || "";
            return text.length > 5 && /\d/.test(text) && el.offsetWidth > 0;
          });

        return items.map(i => i.innerText.trim());
      });

      for (const text of snippets) {
        if (!this.seenRows.has(text)) {
          this.seenRows.add(text);          
          logger.info(`GoogleMeetAdapter(captionListener): [Transcript Content]: ${text}`);
        }
      }
    } catch (e) {
      logger.debug(`GoogleMeetAdapter(captionListener): Polling skip: ${e.message}`);
    }
  }
}

module.exports = CaptionListener;