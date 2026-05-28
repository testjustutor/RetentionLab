const { logger } = require('../../../../utils/logger');

module.exports = async function joinMeeting() {
  logger.info('ZoomJoiner(joinMeeting): STAGE 1: Navigating to Zoom (Deep Scan Flow)...');
  await this.page.goto(this.meetingUrl, { waitUntil: 'networkidle2' });

  let joined = false;
  let attempts = 0;
  const MAX_ATTEMPTS = 360;

  while (!joined && attempts < MAX_ATTEMPTS) {
    attempts++;
    const allFrames = this.page.frames();

    logger.info(`ZoomJoiner(joinMeeting): --- Join Attempt ${attempts}/${MAX_ATTEMPTS} | Detected ${allFrames.length} frames ---`);

    for (let i = 0; i < allFrames.length; i++) {
      const frame = allFrames[i];
      const url = frame.url();

      if (!url || url === 'about:blank') continue;

      try {
        const analysis = await frame.evaluate((name, code) => {
          const findText = (regex) => Array.from(document.querySelectorAll('button, a, span, h1, div'))
            .find(el => regex.test(el.innerText));

          const hasLeave = !!document.querySelector('button[aria-label*="Leave"], .footer-button__leave-btn, #leave-btn');
          const nameInp = document.querySelector('input#input-for-name, input[placeholder*="name"], input[name*="name"]');
          const passInp = document.querySelector('input#inputpass, input[name*="pass"]');
          const joinBtn = Array.from(document.querySelectorAll('button')).find(b => /Join/i.test(b.innerText) || b.classList.contains('zm-btn--primary'));
          const launchLink = Array.from(document.querySelectorAll('a, button')).find(el => /Join from Your Browser/i.test(el.innerText));
          const cookieBtn = document.querySelector('#onetrust-accept-btn-handler, .optanon-allow-all');

          const isWaitingRoom = document.body.innerText.includes('Please wait, the meeting host will let you in soon') ||
            document.body.innerText.includes('waiting for the host to start this meeting');

          return {
            hasLeave,
            foundNameInput: !!nameInp,
            foundPassInput: !!passInp,
            foundJoinBtn: !!joinBtn,
            foundLaunchLink: !!launchLink,
            foundCookieBtn: !!cookieBtn,
            isWaitingRoom,
            bodySnippet: document.body.innerText.substring(0, 100).replace(/\n/g, ' ')
          };
        }, this.botName, this.passcode);

        logger.info(`ZoomJoiner(joinMeeting):  Frame[${i}] URL: ${url.substring(0, 50)}...`);
        logger.info(`ZoomJoiner(joinMeeting):   - Content Snippet: "${analysis.bodySnippet}..."`);

        if (analysis.foundCookieBtn) {
          logger.info(`ZoomJoiner(joinMeeting):  - [ACTION] Clicking Cookie Banner`);
          await frame.click('#onetrust-accept-btn-handler, .optanon-allow-all').catch(() => {});
        }

        if (analysis.foundLaunchLink) {
          logger.info(`ZoomJoiner(joinMeeting): - [ACTION] Forcing "Join from Your Browser" flow`);

          await frame.evaluate(async () => {
            const launchBtn = Array.from(document.querySelectorAll('button, a'))
              .find(el => /Launch Meeting/i.test(el.innerText));

            if (launchBtn) launchBtn.click();

            const browserLink = Array.from(document.querySelectorAll('a, button'))
              .find(el => /Join from Your Browser/i.test(el.innerText));

            if (browserLink) {
              browserLink.click();
              return "CLICKED";
            }

            return "LINK_NOT_FOUND";
          });

          await this.page.waitForNavigation({
            waitUntil: 'networkidle2',
            timeout: 8000
          }).catch(() => {
            logger.info("ZoomJoiner(joinMeeting):  (Navigation timeout - might already be on the next page)");
          });

          break;
        }

        // ==========================================
        // REORDERED SECTION: MUTE FIRST, THEN TYPE
        // ==========================================
        if (analysis.foundNameInput && !analysis.hasLeave) {
          
          // STEP 1: Wait for media controls to load
          logger.info(`ZoomJoiner(joinMeeting): - Waiting for Pre-Join Media controls to render...`);
          try {
            await frame.waitForFunction(() => {
              const textOf = (el) => `${el.innerText || ''} ${el.getAttribute('aria-label') || ''}`.trim();
              
              const hasMediaControls = Array.from(document.querySelectorAll('button, input, label, span, div[role="button"]'))
                .some(el => /mute|audio|microphone|video|camera/i.test(textOf(el)));
              
              return hasMediaControls;
            }, { timeout: 6000 });
          } catch (err) {
            logger.warn(`ZoomJoiner(joinMeeting): - Media controls did not render in time. Proceeding anyway.`);
          }

          // STEP 2: Mute Media
          const mediaStateResult = await this.preparePreJoinMedia(frame);
          logger.info(`ZoomJoiner(joinMeeting): - Pre-join media state: ${JSON.stringify(mediaStateResult)}`);

          await new Promise(r => setTimeout(r, 1000));

          // STEP 3: Enter Name (and Passcode)
          logger.info(`ZoomJoiner(joinMeeting): - [ACTION] Filling Name`);
          await frame.type(
            'input#input-for-name, input[placeholder*="name"]',
            this.botName
          );

          if (analysis.foundPassInput) {
            await frame.type('input#inputpass', this.passcode);
          }

          // STEP 4: Click Join
          logger.info(`ZoomJoiner(joinMeeting): - [ACTION] Clicking Join Button`);
          await frame.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button'))
              .find(b => /Join/i.test(b.innerText) || b.classList.contains('zm-btn--primary'));

            if (btn) btn.click();
          });
        }
        // ==========================================

        if (analysis.hasLeave) {
          const muteState = await this.ensureMicMuted(frame);
          
          logger.info(`ZoomJoiner(joinMeeting): - In-meeting mic state: ${JSON.stringify(muteState)}`);
          
          joined = true;
          
          logger.info('ZoomJoiner(joinMeeting): SUCCESS: Leave button detected!');
          
          break;

        } else if (analysis.isWaitingRoom) {
          logger.info('ZoomJoiner(joinMeeting): STATUS: In Waiting Room / Lobby. Waiting for host...');
        }

      } catch (e) {

        if (e.message.includes('Execution context was destroyed')) {
          logger.info(`ZoomJoiner(joinMeeting): - Frame[${i}] context reset (normal during navigation).`);
        } else {
          logger.info(`ZoomJoiner(joinMeeting): - Frame[${i}] eval locked/failed: ${e.message}`);
        }

      }
    }

    if (joined) break;

    await new Promise(r => setTimeout(r, 5000));
  }

  if (!joined) {
    await this.page.screenshot({ path: './logs/image/stuck_debug.png' });

    logger.error('ZoomJoiner(joinMeeting): FAILED: Saved stuck_debug.png. Check the logs above to see which frame had the buttons.');

    throw new Error('Zoom join failed');
  }
};