const { logger } = require('../../../utils/logger');

class TeamsJoiner {
  constructor(page, botName, meetingUrl, passcode) {
    this.page = page;
    this.botName = botName;
    this.meetingUrl = meetingUrl;
    this.passcode = passcode;
  }

  // -----------------------------
  // MAIN ENTRY
  // -----------------------------
  async joinMeeting() {
      logger.info('TeamsAdapter: STAGE 1: Navigating to Microsoft Teams...');

      // --- PREVENT NATIVE PROTOCOL HANDLER PROMPT ---
      try {
        await this.page.setRequestInterception(true);
        this.page.on('request', (request) => {
          try {
            const url = request.url();
            // If Teams tries to launch the local desktop app, block it so the native prompt doesn't appear
            if (url.startsWith('msteams:') || url.startsWith('teamscmd:') || url.startsWith('ms-teams:')) {
              logger.info('TeamsAdapter: Blocked Teams Desktop App launch attempt.');
              request.abort();
            } else {
              request.continue();
            }
          } catch (err) {}
        });
      } catch (e) {
        logger.warn('TeamsAdapter: Request interception already handled or failed.');
      }

      await this.page.goto(this.meetingUrl, {
        waitUntil: 'networkidle2'
      });

      // Press Escape to dismiss any existing native popups just in case
      await this.page.keyboard.press('Escape').catch(() => {});

      // --- FORCED BYPASS FOR THE "JOIN YOUR TEAMS MEETING" SCREEN ---
      try {
        
        logger.info('TeamsAdapter: Waiting for "Continue on this browser" button...');
        
        await this.page.waitForFunction(() => {
          const btnTid = document.querySelector('button[data-tid="joinOnWeb"]');
          const btnText = Array.from(document.querySelectorAll('button, a')).find(el => {
             const t = (el.innerText || '').toLowerCase();
             return t.includes('continue on this browser') || 
                    t.includes('join on the web') || 
                    t.includes('join in this browser') ||
                    t.includes('join meeting from this browser');
          });
          const cancelBtn = Array.from(document.querySelectorAll('button')).find(el => (el.innerText || '').trim() === 'Cancel');
          return !!(btnTid || btnText || cancelBtn);
        }, { timeout: 15000 });
        
        await this.page.evaluate(() => {
          // First, if there's a Cancel button for an HTML app launch modal, click it
          const cancelBtn = Array.from(document.querySelectorAll('button')).find(el => (el.innerText || '').trim() === 'Cancel');
          if (cancelBtn) cancelBtn.click();

          const btnTid = document.querySelector('button[data-tid="joinOnWeb"]');
          if (btnTid) {
            btnTid.click();
            return;
          }
          const btnText = Array.from(document.querySelectorAll('button, a')).find(el => {
             const t = (el.innerText || '').toLowerCase();
             return t.includes('continue on this browser') || 
                    t.includes('join on the web') || 
                    t.includes('join in this browser') ||
                    t.includes('join meeting from this browser');
          });
          if (btnText) btnText.click();
        });
        
        logger.info('TeamsAdapter: Clicked: Continue on this browser');
      } catch (e) {
        logger.info('TeamsAdapter: Launcher screen not detected or already bypassed');
      }
      // ----------------------------

      await this.handlePreJoin();
      await this.enterLobby();
      await this.waitForJoinConfirmation();
  }

