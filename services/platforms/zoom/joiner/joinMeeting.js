const { logger } = require('../../../../utils/logger');

module.exports = async function joinMeeting() {
  logger.info('ZoomAdapter(zoomJoiner): STAGE 1: Navigating to Zoom (Deep Scan Flow)...');
  await this.page.goto(this.meetingUrl, { waitUntil: 'networkidle2' });

  let joined = false;
  let attempts = 0;
  const MAX_ATTEMPTS = 360;

  while (!joined && attempts < MAX_ATTEMPTS) {
    attempts++;
    const allFrames = this.page.frames();

    logger.info(`ZoomAdapter(zoomJoiner): --- Join Attempt ${attempts}/${MAX_ATTEMPTS} | Detected ${allFrames.length} frames ---`);

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

        logger.info(`ZoomAdapter(zoomJoiner):  Frame[${i}] URL: ${url.substring(0, 50)}...`);
        logger.info(`ZoomAdapter(zoomJoiner):   - Content Snippet: "${analysis.bodySnippet}..."`);

        if (analysis.foundCookieBtn) {
          logger.info(`ZoomAdapter(zoomJoiner):  - [ACTION] Clicking Cookie Banner`);
          await frame.click('#onetrust-accept-btn-handler, .optanon-allow-all').catch(() => {});
        }

        if (analysis.foundLaunchLink) {
          logger.info(`ZoomAdapter(zoomJoiner): - [ACTION] Forcing "Join from Your Browser" flow`);

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
            logger.info("ZoomAdapter(zoomJoiner):  (Navigation timeout - might already be on the next page)");
          });

          break;
        }

        // ==========================================
        // REORDERED SECTION: MUTE FIRST, THEN TYPE
        // ==========================================
        if (analysis.foundNameInput && !analysis.hasLeave) {
          
          // STEP 1: Wait for media controls to load
          logger.info(`ZoomAdapter(zoomJoiner): - Waiting for Pre-Join Media controls to render...`);
          try {
            await frame.waitForFunction(() => {
              const textOf = (el) => `${el.innerText || ''} ${el.getAttribute('aria-label') || ''}`.trim();
              
              const hasMediaControls = Array.from(document.querySelectorAll('button, input, label, span, div[role="button"]'))
                .some(el => /mute|audio|microphone|video|camera/i.test(textOf(el)));
              
              return hasMediaControls;
            }, { timeout: 6000 });
          } catch (err) {
            logger.warn(`ZoomAdapter(zoomJoiner): - Media controls did not render in time. Proceeding anyway.`);
          }

          // STEP 2: Mute Media
          const mediaStateResult = await this.preparePreJoinMedia(frame);
          logger.info(`ZoomAdapter(zoomJoiner): - Pre-join media state: ${JSON.stringify(mediaStateResult)}`);

          await new Promise(r => setTimeout(r, 1000));

          // STEP 3: Enter Name (and Passcode)
          logger.info(`ZoomAdapter(zoomJoiner): - [ACTION] Filling Name`);
          await frame.type(
            'input#input-for-name, input[placeholder*="name"]',
            this.botName
          );

          if (analysis.foundPassInput) {
            await frame.type('input#inputpass', this.passcode);
          }

          // STEP 4: Click Join
          logger.info(`ZoomAdapter(zoomJoiner): - [ACTION] Clicking Join Button`);
          await frame.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button'))
              .find(b => /Join/i.test(b.innerText) || b.classList.contains('zm-btn--primary'));

            if (btn) btn.click();
          });
        }
        // ==========================================

        if (analysis.hasLeave) {
          const muteState = await this.ensureMicMuted(frame);
          
          logger.info(`ZoomAdapter(zoomJoiner): - In-meeting mic state: ${JSON.stringify(muteState)}`);
          
          joined = true;
          
          logger.info('ZoomAdapter(zoomJoiner): SUCCESS: Leave button detected!');
          
          break;

        } else if (analysis.isWaitingRoom) {
          logger.info('ZoomAdapter(zoomJoiner): STATUS: In Waiting Room / Lobby. Waiting for host...');
        }

      } catch (e) {

        if (e.message.includes('Execution context was destroyed')) {
          logger.info(`ZoomAdapter(zoomJoiner): - Frame[${i}] context reset (normal during navigation).`);
        } else {
          logger.info(`ZoomAdapter(zoomJoiner): - Frame[${i}] eval locked/failed: ${e.message}`);
        }

      }
    }

    if (joined) break;

    await new Promise(r => setTimeout(r, 5000));
  }

  if (!joined) {
    await this.page.screenshot({ path: './logs/image/stuck_debug.png' });

    logger.error('ZoomAdapter(zoomJoiner): FAILED: Saved stuck_debug.png. Check the logs above to see which frame had the buttons.');

    throw new Error('Zoom join failed');
  }
};