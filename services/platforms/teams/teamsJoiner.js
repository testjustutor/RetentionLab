/**
 * services/platforms/teams/teamsJoiner.js
 *
 */
const { logger } = require('../../../utils/logger');
const settings = require('../../../config/settings');
const { HostDeniedError, WaitingRoomTimeoutError } = require('../joinErrors');
// Mic/camera enforcement is independently toggleable per platform - see
// services/featureConfig.js.
const featureConfig = require('../../featureConfig').teams;

// Named audio-DEVICE selection (Teams-only, page-scoped) — distinct from
// muteMicAndCamera() below, which only toggles mic/camera ON/OFF and never
// changes which device Teams' own Speaker/Microphone pickers point at. Left
// on the machine's OS default, Teams can select real hardware (e.g. a
// physical headset), which risks feedback/echo disturbance in the meeting.
// This picks the VB-Audio Virtual Cable pair instead so the bot never
// touches real hardware:
//   Speaker    -> "CABLE Input (VB-Audio Virtual Cable)"  (meeting audio is
//                 played INTO the cable)
//   Microphone -> "CABLE Output (VB-Audio Virtual Cable)" (the cable's
//                 matching capture side)
// This intentionally matches config/settings.js's `audio.deviceName` ("audio=
// CABLE Output (VB-Audio Virtual Cable)"), which is what the ffmpeg-based
// AudioRecorder already records FROM — Speaker->CABLE Input is what puts the
// meeting's audio onto that same cable in the first place.
// Configurable via .env (per-machine device names can differ) — kept as
// plain process.env reads here, not in config/settings.js, so this stays
// fully scoped to services/platforms/teams/. Set either to an empty string
// in .env to skip selecting that device and leave Teams' default in place.
const TEAMS_SPEAKER_DEVICE_NAME =
  process.env.TEAMS_SPEAKER_DEVICE_NAME !== undefined
    ? process.env.TEAMS_SPEAKER_DEVICE_NAME
    : 'CABLE Input (VB-Audio Virtual Cable)';
const TEAMS_MIC_DEVICE_NAME =
  process.env.TEAMS_MIC_DEVICE_NAME !== undefined
    ? process.env.TEAMS_MIC_DEVICE_NAME
    : 'CABLE Output (VB-Audio Virtual Cable)';

class TeamsJoiner {
  constructor(page, botName, meetingUrl, passcode) {
    this.page = page;
    this.botName = botName;
    this.meetingUrl = meetingUrl;
    this.passcode = passcode;

    this.captionMonitor = null;
    // FIX 2: allow socraticbot.js to inject a ParticipantTracker, matching
    // how google-meet's joiner is wired (joiner.setParticipantTracker(...))
    this.participantTracker = null;
  }

  // FIX 2: added — mirrors GoogleMeetJoiner's setParticipantTracker pattern
  setParticipantTracker(participantTracker) {
    this.participantTracker = participantTracker;
    logger.info('TeamsAdapter(teamJoiner): Participant tracker attached');
  }