  async handlePreJoin() {
    logger.info('TeamsAdapter: Handling Teams pre-join screen...');

    try {
      // Fix for "waitForTimeout is not a function"
      await new Promise(resolve => setTimeout(resolve, 6000)); 

      logger.info('TeamsAdapter: Checking for Passcode Error Modal (Pre-join)...');
      await this.handlePasscodeModal();

      // --- DISMISS "Continue without audio or video" POPUP ---
      logger.info('TeamsAdapter: Checking for audio/video permission popup...');
      await this.page.evaluate(async () => {
        const delay = ms => new Promise(r => setTimeout(r, ms));
        for (let i = 0; i < 4; i++) { // Poll for up to 2 seconds
          const continueBtn = Array.from(document.querySelectorAll('button')).find(
            b => /continue without audio/i.test(b.innerText || '')
          );
          if (continueBtn) {
            continueBtn.click();
            await delay(1000); // give the UI a second to animate the popup closing
            break;
          }
          await delay(500);
        }
      });

      await this.page.evaluate(() => {
        // Safely check toggle state using aria-pressed (ported from reactive flow)
        const mic = document.querySelector('[aria-label*="microphone"], [aria-label*="mic"]');
        if (mic && mic.getAttribute('aria-pressed') === 'true') mic.click();

        const cam = document.querySelector('[aria-label*="camera"], [aria-label*="video"]');
        if (cam && cam.getAttribute('aria-pressed') === 'true') cam.click();
      });
    } catch (e) {
      logger.error('TeamsAdapter: Pre-join adjustments error: ' + e.message);
    }
  }

  // -----------------------------
  // ENTER NAME + JOIN
  // -----------------------------
  async enterLobby() {
    logger.info('TeamsAdapter: Attempting to join Teams meeting...');

    try {
      // 1. Wait for name input
      const nameInput = 'input[placeholder*="name"], input[type="text"]';
      await this.page.waitForSelector(nameInput, { timeout: 10000 });
      
      // Clear the input first (Teams sometimes caches names or puts default focus)
      await this.page.click(nameInput, { clickCount: 3 });
      await this.page.keyboard.press('Backspace');
      await this.page.type(nameInput, this.botName, { delay: 500 });

      logger.info(`TeamsAdapter: Set bot name to: ${this.botName}`);

      // Teams Enterprise uses data-tid="prejoin-join-button", Teams Live/Personal uses different DOM
      await this.page.evaluate(async () => {
        const delay = ms => new Promise(r => setTimeout(r, ms));
        
        for(let i = 0; i < 10; i++) { // Check for 5 seconds
           const btnTid = document.querySelector('button[data-tid="prejoin-join-button"]');
           if (btnTid && !btnTid.disabled) {
             btnTid.click();
             return;
           }
           
           const btnText = Array.from(document.querySelectorAll('button')).find(b => /join now/i.test(b.innerText || '') && !b.disabled);
           if (btnText) {
             btnText.click();
             return;
           }
           await delay(500);
        }
        throw new Error("Join button not found or remained disabled");
      });
      
      logger.info('TeamsAdapter: Clicked Join Now');
    } catch (e) {
      logger.error('TeamsAdapter: Failed to join lobby: ' + e.message);
    }
  }

  async handlePasscodeModal() {
    const requiresPasscode = await this.page.evaluate(() => {
        const body = document.body.innerText;
        return body.includes("We couldn't find a meeting") || body.includes("Type a meeting passcode");
    });

    if (requiresPasscode) {
        logger.info('TeamsAdapter: Meeting passcode modal detected! Attempting recovery.');
        // First try the passcode passed down from the DB, then fallback to URL extraction
        let pass = this.passcode;
        if (!pass) {
            try {
                const cleanUrl = this.meetingUrl.replace(/[>\])"']+$/, ''); 
                const urlObj = new URL(cleanUrl);
                pass = urlObj.searchParams.get('p') || urlObj.searchParams.get('passcode') || urlObj.searchParams.get('pwd');
            } catch (e) {}
        }

        if (pass) {
            logger.info(`TeamsAdapter: Typing extracted passcode: ${pass}`);
            const passInput = 'input[type="text"], input[type="password"]';
            await this.page.waitForSelector(passInput, { timeout: 5000 }).catch(()=>{});
            await this.page.click(passInput, { clickCount: 3 }).catch(()=>{});
            await this.page.keyboard.press('Backspace');
            await this.page.type(passInput, pass, { delay: 100 }).catch(()=>{});

            await this.page.evaluate(async () => {
                const delay = ms => new Promise(r => setTimeout(r, ms));
                const submitBtn = Array.from(document.querySelectorAll('button')).find(b => /rejoin|join/i.test(b.innerText || ''));
                if (submitBtn) {
                    submitBtn.click();
                    await delay(4000);
                }
            });
            return true; // Successfully submitted
        } else {
            logger.warn('TeamsAdapter: Passcode required but not found in configuration or URL.');
        }
    }
    return false; // Modal not found or no passcode available
  }

