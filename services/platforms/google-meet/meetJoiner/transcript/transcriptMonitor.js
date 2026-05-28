/**
 * root/services/platforms/google-meet/meetJoiner/transcript/transcriptMonitor.js
 */
const { logger } = require('../../../../../utils/logger');
const { extractCaptions } = require('./captionExtractor');
const { isValid } = require('./captionValidator');
const { processCaptionLines } = require('./captionProcessor');
const { exportTranscriptBuffer } = require('./transcriptStorage');

async function startTranscriptMonitor(ctx) {
  logger.info('GoogleMeetJoiner(transcriptMonitor): ENTER startTranscriptMonitor');
  const { page } = ctx;

  if (!ctx.transcriptBuffer) ctx.transcriptBuffer = [];
  if (!ctx.seenRows) ctx.seenRows = new Set();
  if (ctx.captionInterval) clearInterval(ctx.captionInterval);

  let lastCaptionLine = "";
  let lastSpeakerName = "";

  ctx.captionInterval = setInterval(async () => {
    if (ctx.isStopping || !page || page?.isClosed?.()) {
      clearInterval(ctx.captionInterval);
      ctx.captionInterval = null;
      return;
    }

    try {
      // Fix 1: Pass knownParticipants to extractor
      const knownParticipants = ctx?.participantTracker?.trackedParticipants ?? new Set();
      const captions = await extractCaptions(page, knownParticipants);

      if (!captions?.length) return;

      const validCaptions = captions.filter(c => {
        const valid = isValid(c.text);
        if (!valid) {
          logger.debug(`GoogleMeetJoiner(transcriptMonitor): INVALID CAPTION DROPPED | text=${c.text}`);
        } else {
          logger.info(`GoogleMeetJoiner(transcriptMonitor): VALID CAPTION | text=${c.text}`);
        }
        return valid;
      });

      if (!validCaptions.length) return;

      const state = await processCaptionLines(
        ctx,
        validCaptions,
        lastCaptionLine,
        lastSpeakerName
      );

      if (state) {
        lastCaptionLine = state.lastCaptionLine;
        lastSpeakerName = state.lastSpeakerName;
      } else {
        logger.info('GoogleMeetJoiner(transcriptMonitor): NO STATE RETURNED FROM processCaptionLines');
      }

      // Fix 2: Reset retry flag on SUCCESSFUL cycle
      ctx._monitorRetry = false;

    } catch (err) {
      logger.error('GoogleMeetJoiner(transcriptMonitor): ERROR in caption interval:', err);
      const message = err?.message || '';
      const fatal =
        /target closed|context was destroyed|page closed|execution context|detached Frame|Detached Frame|frame detached/i;

      if (!ctx._monitorRetry) {
        logger.warn('GoogleMeetJoiner(transcriptMonitor): transient error detected, will retry once');
        ctx._monitorRetry = true;
        return;
      }

      if (ctx.isStopping || page?.isClosed?.() || fatal.test(message)) {
        logger.error('GoogleMeetJoiner(transcriptMonitor): FATAL ERROR DETECTED -> STOPPING MONITOR');
        try {
          await exportTranscriptBuffer(ctx);
        } catch (e) {
          logger.error('GoogleMeetJoiner(transcriptMonitor): Failed to export transcript buffer on fatal stop', e);
        }
        ctx.isStopping = true;
        clearInterval(ctx.captionInterval);
        ctx.captionInterval = null;
        return;
      }

      ctx._monitorRetry = false;
    }

  }, 1500); // Fix 3: 1500ms instead of 5000ms — catches captions before they merge
}

async function stopTranscriptMonitor(ctx) {
  if (!ctx) {
    logger.warn('GoogleMeetJoiner(transcriptMonitor): stopTranscriptMonitor called without ctx');
    return;
  }
  ctx.isStopping = true;
  try {
    await exportTranscriptBuffer(ctx);
  } catch (err) {
    logger.error('GoogleMeetJoiner(transcriptMonitor): Error exporting transcript buffer during stop', err);
  }
  if (ctx.captionInterval) {
    clearInterval(ctx.captionInterval);
    ctx.captionInterval = null;
  } else {
    logger.info('GoogleMeetJoiner(transcriptMonitor): NO INTERVAL FOUND');
  }
}

function getTranscript(ctx) {
  return ctx.transcriptBuffer || [];
}

module.exports = {
  startTranscriptMonitor,
  stopTranscriptMonitor,
  getTranscript
};