  // ─────────────────────────────────────────────
  // FAKE CAMERA DEVICE SHIM (Teams-only, page-scoped)
  // ─────────────────────────────────────────────
  //
  // WHY THIS EXISTS: the bot's Chrome launch flags include
  // --use-fake-ui-for-media-stream (auto-accepts the permission prompt) but
  // NOT --use-fake-device-for-media-stream (that's a shared, cross-platform
  // launch flag in config/settings.js — intentionally left alone here since
  // Zoom/Google Meet don't need it). Without a real or fake camera device,
  // navigator.mediaDevices.enumerateDevices() reports zero videoinput
  // devices and getUserMedia({video:true}) rejects with
  // NotFoundError: Requested device not found. Teams' own web client hard-
  // requires a "selected camera" to finish its call/device-manager init
  // (logged as "[VideoBKG] No selected camera.
  // Context=device_manager_service_init"); when that fails, Teams' calling
  // engine never actually starts a live call ("No start call scenario",
  // "getCallingConversationAsync is not implemented") — so mic/camera
  // toggle buttons exist in the DOM but aren't wired to a live call, and
  // clicking them (muteMicAndCamera() below) has no real effect.
  //
  // FIX: shim navigator.mediaDevices at the PAGE level, Teams-only, instead
  // of changing the shared browser launch config. enumerateDevices() gets a
  // synthetic videoinput entry appended only if none exists; getUserMedia()
  // falls back to a black canvas-captured MediaStream only when the real
  // call fails with no video device. Verified against a real headless
  // Chromium launched with the exact same flags (no
  // --use-fake-device-for-media-stream): before this shim,
  // enumerateDevices() returns 0 devices and getUserMedia({video:true})
  // throws NotFoundError; after it, enumerateDevices() reports a
  // videoinput device and getUserMedia({video:true}) resolves with a
  // stream containing a real video track.
  //
  // page.evaluateOnNewDocument() re-injects this on every navigation and
  // into every frame (including Teams' own iframes), so it's in place
  // before any Teams script runs, not just the top-level document.
  async _injectFakeCameraShim() {
    try {
      await this.page.evaluateOnNewDocument(() => {
        try {
          const FAKE_DEVICE_ID = 'fake-camera-bot';
          const md = navigator.mediaDevices;
          if (!md) return;

          const originalEnumerateDevices = md.enumerateDevices ? md.enumerateDevices.bind(md) : null;
          md.enumerateDevices = async () => {
            const real = originalEnumerateDevices ? await originalEnumerateDevices() : [];
            const hasVideoInput = real.some((d) => d.kind === 'videoinput');
            if (hasVideoInput) return real;
            return real.concat([
              {
                deviceId: FAKE_DEVICE_ID,
                groupId: 'fake-group',
                kind: 'videoinput',
                label: 'Fake Camera (Bot)',
                toJSON() {
                  return { deviceId: this.deviceId, groupId: this.groupId, kind: this.kind, label: this.label };
                },
              },
            ]);
          };

          const originalGetUserMedia = md.getUserMedia ? md.getUserMedia.bind(md) : null;
          md.getUserMedia = async (constraints) => {
            if (originalGetUserMedia) {
              try {
                return await originalGetUserMedia(constraints);
              } catch (err) {
                if (!(constraints && constraints.video)) throw err;
                // fall through to the synthetic stream below only for a
                // video request that failed for lack of a real device
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            return canvas.captureStream(5);
          };
        } catch (e) {
          // Never let the shim itself break the real page.
        }
      });
    } catch (e) {
      logger.warn('TeamsAdapter(teamJoiner): Failed to inject fake camera shim: ' + e.message);
    }
  }

  // -----------------------------
  // MAIN ENTRY
  // -----------------------------
  async joinMeeting() {
    logger.info('TeamsAdapter(teamJoiner): STAGE 1: Navigating to Microsoft Teams...');

    try {
      await this.page.setRequestInterception(true);
      this.page.removeAllListeners('request');

      this.page.on('request', (request) => {
        try {
          const url = request.url();
          if (
            url.startsWith('msteams:') ||
            url.startsWith('teamscmd:') ||
            url.startsWith('ms-teams:')
          ) {
            logger.info('TeamsAdapter(teamJoiner): Blocked Teams Desktop App launch attempt.');
            request.abort();
          } else {
            request.continue();
          }
        } catch (err) {}
      });
    } catch (e) {
      logger.warn('TeamsAdapter(teamJoiner): Request interception already handled or failed.');
    }

    // Registered BEFORE navigation so it's active for the very first
    // document/frame Teams loads - see _injectFakeCameraShim() above.
    await this._injectFakeCameraShim();

    await this.page.goto(this.meetingUrl, { waitUntil: 'networkidle2' });
    await this.page.keyboard.press('Escape').catch(() => {});

    await this.clickContinueOnBrowser();
    await this.handlePreJoin();
    await this.dismissAudioVideoPopup();
    await this.enterLobby();

    const wasAdmitted = await this.waitForJoinConfirmation();

    return wasAdmitted;
  }

  // -----------------------------
  // STAGE 2: CONTINUE ON BROWSER
  // -----------------------------
  async clickContinueOnBrowser() {
    try {
      logger.info('TeamsAdapter(teamJoiner): Waiting for "Continue on this browser" button...');

      await this.page.waitForFunction(() => {
        const btnTid = document.querySelector('button[data-tid="joinOnWeb"]');
        const btnText = Array.from(document.querySelectorAll('button, a')).find(el => {
          const t = (el.innerText || '').toLowerCase();
          return (
            t.includes('continue on this browser') ||
            t.includes('join on the web') ||
            t.includes('join in this browser') ||
            t.includes('join meeting from this browser')
          );
        });
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(
          el => (el.innerText || '').trim() === 'Cancel'
        );
        return !!(btnTid || btnText || cancelBtn);
      }, { timeout: 15000 });

      await this.page.evaluate(() => {
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(
          el => (el.innerText || '').trim() === 'Cancel'
        );
        if (cancelBtn) cancelBtn.click();

        const btnTid = document.querySelector('button[data-tid="joinOnWeb"]');
        if (btnTid) { btnTid.click(); return; }

        const btnText = Array.from(document.querySelectorAll('button, a')).find(el => {
          const t = (el.innerText || '').toLowerCase();
          return (
            t.includes('continue on this browser') ||
            t.includes('join on the web') ||
            t.includes('join in this browser') ||
            t.includes('join meeting from this browser')
          );
        });
        if (btnText) btnText.click();
      });

      logger.info('TeamsAdapter(teamJoiner): Clicked: Continue on this browser');
    } catch (e) {
      logger.info('TeamsAdapter(teamJoiner): Launcher screen not detected or already bypassed');
    }
  }

  // -----------------------------
  // STAGE 3: PRE-JOIN (mic/cam)
  // FIX 7: extracted the actual mute logic into muteMicAndCamera() so it can
  // be re-run after passcode-modal recovery without duplicating code.
  // -----------------------------
  async handlePreJoin() {
    logger.info('TeamsAdapter(teamJoiner): Handling Teams pre-join screen...');

    try {
      await new Promise(resolve => setTimeout(resolve, 6000));

      logger.info('TeamsAdapter(teamJoiner): Checking for Passcode Error Modal (Pre-join)...');
      await this.handlePasscodeModal();

      // Select the VB-Audio Virtual Cable devices BEFORE muting, so the
      // pre-join preview (and the live call, once joined) is always on the
      // virtual cable rather than real hardware — see the constants above.
      await this.selectAudioDevices();
      await this.muteMicAndCamera();
    } catch (e) {
      logger.error('TeamsAdapter(teamJoiner): Pre-join adjustments error: ' + e.message);
    }
  }

  // FIX 7: reusable mic/cam mute helper (was inline in handlePreJoin before).
  // Mic-muting stays a distinct call here (own log lines, own featureConfig
  // gate); camera-stop is delegated to stopVideoIfConfigured() below so it
  // can ALSO be called on its own, independently of mic-muting - see that
  // method's comment for why.
  //
  // FIX 8 (real-device diagnosis): the original mic-mute selectors
  // (data-track-action-scenario/aria-label*="Mute mic"/data-state) were
  // guesses that were never confirmed against the real Teams DOM, and were
  // queried only on `this.page` (the MAIN frame). A live screenshot showed
  // the mic toggle still ON at the lobby-wait screen despite this running -
  // and separately, selectAudioDevices()'s device dropdown (which DOES work,
  // confirmed live) already documents that Teams' pre-join controls can live
  // inside an IFRAME on some tenants (see _selectOneDevice's frame-scan).
  // Almost certainly the same iframe holds the mic/camera toggles, so a
  // main-frame-only query would silently find nothing. Both mic-mute and
  // camera-stop now go through the shared, frame-scanning, broadly-matching
  // `_toggleMediaControl()` helper below instead of a single guessed
  // selector list.
  async muteMicAndCamera() {
    const wantMic = featureConfig.media.muteMicOnJoin;

    if (wantMic) {
      try {
        const didClick = await this._toggleMediaControl('mic');
        if (!didClick) {
          logger.warn('TeamsAdapter(teamJoiner): Mic mute control not found (or already muted) in any frame.');
        }
      } catch (e) {
        logger.warn('TeamsAdapter(teamJoiner): mic mute failed: ' + e.message);
      }
    } else {
      logger.info('TeamsAdapter(teamJoiner): Mic muting disabled via featureConfig — skipping.');
    }

    await this.stopVideoIfConfigured();
  }

  // -----------------------------
  // VIDEO STOP (Teams-only, page-scoped) - SEPARATE, independently
  // toggleable step
  // -----------------------------
  //
  // Split out of muteMicAndCamera() into its own method so camera-stop can
  // be called on its own, not only wherever muteMicAndCamera() happens to
  // run. In particular this is called right alongside selectAudioDevices()
  // at EVERY point that method runs (pre-join, lobby-wait, and after
  // passcode recovery) so the camera state is kept in lockstep with the
  // audio-cable device selection, rather than only being re-checked at
  // whichever call sites muteMicAndCamera() was already wired into.
  //
  // Gated by featureConfig.teams.media.disableCameraOnJoin (see
  // services/featureConfig.js) - the SAME toggle muteMicAndCamera() already
  // used for this, not a new/duplicate config flag - so it can be turned
  // on/off independently of mic-muting at any time, same as every other
  // per-platform feature toggle in this codebase. Never throws: a failed
  // camera-stop attempt must not block the join.
  async stopVideoIfConfigured() {
    if (!featureConfig.media.disableCameraOnJoin) {
      logger.info('TeamsAdapter(teamJoiner): Camera-off disabled via featureConfig — skipping video stop.');
      return;
    }

    try {
      const didClick = await this._toggleMediaControl('camera');
      if (!didClick) {
        logger.warn('TeamsAdapter(teamJoiner): Camera-off control not found (or already off) in any frame.');
      }
    } catch (e) {
      logger.warn('TeamsAdapter(teamJoiner): stopVideoIfConfigured() failed: ' + e.message);
    }
  }

  // Shared by muteMicAndCamera() (mic) and stopVideoIfConfigured() (camera).
  // Scans EVERY frame (same reasoning as _selectOneDevice's frame-scan for
  // the device dropdowns) for any button/switch/checkbox whose accessible
  // name (aria-label, title, or visible text) mentions `keyword` ("mic" or
  // "camera"), then clicks the one that currently indicates it's ON.
  //
  // FIX 9 (from a REAL live-run log): the original aria-checked/aria-pressed
  // check never matched anything on this Teams build - a live log showed
  // every matching candidate with BOTH attributes null, e.g.
  // {"label":"Mute mic","ariaChecked":null,"ariaPressed":null} and
  // {"label":"Turn camera off","ariaChecked":null,"ariaPressed":null}. This
  // build simply doesn't expose aria-checked/aria-pressed on these controls.
  // BUT the label itself already encodes the state: a button labelled
  // "Mute mic" is the ACTION you'd take, which only makes sense while the
  // mic is currently live - if it were already muted, Teams renders
  // "Unmute mic" instead. Same for "Turn camera off" (camera currently on)
  // vs. "Turn camera on" (camera currently off). So `isOn` now checks BOTH
  // signals: the aria attributes (kept in case a different Teams build DOES
  // set them) OR this label-phrase heuristic, per keyword's `onPhrase`/
  // `offPhrase` pair below. The live log's candidate list also showed each
  // real BUTTON duplicated by a same-labelled hidden INPUT (Teams renders a
  // keyboard-shortcut-hint input alongside the real control) - clicks now
  // prefer a BUTTON-tag match over any other tag, to hit the real
  // interactive element rather than a decorative duplicate.
  //
  // Every matching candidate (clicked or not, on or off) is logged for
  // diagnostics so a repeat failure tells us the REAL label/attributes
  // Teams is using, instead of another guess. Never throws - the caller
  // wraps this in try/catch and treats "not found" as a warning, not a
  // blocking error.
  //
  // CONFIRMATION (not just "we clicked something"): after a click, this
  // waits for Teams to re-render, then re-scans the SAME frame and compares
  // how many matching controls now indicate ON vs. before the click. Only
  // when that ON-count actually dropped does it log a "confirmed OFF" /
  // "confirmed muted" line - so that log line means the DOM was checked
  // AGAIN afterward and really did change (the label really did flip from
  // "Mute mic" to "Unmute mic", say), not just that a click event was sent.
  // If the click didn't move the count, or the frame couldn't be re-checked
  // (e.g. it navigated away), a distinct warning/info line says so instead,
  // so the two cases are never confused in the logs.
  async _toggleMediaControl(keyword) {
    const frames = typeof this.page.frames === 'function' ? this.page.frames() : [this.page];
    const cfg = keyword === 'mic'
      ? { label: 'Mic', confirmedVerb: 'muted', stillOnVerb: 'still reports unmuted', onPhrase: 'mute mic', offPhrase: 'unmute mic' }
      : { label: 'Camera', confirmedVerb: 'turned OFF', stillOnVerb: 'still reports ON', onPhrase: 'turn camera off', offPhrase: 'turn camera on' };

    // Shared scan logic (also used, unmodified, for the post-click re-check)
    // so "before" and "after" are always computed the exact same way.
    const scanFn = (kw, onPhrase, offPhrase) => {
      const nodes = Array.from(
        document.querySelectorAll('button, [role="switch"], [role="checkbox"], [role="menuitemcheckbox"]')
      );
      const wanted = kw.toLowerCase();
      const candidates = [];
      let onCount = 0;

      for (const el of nodes) {
        const rawLabel = el.getAttribute('aria-label') || el.getAttribute('title') || (el.innerText || '').trim() || '';
        const text = (rawLabel + ' ' + (el.innerText || '')).toLowerCase();

        if (!text.includes(wanted)) continue;

        const ariaChecked = el.getAttribute('aria-checked');
        const ariaPressed = el.getAttribute('aria-pressed');
        const isOnByAria = ariaChecked === 'true' || ariaPressed === 'true';
        // Label-phrase heuristic (primary signal on builds that don't set
        // aria-checked/aria-pressed at all): the label names the ACTION
        // clicking would take, so e.g. "Mute mic" means currently unmuted.
        const isOnByLabel = text.includes(onPhrase) && !text.includes(offPhrase);
        const isOn = isOnByAria || isOnByLabel;
        if (isOn) onCount++;

        candidates.push({
          label: rawLabel.slice(0, 80),
          ariaChecked,
          ariaPressed,
          tag: el.tagName,
          isOn,
        });
      }

      return { candidates, onCount };
    };

    for (const frame of frames) {
      let result;
      try {
        result = await frame.evaluate((kw, onPhrase, offPhrase) => {
          const nodes = Array.from(
            document.querySelectorAll('button, [role="switch"], [role="checkbox"], [role="menuitemcheckbox"]')
          );
          const wanted = kw.toLowerCase();
          const candidates = [];
          let onCountBefore = 0;
          let toClick = null; // prefer a BUTTON-tag ON match over any other tag

          for (const el of nodes) {
            const rawLabel = el.getAttribute('aria-label') || el.getAttribute('title') || (el.innerText || '').trim() || '';
            const text = (rawLabel + ' ' + (el.innerText || '')).toLowerCase();

            if (!text.includes(wanted)) continue;

            const ariaChecked = el.getAttribute('aria-checked');
            const ariaPressed = el.getAttribute('aria-pressed');
            const isOnByAria = ariaChecked === 'true' || ariaPressed === 'true';
            const isOnByLabel = text.includes(onPhrase) && !text.includes(offPhrase);
            const isOn = isOnByAria || isOnByLabel;
            if (isOn) onCountBefore++;

            candidates.push({
              label: rawLabel.slice(0, 80),
              ariaChecked,
              ariaPressed,
              tag: el.tagName,
            });

            if (isOn && (!toClick || (toClick.tagName !== 'BUTTON' && el.tagName === 'BUTTON'))) {
              toClick = el;
            }
          }

          let clicked = false;
          if (toClick) {
            toClick.click();
            clicked = true;
          }

          return { clicked, candidates, onCountBefore };
        }, keyword, cfg.onPhrase, cfg.offPhrase);
      } catch (e) {
        continue; // detached/cross-origin frame - try the next one
      }

      if (!result.clicked) {
        if (result.candidates.length > 0) {
          logger.warn(
            `TeamsAdapter(teamJoiner): ${cfg.label} control(s) matched "${keyword}" but none indicated ON ` +
            `(checked aria-checked/aria-pressed AND the "${cfg.onPhrase}" label phrase) - candidates: ${JSON.stringify(result.candidates)}`
          );
        }
        continue; // nothing to click in this frame - try the next one
      }

      // Something was clicked. Give Teams a moment to re-render, then
      // re-scan this SAME frame to confirm the ON-count actually dropped -
      // that's the real confirmation, not just that a click event fired.
      await new Promise((r) => setTimeout(r, 400));

      let after;
      try {
        after = await frame.evaluate(scanFn, keyword, cfg.onPhrase, cfg.offPhrase);
      } catch (e) {
        after = null; // frame navigated away or detached - can't re-verify
      }

      if (after === null) {
        logger.info(
          `TeamsAdapter(teamJoiner): ${cfg.label} control clicked (${result.onCountBefore} on-candidate(s) before), ` +
          `but the frame couldn't be re-checked afterward to confirm - candidates were: ${JSON.stringify(result.candidates)}`
        );
      } else if (after.onCount < result.onCountBefore) {
        logger.info(
          `TeamsAdapter(teamJoiner): ${cfg.label} confirmed ${cfg.confirmedVerb} - re-checked the DOM after clicking, ` +
          `ON-count went ${result.onCountBefore} -> ${after.onCount}.`
        );
      } else {
        logger.warn(
          `TeamsAdapter(teamJoiner): ${cfg.label} control was clicked but ${cfg.stillOnVerb} afterward ` +
          `(before=${result.onCountBefore}, after=${after.onCount}) - the click may have hit the wrong element. ` +
          `Candidates: ${JSON.stringify(after.candidates)}`
        );
      }

      return true;
    }

    return false;
  }

  // -----------------------------
  // STAGE 3c: PRE-JOIN AUDIO DEVICE SELECTION (Teams-only, page-scoped)
  // -----------------------------
  //
  // Picks Teams' Speaker/Microphone dropdowns to the VB-Audio Virtual Cable
  // pair named by TEAMS_SPEAKER_DEVICE_NAME / TEAMS_MIC_DEVICE_NAME above.
  // Teams' pre-join screen (Fluent UI) renders these as dropdown
  // ("combobox") buttons. This is best-effort and NEVER throws out of
  // joinMeeting() — a failed device selection must not block the join, it
  // just means the bot stays on whatever device Teams defaulted to.
  async selectAudioDevices() {
    const targets = [
      { kind: 'Speaker', match: TEAMS_SPEAKER_DEVICE_NAME },
      { kind: 'Microphone', match: TEAMS_MIC_DEVICE_NAME },
    ];

    for (const target of targets) {
      if (!target.match) continue; // '' in .env means "skip, leave default"

      try {
        const result = await this._selectOneDevice(target.kind, target.match);
        if (result.selected) {
          logger.info(
            `TeamsAdapter(teamJoiner): ${target.kind} device set to "${result.optionText}" (matched "${target.match}").`
          );
        } else {
          logger.warn(
            `TeamsAdapter(teamJoiner): Could not select ${target.kind} device matching "${target.match}" ` +
              `(${result.reason}). Leaving Teams' default ${target.kind.toLowerCase()} in place.`
          );
        }
      } catch (e) {
        logger.warn(`TeamsAdapter(teamJoiner): ${target.kind} device selection failed: ${e.message}`);
      }
    }
  }

  // Finds the Fluent-UI dropdown control for `kind` ("Speaker"/"Microphone"),
  // opens it, and clicks the option whose visible text contains `matchText`
  // (case-insensitive substring — robust to Windows suffixes like
  // " - Default Device"). Tries every frame on the page since Teams' pre-
  // join UI is inside an iframe on some tenants (mirrors the frame-scanning
  // already used by readPasscodeScreen()/findPasscodeField() above).
  async _selectOneDevice(kind, matchText) {
    const frames = this.page.frames();

    for (const frame of frames) {
      try {
        const opened = await frame
          .evaluate((kindLabel) => {
            const norm = (s) => (s || '').trim().toLowerCase();
            const wanted = norm(kindLabel); // "speaker" | "microphone"

            // Fluent UI renders the trigger as a button (role="combobox" on
            // newer builds, plain button on older ones) whose accessible
            // name mentions the device kind, e.g. aria-label="Speaker,
            // Headset Earphone (Sennheiser SC60 for Lync)".
            const candidates = Array.from(
              document.querySelectorAll('button[role="combobox"], button')
            );

            const trigger = candidates.find((el) => {
              const label = norm(el.getAttribute('aria-label') || el.innerText || '');
              return label.includes(wanted);
            });

            if (!trigger) return false;
            trigger.click();
            return true;
          }, kind)
          .catch(() => false);

        if (!opened) continue;

        // Give the dropdown listbox a moment to render.
        await new Promise((r) => setTimeout(r, 400));

        const clicked = await frame
          .evaluate((wantedText) => {
            const norm = (s) => (s || '').trim().toLowerCase();
            const wanted = norm(wantedText);

            const options = Array.from(
              document.querySelectorAll(
                '[role="option"], [role="listbox"] li, [role="listbox"] button'
              )
            );

            const option = options.find((el) =>
              norm(el.innerText || el.textContent).includes(wanted)
            );

            if (!option) {
              return {
                clicked: false,
                optionText: null,
                seen: options
                  .map((o) => (o.innerText || o.textContent || '').trim())
                  .filter(Boolean)
                  .slice(0, 20),
              };
            }

            option.click();
            return { clicked: true, optionText: (option.innerText || option.textContent || '').trim() };
          }, matchText)
          .catch(() => ({ clicked: false, optionText: null, seen: [] }));

        if (clicked.clicked) {
          await this.page.keyboard.press('Escape').catch(() => {});
          return { selected: true, optionText: clicked.optionText };
        }

        // Trigger opened but the target device isn't among the options
        // (e.g. VB-CABLE not installed on this machine) — close the
        // dropdown and report what WAS available for diagnostics.
        await this.page.keyboard.press('Escape').catch(() => {});
        return {
          selected: false,
          reason:
            clicked.seen && clicked.seen.length
              ? `device not found among options: [${clicked.seen.join(', ')}]`
              : 'dropdown opened but no options were found',
        };
      } catch (e) {
        // Try the next frame.
      }
    }

    return { selected: false, reason: `no "${kind}" dropdown control found in any frame` };
  }

  // -----------------------------
  // STAGE 4: DISMISS AUDIO/VIDEO POPUP
  // -----------------------------
  async dismissAudioVideoPopup() {
    logger.info('TeamsAdapter(teamJoiner): Checking for "Continue without audio or video" popup...');

    for (let i = 0; i < 20; i++) {
      try {
        const dismissed = await this.page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b =>
            /continue without audio or video/i.test(b.innerText || '')
          );
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        });

        if (dismissed) {
          logger.info('TeamsAdapter(teamJoiner): Dismissed audio/video popup successfully');
          await new Promise(r => setTimeout(r, 1500));
          return;
        }
      } catch (e) {}

      await new Promise(r => setTimeout(r, 500));
    }