  // -----------------------------
  // CONFIRM JOINED (LOBBY WAIT)
  // -----------------------------
  async waitForJoinConfirmation() {
    // Increase to 10 minutes (200 checks * 3s) because hosts can take time to admit
    logger.info('TeamsAdapter: Bot is in the lobby. Waiting for host to admit...');

    for (let i = 0; i < 200; i++) { 
      const sessionState = await this.page.evaluate(() => {
        const text = document.body.innerText;
        return {
          isAdmitted: !!(document.querySelector('[data-tid="meeting-title"]') || 
                         document.querySelector('.meeting-control-bar') ||
                         document.querySelector('[aria-label*="Hang up"]')),
          isStillInLobby: text.includes('Someone will let you in shortly') ||
                          text.includes('waiting in the lobby'),
          needsPasscode: text.includes("We couldn't find a meeting") || 
                         text.includes("Type a meeting passcode")
        };
      });

      if (sessionState.isAdmitted) {
        logger.info('TeamsAdapter: SUCCESS: Host admitted the bot to the meeting');
        // Small delay to let the UI load before starting monitor
        await new Promise(r => setTimeout(r, 5000));
        return true;
      }

      if (sessionState.needsPasscode) {
        logger.info('TeamsAdapter: Passcode modal popped up while waiting!');
        const recovered = await this.handlePasscodeModal();
        if (recovered) {
            // Give it 4 seconds to reload before checking lobby state again
            await new Promise(r => setTimeout(r, 4000));
            continue;
        }
      }

      if (i % 10 === 0) {
        logger.info('TeamsAdapter: ...still waiting in lobby for host admission...');
      }

      await new Promise(r => setTimeout(r, 3000));
    }

    logger.warn('TeamsAdapter: Admission timeout: Bot was never let into the meeting');
  }

  // -----------------------------
  // UPDATED CAPTION MONITOR
  // -----------------------------
  async startTranscriptMonitor() {
    logger.info('TeamsAdapter: Admitted! Starting Teams transcript monitor...');

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
          logger.info(`TeamsAdapter: TEAMS CAPTION: ${captions.slice(-150)}`);
        }
      } catch (e) {
        logger.error('TeamsAdapter: Teams caption monitor error:', e.message);
      }
    }, 4000);
  }

  // -----------------------------
  // OPTIONAL: TRY ENABLE CAPTIONS
  // -----------------------------
  async enableCaptionsIfPossible() {
    logger.info('TeamsAdapter: Attempting to enable Teams captions...');

    try {
      await this.page.evaluate(() => {
        // 1. First, try to open "More actions" (3 dots) if it exists
        const moreBtn = document.querySelector('[aria-label*="More"], [aria-label*="more"]');
        if (moreBtn) moreBtn.click();
      });

      // Wait for dropdown to render
      await new Promise(r => setTimeout(r, 1500));

      await this.page.evaluate(() => {
        // 2. Look for the Captions button in the newly opened menu
        const captionBtn = Array.from(document.querySelectorAll('button, span, div[role="menuitem"]'))
          .find(el => /captions|live captions|transcript/i.test(el.innerText));
          
        if (captionBtn) captionBtn.click();
      });

    } catch (e) {
      logger.warn('TeamsAdapter: captions not available or already enabled');
    }
  }
}

module.exports = TeamsJoiner;