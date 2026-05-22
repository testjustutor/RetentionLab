const { logger } = require('../../../utils/logger');

/**
 * Capture participant names from Google Meet when bot joins
 * Extracts names from the participants/people panel
 */
class ParticipantCapture {
  constructor(page) {
    this.page = page;
  }

  /**
   * Open the people/participants panel in Google Meet
   */
  async openPeoplePanel() {
    try {
      const peopleBtnSelectors = [
        'button[aria-label*="People"]',
        'button[aria-label="People"]',
        '[data-tooltip*="Show everyone"]',
        '[aria-label*="Show everyone"]',
        'button[aria-label*="participants"]',
        'button[aria-label="participants"]'
      ];

      let opened = false;
      for (const selector of peopleBtnSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            await element.click();
            opened = true;
            logger.info('GoogleMeetAdapter(participantCapture): People panel opened');
            break;
          }
        } catch (_) {
          // Continue to next selector
        }
      }

      if (opened) {
        // Wait for panel to render
        await new Promise(r => setTimeout(r, 800));
      }

      return opened;
    } catch (err) {
      logger.warn('GoogleMeetAdapter(participantCapture): Failed to open people panel:', err.message);
      return false;
    }
  }

  /**
   * Extract participant names from the DOM
   */
  async extractParticipantNames() {
    try {
      const participants = await this.page.evaluate(() => {
        const names = [];

        // Strategy 1: Look for roster items in people panel (most reliable)
        const rosterSelectors = [
          '[role="listitem"][data-participant-id]',
          '[role="listitem"] [data-name]',
          'div[data-participant-id]',
          '[data-requested-participant-id]'
        ];

        for (const selector of rosterSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            elements.forEach(el => {
              // Try multiple ways to extract the name
              let name = null;

              // Method 1: data-name attribute
              if (el.hasAttribute('data-name')) {
                name = el.getAttribute('data-name');
              }

              // Method 2: aria-label on the element or parent
              if (!name) {
                name = el.getAttribute('aria-label') || 
                       el.parentElement?.getAttribute('aria-label');
              }

              // Method 3: Check for text content in specific child elements
              if (!name) {
                const nameEl = el.querySelector('[data-name], [aria-label*="name"], span');
                if (nameEl) {
                  name = nameEl.textContent || nameEl.innerText;
                }
              }

              // Method 4: First text node as fallback
              if (!name) {
                const text = el.innerText || el.textContent;
                if (text) {
                  // Get first line only, in case of multi-line content
                  name = text.split('\n')[0];
                }
              }

              if (name && name.trim().length > 0) {
                const cleanName = name.trim().replace(/\s+/g, ' ');
                if (!names.includes(cleanName) && cleanName.length < 200) {
                  names.push(cleanName);
                }
              }
            });

            if (names.length > 0) return names;
          }
        }

        // Strategy 2: Look for video tiles with participant names (fallback)
        try {
          const videoTiles = document.querySelectorAll('[data-allocation-index], [data-participant-id]');
          videoTiles.forEach(tile => {
            const label = tile.getAttribute('aria-label') || 
                         tile.getAttribute('data-name') ||
                         tile.title;
            if (label && label.trim().length > 0) {
              const cleanName = label.trim().replace(/\s+/g, ' ');
              if (!names.includes(cleanName) && cleanName.length < 200) {
                names.push(cleanName);
              }
            }
          });
        } catch (_) {}

        return names;
      });

      return participants;
    } catch (err) {
      logger.error('GoogleMeetAdapter(participantCapture): Error extracting names:', err.message);
      return [];
    }
  }

  /**
   * Capture all participant names (opens panel, extracts names, closes panel)
   */
  async captureParticipants() {
    try {
      logger.info('GoogleMeetAdapter(participantCapture): Starting participant capture');

      // Open people panel
      const panelOpened = await this.openPeoplePanel();

      // Extract participant names
      const participants = await this.extractParticipantNames();

      logger.info(
        `GoogleMeetAdapter(participantCapture): Captured ${participants.length} participants: ${participants.join(', ')}`
      );

      return {
        success: true,
        count: participants.length,
        names: participants,
        panelOpened: panelOpened,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      logger.error('GoogleMeetAdapter(participantCapture): Capture failed:', err.message);
      return {
        success: false,
        count: 0,
        names: [],
        error: err.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = ParticipantCapture;
