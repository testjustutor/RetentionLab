const { logger } = require('../../../utils/logger');

class TeamsJoiner {
  constructor(page, botName, meetingUrl) {
    this.page = page;
    this.botName = botName;
    this.meetingUrl = meetingUrl;
  }

  // -----------------------------
  // MAIN ENTRY
  // -----------------------------
  async joinMeeting() {
      logger.info('STAGE 1: Navigating to Microsoft Teams...');

      await this.page.goto(this.meetingUrl, {
        waitUntil: 'networkidle2'
      });

      // --- FORCED BYPASS FOR THE "JOIN YOUR TEAMS MEETING" SCREEN ---
      try {
        // Target the exact data-tid from your HTML inspect
        const browserBtnSelector = 'button[data-tid="joinOnWeb"]';
        
        logger.info('Waiting for "Continue on this browser" button...');
        await this.page.waitForSelector(browserBtnSelector, { timeout: 15000 });
        
        // Use evaluate to click to bypass any overlay issues
        await this.page.evaluate((selector) => {
          const btn = document.querySelector(selector);
          if (btn) btn.click();
        }, browserBtnSelector);
        
        logger.info('✅ Clicked: Continue on this browser');
      } catch (e) {
        logger.info('Launcher screen not detected or already bypassed');
      }
      // ----------------------------

      await this.handlePreJoin();
      await this.enterLobby();
      await this.waitForJoinConfirmation();
  }

  // -----------------------------
  // HANDLE PRE-JOIN SCREEN
  // -----------------------------
// -----------------------------
  // HANDLE PRE-JOIN SCREEN
  // -----------------------------
  async handlePreJoin() {
    logger.info('🔍 Handling Teams pre-join screen...');

    try {
      // Fix for "waitForTimeout is not a function"
      await new Promise(resolve => setTimeout(resolve, 6000)); 

      await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
        
        const clickByText = (regex) => {
          const btn = buttons.find(b => regex.test(b.innerText || b.getAttribute('aria-label') || ''));
          if (btn) btn.click();
        };

        // Mute camera and mic
        clickByText(/camera|video|turn off/i);
        clickByText(/mic|audio|mute/i);
      });
    } catch (e) {
      logger.error('Pre-join adjustments error: ' + e.message);
    }
  }

  // -----------------------------
  // ENTER NAME + JOIN
  // -----------------------------
  async enterLobby() {
    logger.info('🚀 Attempting to join Teams meeting...');

    try {
      // 1. Wait for name input
      const nameInput = 'input[placeholder*="name"], input[type="text"]';
      await this.page.waitForSelector(nameInput, { timeout: 10000 });
      await this.page.type(nameInput, this.botName, { delay: 500 });

      logger.info(`✅ Set bot name to: ${this.botName}`);

      // 3. Wait 2 seconds for the "Join now" button to become enabled

      // 2. Click the specific Join Now button for Web Client
      const joinBtn = 'button[data-tid="prejoin-join-button"]';
      await this.page.waitForSelector(joinBtn, { timeout: 5000 });
      await this.page.click(joinBtn);
      
      logger.info('✅ Clicked Join Now');
    } catch (e) {
      logger.error('❌ Failed to join lobby: ' + e.message);
    }
  }

  // -----------------------------
  // CONFIRM JOINED
  // -----------------------------
  // -----------------------------
  // CONFIRM JOINED (LOBBY WAIT)
  // -----------------------------
  async waitForJoinConfirmation() {
    // Increase to 10 minutes (200 checks * 3s) because hosts can take time to admit
    logger.info('⏳ Bot is in the lobby. Waiting for host to admit...');

    for (let i = 0; i < 200; i++) { 
      const sessionState = await this.page.evaluate(() => {
        const text = document.body.innerText;
        return {
          isAdmitted: !!(document.querySelector('[data-tid="meeting-title"]') || 
                         document.querySelector('.meeting-control-bar') ||
                         document.querySelector('[aria-label*="Hang up"]')),
          isStillInLobby: text.includes('Someone will let you in shortly') || 
                          text.includes('waiting in the lobby')
        };
      });

      if (sessionState.isAdmitted) {
        logger.info('✅ SUCCESS: Host admitted the bot to the meeting');
        // Small delay to let the UI load before starting monitor
        await new Promise(r => setTimeout(r, 5000));
        return true;
      }

      if (i % 10 === 0) {
        logger.info('...still waiting in lobby for host admission...');
      }

      await new Promise(r => setTimeout(r, 3000));
    }

    logger.warn('⚠️ Admission timeout: Bot was never let into the meeting');
  }

  // -----------------------------
  // UPDATED CAPTION MONITOR
  // -----------------------------
  async startTranscriptMonitor() {
    logger.info('🚀 Admitted! Starting Teams transcript monitor...');

    // First, try to turn on captions if the host allows it
    await this.enableCaptionsIfPossible();

    setInterval(async () => {
      try {
        const captions = await this.page.evaluate(() => {
          // Look for Teams Web Caption containers
          const captionContainer = document.querySelector('.pt-captions-container') || 
                                 document.querySelector('[data-tid="closed-captions-renderer"]');
          
          if (captionContainer) return captionContainer.innerText;

          // Fallback: look for any updated text blocks in the main area
          const nodes = Array.from(document.querySelectorAll('div[data-tid="caption-text"]'));
          return nodes.map(n => n.innerText).join('\n');
        });

        if (captions && captions.trim().length > 0) {
          logger.info(`📝 TEAMS CAPTION: ${captions.slice(-150)}`);
        }
      } catch (e) {
        logger.error('Teams caption monitor error:', e.message);
      }
    }, 4000);
  }

  // -----------------------------
  // OPTIONAL: TRY ENABLE CAPTIONS
  // -----------------------------
  async enableCaptionsIfPossible() {
    logger.info('🔍 Attempting to enable Teams captions...');

    try {
      await this.page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => {
            const t = (b.innerText || '').toLowerCase();
            const a = (b.getAttribute('aria-label') || '').toLowerCase();
            return t.includes('Captions') || a.includes('captions');
          });

        if (btn) btn.click();
      });

    } catch (e) {
      logger.warn('Teams captions not available or already enabled');
    }
  }
}

module.exports = TeamsJoiner;