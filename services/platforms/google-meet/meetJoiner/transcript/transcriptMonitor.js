const { logger } = require('../../../../../utils/logger');
const { extractCaptions } = require('./captionExtractor');
const { isValid } = require('./captionValidator');
const { processCaptionLines } = require('./captionProcessor');

async function startTranscriptMonitor(ctx) {
  logger.info('GoogleMeetJoiner(transcriptMonitor): ENTER startTranscriptMonitor');

  const { page } = ctx;
  logger.info(`GoogleMeetJoiner(transcriptMonitor): CTX PAGE | exists=${!!page}`);

  if (!ctx.transcriptBuffer) {
    ctx.transcriptBuffer = [];
    logger.info('GoogleMeetJoiner(transcriptMonitor): INIT transcriptBuffer');
  }

  if (!ctx.seenRows) {
    ctx.seenRows = new Set();
    logger.info('GoogleMeetJoiner(transcriptMonitor): INIT seenRows');
  }

  if (ctx.captionInterval) {
    clearInterval(ctx.captionInterval);
    logger.info('GoogleMeetJoiner(transcriptMonitor): CLEARED existing captionInterval');
  }

  let lastCaptionLine = "";
  let lastSpeakerName = "";
  logger.info('GoogleMeetJoiner(transcriptMonitor): STATE INIT | lastCaptionLine/lastSpeakerName reset');

  ctx.captionInterval = setInterval(async () => {
    logger.info('GoogleMeetJoiner(transcriptMonitor): INTERVAL TICK');

    if (ctx.isStopping || !page || page?.isClosed?.()) {
      logger.info(
        `GoogleMeetJoiner(transcriptMonitor): STOP CONDITION MET | isStopping=${ctx.isStopping}, pageExists=${!!page}, pageClosed=${page?.isClosed?.()}`
      );

      clearInterval(ctx.captionInterval);
      ctx.captionInterval = null;

      logger.info('GoogleMeetJoiner(transcriptMonitor): INTERVAL CLEARED');
      return;
    }

    try {
      logger.info('GoogleMeetJoiner(transcriptMonitor): CALL extractCaptions');
      const captions = await extractCaptions(page);
      logger.info(`GoogleMeetJoiner(transcriptMonitor): extractCaptions DONE | count=${captions?.length || 0}`);

      if (!captions?.length) {
        logger.info('GoogleMeetJoiner(transcriptMonitor): NO CAPTIONS FOUND');
        return;
      }

      logger.info('GoogleMeetJoiner(transcriptMonitor): START VALIDATION FILTER');

      const validCaptions = captions.filter(c => {
        const valid = isValid(c.text);

        if (!valid) {
          logger.debug(`GoogleMeetJoiner(transcriptMonitor): INVALID CAPTION DROPPED | text=${c.text}`);
        } else {
          logger.info(`GoogleMeetJoiner(transcriptMonitor): VALID CAPTION | text=${c.text}`);
        }

        return valid;
      });

      logger.info(`GoogleMeetJoiner(transcriptMonitor): VALIDATION DONE | validCount=${validCaptions.length}`);

      if (!validCaptions.length) {
        logger.info('GoogleMeetJoiner(transcriptMonitor): NO VALID CAPTIONS AFTER FILTER');
        return;
      }

      logger.info('GoogleMeetJoiner(transcriptMonitor): CALL processCaptionLines');

      const state = await processCaptionLines(
        ctx,
        validCaptions,
        lastCaptionLine,
        lastSpeakerName
      );

      logger.info(`processCaptionLines DONE`);

      if (state) {
        lastCaptionLine = state.lastCaptionLine;
        lastSpeakerName = state.lastSpeakerName;

        logger.info(
          `GoogleMeetJoiner(transcriptMonitor): STATE UPDATED | lastCaptionLine="${lastCaptionLine}", lastSpeakerName=${lastSpeakerName}`
        );
      } else {
        logger.info('GoogleMeetJoiner(transcriptMonitor): NO STATE RETURNED FROM processCaptionLines');
      }

      logger.info(`GoogleMeetJoiner(transcriptMonitor): Captions processed: ${validCaptions.length}`);

    } catch (err) {

      logger.error('GoogleMeetJoiner(transcriptMonitor): CAPTURED ERROR OBJECT:', err);
      logger.error('GoogleMeetJoiner(transcriptMonitor): MESSAGE:', err?.message);
      logger.error('GoogleMeetJoiner(transcriptMonitor): STACK:', err?.stack);
      logger.error('GoogleMeetJoiner(transcriptMonitor): PAGE STATE:', {
        isStopping: ctx.isStopping,
        pageExists: !!page,
        pageClosed: page?.isClosed?.()
      });
      const message = err?.message || '';
      logger.error(`GoogleMeetJoiner(transcriptMonitor): ERROR CAUGHT | ${message}`);

      const fatal =
        /target closed|context was destroyed|page closed|execution context|detached Frame|Detached Frame|frame detached/i;

      if (ctx.isStopping || page?.isClosed?.() || fatal.test(message)) {
        logger.error('GoogleMeetJoiner(transcriptMonitor): FATAL ERROR DETECTED -> STOPPING MONITOR');

        ctx.isStopping = true;
        clearInterval(ctx.captionInterval);
        ctx.captionInterval = null;

        logger.info('GoogleMeetJoiner(transcriptMonitor): INTERVAL FORCE STOPPED');
        return;
      }

      logger.error(`GoogleMeetJoiner(transcriptMonitor): caption error stack: ${err.stack || err}`);
    }
  }, 5000);

  logger.info('GoogleMeetJoiner(transcriptMonitor): INTERVAL REGISTERED (5000ms)');
}

function stopTranscriptMonitor(ctx) {
  logger.info('GoogleMeetJoiner(transcriptMonitor): ENTER stopTranscriptMonitor');

  ctx.isStopping = true;
  logger.info('GoogleMeetJoiner(transcriptMonitor): SET isStopping=true');

  if (ctx.captionInterval) {
    clearInterval(ctx.captionInterval);
    ctx.captionInterval = null;
    logger.info('GoogleMeetJoiner(transcriptMonitor): INTERVAL CLEARED manually');
  } else {
    logger.info('GoogleMeetJoiner(transcriptMonitor): NO INTERVAL FOUND');
  }
}

function getTranscript(ctx) {
  logger.info('GoogleMeetJoiner(transcriptMonitor): getTranscript called');
  return ctx.transcriptBuffer || [];
}

module.exports = {
  startTranscriptMonitor,
  stopTranscriptMonitor,
  getTranscript
};