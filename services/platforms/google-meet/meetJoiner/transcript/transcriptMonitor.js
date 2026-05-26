const { logger } = require('../../../../../utils/logger');
const { extractCaptions } = require('./captionExtractor');
const { isValid } = require('./captionValidator');
const { processCaptionLines } = require('./captionProcessor');

async function startTranscriptMonitor(ctx) {
  logger.info('GoogleMeetJoiner(transcriptMonitor): ENTER startTranscriptMonitor');

  const { page } = ctx;

  if (!ctx.transcriptBuffer) {
    ctx.transcriptBuffer = [];
  }

  if (!ctx.seenRows) {
    ctx.seenRows = new Set();
  }

  if (ctx.captionInterval) {
    clearInterval(ctx.captionInterval);
  }

  let lastCaptionLine = "";
  let lastSpeakerName = "";

  ctx.captionInterval = setInterval(async () => {

    if (ctx.isStopping || !page || page?.isClosed?.()) {

      clearInterval(ctx.captionInterval);
      ctx.captionInterval = null;

      return;
    }

    try {
      const captions = await extractCaptions(page);

      if (!captions?.length) {
        return;
      }

      const validCaptions = captions.filter(c => {
        const valid = isValid(c.text);

        if (!valid) {
          logger.debug(`GoogleMeetJoiner(transcriptMonitor): INVALID CAPTION DROPPED | text=${c.text}`);
        } else {
          logger.info(`GoogleMeetJoiner(transcriptMonitor): VALID CAPTION | text=${c.text}`);
        }

        return valid;
      });

      if (!validCaptions.length) {
        return;
      }

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

    } catch (err) {

      const message = err?.message || '';

      const fatal =
        /target closed|context was destroyed|page closed|execution context|detached Frame|Detached Frame|frame detached/i;

      if (ctx.isStopping || page?.isClosed?.() || fatal.test(message)) {
        logger.error('GoogleMeetJoiner(transcriptMonitor): FATAL ERROR DETECTED -> STOPPING MONITOR');

        ctx.isStopping = true;
        clearInterval(ctx.captionInterval);
        ctx.captionInterval = null;
        return;
      }

    }
  }, 5000);

}

function stopTranscriptMonitor(ctx) {

  ctx.isStopping = true;

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