    logger.info('TeamsAdapter(teamJoiner): No audio/video popup found — continuing');
  }

  // -----------------------------
  // STAGE 5: ENTER NAME + JOIN
  // -----------------------------
  async enterLobby() {
    logger.info('TeamsAdapter(teamJoiner): Attempting to join Teams meeting...');

    try {
      const nameInputSelector = 'input[data-tid="prejoin-display-name-input"]';

      logger.info('TeamsAdapter(teamJoiner): Waiting for name input field...', nameInputSelector);
      await this.page.waitForSelector(nameInputSelector, { timeout: 15000 });

      await new Promise(r => setTimeout(r, 1000));

      await this.page.click(nameInputSelector, { clickCount: 3 });
      await this.page.keyboard.press('Backspace');

      await this.page.waitForFunction(
        (sel) => document.querySelector(sel)?.value === '',
        {},
        nameInputSelector
      );

      await this.page.type(nameInputSelector, this.botName, { delay: 60 });

      const finalValue = await this.page.$eval(nameInputSelector, el => el.value);
      if (finalValue !== this.botName) {
        logger.info(`Name mismatch ("${finalValue}"), retrying with fill...`);
        await this.page.$eval(nameInputSelector, (el, name) => {
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.value = name;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }, this.botName);
      }

      await new Promise(r => setTimeout(r, 1000));
      logger.info(`TeamsAdapter(teamJoiner): Set bot name to: ${this.botName}`);

      logger.info('TeamsAdapter(teamJoiner): Waiting for Join Now button to become enabled...');
      await this.page.evaluate(async () => {
        const delay = ms => new Promise(r => setTimeout(r, ms));

        for (let i = 0; i < 20; i++) {
          const btnTid = document.querySelector('button[data-tid="prejoin-join-button"]');
          if (btnTid && !btnTid.disabled) {
            btnTid.click();
            return;
          }

          const btnText = Array.from(document.querySelectorAll('button')).find(
            b => /join now/i.test(b.innerText || '') && !b.disabled
          );
          if (btnText) {
            btnText.click();
            return;
          }

          await delay(1500);
        }

        throw new Error('Join button not found or remained disabled after 10s');
      });

      logger.info('TeamsAdapter(teamJoiner): Clicked Join Now');
    } catch (e) {
      logger.error('TeamsAdapter(teamJoiner): Failed to join lobby: ' + e.message);
    }
  }

  // -----------------------------
  // PASSCODE MODAL HANDLER
  // -----------------------------
  async handlePasscodeModal() {
    // 1) Detect the "can't find meeting / enter passcode" screen (searches all frames).
    const state = await this.readPasscodeScreen();

    if (!state.isPasscodeScreen) {
      return false;
    }

    logger.info(
      `TeamsAdapter(teamJoiner): Passcode screen detected. Displayed: "${state.text}"`
    );

    // 2) Resolve passcode value (config first, then URL params).
    let pass = this.passcode;
    if (!pass) {
      try {
        const cleanUrl = this.meetingUrl.replace(/[>\]"']+$/, '');
        const urlObj = new URL(cleanUrl);
        pass =
          urlObj.searchParams.get('p') ||
          urlObj.searchParams.get('passcode') ||
          urlObj.searchParams.get('pwd');
      } catch (e) {}
    }

    // 3) Locate the passcode field: selectors first, then Tab discovery.
    const field = await this.findPasscodeField();

    if (!field.found) {
      logger.warn(
        'TeamsAdapter(teamJoiner): Could not locate the passcode input even after Tab navigation. ' +
          (pass
            ? 'A passcode is available but NO field was found — aborting recovery (unexpected field/selector).'
            : 'No passcode is configured (this.passcode / URL ?p=?passcode=?pwd=). The user MUST provide the meeting passcode.')
      );
      return false;
    }

    logger.info(
      `TeamsAdapter(teamJoiner): Passcode input located via ${field.method} ` +
        `(tag=${field.tag}, type=${field.type}, id=${field.id}, name=${field.name}, placeholder=${field.placeholder}, data-tid=${field.dataTid}, frame=${field.frameName}).`
    );

    // 4) If we have a passcode, type it and submit.
    if (pass) {
      const typed = await this.typeIntoPasscode(field, pass);
      if (!typed) {
        logger.warn('TeamsAdapter(teamJoiner): Passcode field located but typing failed.');
        return false;
      }
      logger.info('TeamsAdapter(teamJoiner): Passcode typed. Submitting...');

      await field.frame.evaluate(() => {
        const submitBtn = Array.from(document.querySelectorAll('button')).find(b =>
          /rejoin|join|check|continue/i.test(b.innerText || '')
        );
        if (submitBtn) submitBtn.click();
      });
      // Enter as a fallback submit in case no visible button matched.
      await this.page.keyboard.press('Enter').catch(() => {});
      await new Promise(r => setTimeout(r, 2500));
      return true;
    }

    // No passcode available — surface what is on screen so the operator can act.
    logger.warn(
      `TeamsAdapter(teamJoiner): Passcode is REQUIRED but was not provided. Currently displayed: "${state.text}"`
    );
    return false;
  }

  // -----------------------------
  // READ THE PASSCODE ERROR SCREEN (across all frames)
  // -----------------------------
  async readPasscodeScreen() {
    const frames = this.page.frames();
    let text = '';
    let isPasscodeScreen = false;

    for (const frame of frames) {
      const res = await frame
        .evaluate(() => {
          const t = document.body ? document.body.innerText || '' : '';
          const low = t.toLowerCase();
          const hit =
            /we can'?t find this meeting/i.test(low) ||
            /we couldn'?t find a meeting/i.test(low) ||
            /meeting might have ended/i.test(low) ||
            /type (a )?meeting passcode/i.test(low) ||
            /enter (a )?meeting passcode/i.test(low) ||
            /meeting passcode/i.test(low) ||
            /rejoin call/i.test(low) ||
            !!document.querySelector(
              'input[data-tid*="passcode"], input[data-tid*="otp"]'
            );
          return { t: t.trim().slice(0, 400), hit };
        })
        .catch(() => ({ t: '', hit: false }));
      if (res.hit) isPasscodeScreen = true;
      if (res.t) text += (text ? ' | ' : '') + res.t;
    }

    return { isPasscodeScreen, text };
  }
// -----------------------------
  // FIND THE PASSCODE INPUT — selectors first, then Tab+Enter discovery (all frames)
  // -----------------------------
  async findPasscodeField() {
    const frames = this.page.frames();
    const selectors = [
      'input[data-tid="meeting-passcode-input"]',
      'input[data-tid*="passcode"]',
      'input[data-tid*="otp"]',
      'input[type="password"]',
      'input[inputmode="numeric"]',
      'input[autocomplete="one-time-code"]',
      'input[name*="passcode"]',
      'input[placeholder*="passcode" i]',
      'input[placeholder*="OTP" i]',
      'input[aria-label*="passcode" i]',
      'input[aria-label*="password" i]'
    ];

    // A) Selectors across ALL frames.
    for (const frame of frames) {
      const info = await frame
        .evaluate((sels) => {
          for (const s of sels) {
            const el = document.querySelector(s);
            if (el) {
              return {
                found: true,
                tag: el.tagName,
                type: el.type,
                id: el.id,
                name: el.name,
                placeholder: el.placeholder,
                dataTid: el.getAttribute('data-tid')
              };
            }
          }
          return { found: false };
        }, selectors)
        .catch(() => ({ found: false }));

      if (info.found) {
        return {
          ...info,
          method: 'selector',
          frame,
          frameName: frame === this.page.mainFrame() ? 'main' : frame.name() || 'child'
        };
      }
    }

    // B) Real keyboard Tab navigation — logging each focused element until we
    //    land on an editable (input/textarea) field.
    logger.info(
      'TeamsAdapter(teamJoiner): No passcode field by selector — using Tab navigation to discover it.'
    );
    const tabFrames = [this.page.mainFrame(), ...this.page.frames()];

    for (let i = 0; i < 14; i++) {
      await this.page.keyboard.press('Tab').catch(() => {});
      await new Promise(r => setTimeout(r, 180));

      for (const frame of tabFrames) {
        const info = await frame
          .evaluate(() => {
            const ae = document.activeElement;
            if (!ae || (ae.tagName !== 'INPUT' && ae.tagName !== 'TEXTAREA')) return null;
            return {
              found: true,
              tag: ae.tagName,
              type: ae.type,
              id: ae.id,
              name: ae.name,
              placeholder: ae.placeholder,
              dataTid: ae.getAttribute('data-tid')
            };
          })
          .catch(() => null);

        if (info && info.found) {
          const fname = frame === this.page.mainFrame() ? 'main' : frame.name() || 'child';
          logger.info(
            `TeamsAdapter(teamJoiner): TAB ${i + 1} frame=${fname} → focused ${info.tag} ` +
              `type=${info.type} id=${info.id} name=${info.name} data-tid=${info.dataTid} placeholder=${info.placeholder}`
          );
          return { ...info, method: 'tab-navigation', frame, frameName: fname };
        }
      }
    }

    return { found: false };
  }

  // -----------------------------
  // TYPE THE PASSCODE INTO THE LOCATED FIELD
  // -----------------------------
  async typeIntoPasscode(field, pass) {
    return field.frame.evaluate((code) => {
      const candidates = [
        'input[data-tid*="passcode"]',
        'input[data-tid*="otp"]',
        'input[type="password"]',
        'input[inputmode="numeric"]',
        'input[name*="passcode"]',
        'input[placeholder*="passcode" i]',
        'input[placeholder*="OTP" i]'
      ];
      let input = null;
      for (const c of candidates) {
        const e = document.querySelector(c);
        if (e) { input = e; break; }
      }
      if (!input && document.activeElement && document.activeElement.tagName === 'INPUT') {
        input = document.activeElement;
      }
      if (!input) return false;

      input.focus();
      const proto = window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      if (setter) setter.call(input, '');
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // Best-effort real-typing simulation; React reliably recognizes execCommand.
      try {
        document.execCommand('insertText', false, code);
      } catch (e) {
        if (setter) setter.call(input, code);
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, pass);
  }

  // -----------------------------
  // STAGE 6: LOBBY WAIT
  // -----------------------------
  async waitForJoinConfirmation() {
    logger.info('TeamsAdapter(teamJoiner): Bot is in the lobby. Waiting for host to admit...');

    // Re-apply the CABLE Input/Output device selection here too. This
    // "Someone will let you in when the meeting starts" lobby screen shows
    // the same Speaker/Microphone dropdown widget as the pre-join screen
    // (selectAudioDevices() was already called once in handlePreJoin()) —
    // belt-and-suspenders in case that first pass ran before the widget had
    // fully settled, or the lobby view re-renders it fresh. Same
    // never-throws, best-effort behavior as the pre-join call.
    await this.selectAudioDevices();

    // Also re-check mic + camera here, right alongside the device-selection
    // re-apply above — a live screenshot of this exact "Someone will let you
    // in shortly" lobby screen showed BOTH the mic and camera toggles still
    // ON despite handlePreJoin() having already run muteMicAndCamera() once:
    // this lobby view renders its own copy of the pre-join controls
    // (independently of the earlier pre-join screen's), so a mute/camera-off
    // applied earlier doesn't necessarily carry over. Calling the combined
    // muteMicAndCamera() here (which internally still calls
    // stopVideoIfConfigured() as its own separate, independently-toggleable
    // step — see that method's comment above) keeps both controls in
    // lockstep at every point selectAudioDevices() re-applies, rather than
    // only re-checking the camera.
    await this.muteMicAndCamera();

    // Total lobby/waiting-room window comes from .env (BOT_HOST_WAIT_TIMEOUT_MS)
    // via config/settings.js — a single shared value for all platforms.
    // Poll cadence stays at 3 s (see sleep below).
    const MAX_LOBBY_ATTEMPTS = Math.max(1, Math.ceil(settings.bot.hostWaitTimeoutMs / 3000));

    for (let i = 0; i < MAX_LOBBY_ATTEMPTS; i++) {
      const sessionState = await this.page.evaluate(() => {
        const text = document.body.innerText;

        const admittedSelectors = [
          '[aria-label="Mute mic"]',
          '[aria-label="Mute Mic"]',
          '[aria-label="No available camera found"]',
          '[aria-label="People"]',
          '[aria-label="Chat"]',
          '[aria-label="Raise"]',
          '[aria-label="Share"]',
          '[data-tid="toolbar-item-badge"]',
        ];

        const isAdmitted = admittedSelectors.some(sel => {
          try { return !!document.querySelector(sel); } catch { return false; }
        });

        const isStillInLobby =
          text.includes('Someone will let you in shortly') ||
          text.includes('Someone will let you in shortly.') ||
          text.toLowerCase().includes('someone will let you in shortly') ||
          text.includes('waiting in the lobby') ||
          text.includes("You're in the lobby") ||
          text.includes('waiting to be admitted');

        const needsPasscode =
          text.includes("We couldn't find a meeting") ||
          text.includes("We can't find this meeting") ||
          text.includes("Type a meeting passcode") ||
          text.includes('meeting might have ended') ||
          /type a meeting passcode/i.test(text) ||
          /can'?t find this meeting/i.test(text) ||
          /meeting passcode/i.test(text);

        const isDenied =
          text.toLowerCase().includes('you were removed from this meeting') ||
          text.toLowerCase().includes('you were removed') ||
          text.toLowerCase().includes('your request to join was declined') ||
          text.toLowerCase().includes('your request to join the meeting') ||
          text.toLowerCase().includes('you cannot join this meeting');

        return {
          isAdmitted,
          isStillInLobby,
          needsPasscode,
          isDenied,
          pageTextSample: text.trim().slice(0, 300),
        };
      });
      
      if (sessionState.isAdmitted) {
        logger.info('TeamsAdapter(teamJoiner): SUCCESS: Host admitted the bot to the meeting');
        await new Promise(r => setTimeout(r, 2000));
        return true;
      }

      if (sessionState.isDenied) {
        logger.warn('TeamsAdapter(teamJoiner): Host rejected/removed the bot — aborting join');
        throw new HostDeniedError('Teams host rejected the bot');
      }


      // Also check across ALL frames - the light experience may render the

      // "can't find meeting / passcode" prompt inside an iframe that the

      // top-frame text check above would miss.

      const passcodeState = await this.readPasscodeScreen();



      if (sessionState.needsPasscode || passcodeState.isPasscodeScreen) {
        logger.info('TeamsAdapter(teamJoiner): Passcode modal popped up while waiting!');
        const recovered = await this.handlePasscodeModal();
        if (recovered) {
          await new Promise(r => setTimeout(r, 2000));

          logger.info('TeamsAdapter(teamJoiner): Re-clicked Join Now after passcode recovery');
          await this.dismissAudioVideoPopup();

          // Re-apply device selection too — the passcode-recovery flow
          // re-renders the pre-join screen, which can reset the
          // Speaker/Microphone dropdowns back to their OS defaults.
          await this.selectAudioDevices();

          // FIX 7: re-mute mic/cam after passcode recovery — previously this
          // step was skipped, risking an unmuted rejoin if the modal
          // interrupted before the original mute had settled.
          await this.muteMicAndCamera();

          await this.clickJoinNowButton();
          continue;
        }
      }

      if (i % 10 === 0) {
        logger.info('TeamsAdapter(teamJoiner): ...still waiting in lobby for host admission...');
      }

      await new Promise(r => setTimeout(r, 3000));
    }

    logger.warn('TeamsAdapter(teamJoiner): Admission timeout: Bot was never let into the meeting');
    throw new WaitingRoomTimeoutError('Teams waiting-room timeout: host never admitted the bot');
  }

  async clickJoinNowButton() {
    await this.page.evaluate(async () => {
      const delay = ms => new Promise(r => setTimeout(r, ms));

      for (let i = 0; i < 20; i++) {
        const btnTid = document.querySelector('button[data-tid="prejoin-join-button"]');

        if (btnTid && !btnTid.disabled) {
          btnTid.click();
          return;
        }

        const btnText = Array.from(document.querySelectorAll('button')).find(
          b => /join now/i.test(b.innerText || '') && !b.disabled
        );

        if (btnText) {
          btnText.click();
          return;
        }

        await delay(500);
      }

      throw new Error('Join button not found');
    });
  }

  // -----------------------------
  // POST-JOIN SETUP
  // FIX 1: startTranscriptMonitor() no longer runs its own caption-polling
  // setInterval. captionMonitor.js (TeamsCaptionMonitor, instantiated in
  // socraticbot.js) is now the SINGLE source of truth for caption capture
  // and persistence. This method now only does post-join housekeeping:
  // mute mic, enable captions in the UI so captionMonitor can read them.
  // -----------------------------
  async startTranscriptMonitor() {
    logger.info('TeamsAdapter(teamJoiner): Admitted! Running post-join setup (mute + enable captions)...');

    await this.muteMicAfterJoin();
    await this.enableCaptionsIfPossible();

    // NOTE: caption polling itself is handled entirely by
    // TeamsCaptionMonitor (captionMonitor.js), started separately in
    // socraticbot.js via this.captionMonitor.startPolling(). Do not add
    // a second polling loop here.
  }

  async muteMicAfterJoin() {
    await new Promise(r => setTimeout(r, 2000));

    await this.page.evaluate(() => {
      const mic =
        document.querySelector('button[data-track-action-scenario="callMuteAudio"]') ||
        document.querySelector('button[data-state="mic-volume-renderer"]') ||
        document.querySelector('button[data-inp="microphone-button"][aria-label="Mute mic"]') ||
        document.querySelector('button[id="microphone-button"][aria-label="Mute mic"]') ||
        Array.from(document.querySelectorAll('button')).find(b =>
          b.getAttribute('aria-label') === 'Mute mic'
        );

      if (mic) mic.click();
    });

    await new Promise(r => setTimeout(r, 1000));

    const isMuted = await this.page.evaluate(() => {
      const mic =
        document.querySelector('button[data-track-action-scenario="callUnmuteAudio"]') ||
        document.querySelector('button[data-state="mic-off"]') ||
        document.querySelector('button[aria-label="Unmute mic"]');
      return !!mic;
    });

    if (isMuted) {
      logger.info('TeamsAdapter(teamJoiner): Mic confirmed muted after joining.');
    } else {
      logger.warn('TeamsAdapter(teamJoiner): Could not confirm mic muted after joining.');
    }
  }

  // FIX 1: stopTranscriptMonitor() no longer needs to clear an interval
  // here since this class doesn't own a polling loop anymore. Kept as a
  // no-op passthrough for API compatibility with socraticbot.js's
  // `joiner.stopTranscriptMonitor()` call in stop().
  async stopTranscriptMonitor() {
    logger.info('TeamsAdapter(teamJoiner): Post-join monitor cleanup (no-op; caption polling owned by CaptionMonitor)');
  }

  // FIX: this used to be a single, unverified open-menu-and-click attempt —
  // it returned as soon as it *tried* to click the captions button, with no
  // confirmation captions were ever actually turned on (unlike zoom's
  // zoomJoiner.js, which retries and calls verifyCaptionsProducingOutput()
  // before declaring success). Now retries the enable sequence and confirms
  // real caption rows are appearing before giving up, mirroring that pattern.
  async enableCaptionsIfPossible(maxRetries = 6) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logger.info(`TeamsAdapter(teamJoiner): === Caption activation attempt ${attempt}/${maxRetries} ===`);

      try {
        // Close any stray open menu from a previous failed attempt before
        // retrying, so we always start from a known "nothing open" state.
        await this.page.keyboard.press('Escape').catch(() => {});
        await new Promise(r => setTimeout(r, 300));

        await this.page.evaluate(() => {
          const moreBtn = document.querySelector('[aria-label*="More"], [aria-label*="more"]');
          if (moreBtn) moreBtn.click();
        });

        await new Promise(r => setTimeout(r, 1500));

        const clicked = await this.page.evaluate(() => {
          const captionBtn = Array.from(
            document.querySelectorAll('button, span, div[role="menuitem"]')
          ).find(el => /captions|live captions|transcript/i.test(el.innerText));
          if (captionBtn) {
            captionBtn.click();
            return true;
          }
          return false;
        });

        if (!clicked) {
          logger.warn(`TeamsAdapter(teamJoiner): Attempt ${attempt}: captions button not found — retrying...`);
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }

        const confirmed = await this.verifyCaptionsProducingOutput();
        if (confirmed) {
          logger.info(`TeamsAdapter(teamJoiner): SUCCESS on attempt ${attempt}: captions confirmed active.`);
          return true;
        }

        logger.warn(`TeamsAdapter(teamJoiner): Attempt ${attempt}: captions toggled but no output confirmed — retrying...`);
      } catch (e) {
        logger.warn(`TeamsAdapter(teamJoiner): Attempt ${attempt} failed: ${e.message}`);
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    logger.error(`TeamsAdapter(teamJoiner): FAILED to confirm captions after ${maxRetries} attempts — continuing without confirmed live captions.`);
    return false;
  }

  // ─────────────────────────────────────────────
  // VERIFY CAPTIONS ARE PRODUCING OUTPUT
  // ─────────────────────────────────────────────
  //
  // Mirrors zoom/zoomJoiner.js's verifyCaptionsProducingOutput(): confirms
  // captions actually produced output, not just that a button was clicked.
  // Polls for the same caption-row selector teams/captionMonitor.js's
  // getTeamsTranscript() reads from ('.fui-ChatMessageCompact'), plus the
  // toolbar's own pressed/label state as a fallback signal.
  async verifyCaptionsProducingOutput(timeoutMs = 10000, intervalMs = 1000) {
    const attempts = Math.ceil(timeoutMs / intervalMs);

    for (let i = 0; i < attempts; i++) {
      const active = await this.page.evaluate(() => {
        const hasRows = document.querySelectorAll('.fui-ChatMessageCompact').length > 0;
        const captionsToggled = !!document.querySelector(
          '[aria-label*="Turn off live captions" i], [aria-label*="Hide captions" i], [aria-pressed="true"][aria-label*="caption" i]'
        );
        return hasRows || captionsToggled;
      }).catch(() => false);

      if (active) return true;
      await new Promise(r => setTimeout(r, intervalMs));
    }

    return false;
  }
}

module.exports = TeamsJoiner;