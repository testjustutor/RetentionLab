const { logger } = require('../../../../../utils/logger');
const { saveTranscriptLine } = require('./transcriptStorage');

async function processCaptionLines(
  ctx,
  captions,
  lastCaptionLine,
  lastSpeakerName
) {


  logger.debug(
    `GoogleMeetJoiner(captionProcessor): ENTER processCaptionLines | ` +
    `captions=${captions?.length || 0}, ` +
    `lastCaptionLine=${lastCaptionLine}, ` +
    `lastSpeakerName=${lastSpeakerName}`
  );

  logger.debug(`GoogleMeetJoiner(captionProcessor): ENTER processCaptionLines | captions=${captions?.length || 0}`);

  const {
    seenRows,
    transcriptBuffer,
    handleCaptionEvent
  } = ctx;

  logger.debug(
    `GoogleMeetJoiner(captionProcessor): CTX STATE | ` +
    `seenRows=${seenRows?.size}, ` +
    `buffer=${transcriptBuffer?.length}, ` +
    `handleCaptionEvent=${typeof handleCaptionEvent}`
  );
  logger.debug(
    `GoogleMeetJoiner(captionProcessor): FULL CTX DUMP | ` +
    JSON.stringify(
      {
        seenRows: Array.from(seenRows || []),
        transcriptBuffer,
        hasHandleCaptionEvent: !!handleCaptionEvent,
        captions,
        lastCaptionLine,
        lastSpeakerName
      },
      null,
      2
    )
  );
  logger.debug(`GoogleMeetJoiner(captionProcessor): CTX STATE | seenRows=${seenRows.size}, buffer=${transcriptBuffer.length}`);

  for (const item of captions) {
    const { name, text } = item;

    logger.debug(`GoogleMeetJoiner(captionProcessor): NEW ITEM | name=${name}, text=${text}`);

    const currentLineLower = (text || '').toLowerCase();
    const lastLineLower = (lastCaptionLine || '').toLowerCase();

    logger.debug(`GoogleMeetJoiner(captionProcessor): COMPARE | lastSpeaker=${lastSpeakerName}, currentSpeaker=${name}`);
    logger.debug(`GoogleMeetJoiner(captionProcessor): COMPARE TEXT | last="${lastLineLower}" current="${currentLineLower}"`);

    // Filter 1
    if (name === lastSpeakerName && currentLineLower === lastLineLower) {
      continue;
    }

    // Filter 2
    if (
      name === lastSpeakerName &&
      (currentLineLower.startsWith(lastLineLower) ||
        currentLineLower.includes(lastLineLower))
    ) {
      logger.info(`GoogleMeetJoiner(captionProcessor): FILTER 2 HIT (rolling caption) | updating lastCaptionLine only`);
      lastCaptionLine = text;
      continue;
    }

    // Filter 3
    if (
      name === lastSpeakerName &&
      lastLineLower.includes(currentLineLower)
    ) {
      logger.info(`GoogleMeetJoiner(captionProcessor): FILTER 3 HIT (backtracking correction) | skipping`);
      continue;
    }

    const key = `${name}:${text}`;
    logger.info(`GoogleMeetJoiner(captionProcessor): DEDUP KEY | ${key}`);

    // Filter 4
    if (seenRows.has(key)) {
      logger.info(`GoogleMeetJoiner(captionProcessor): FILTER 4 HIT (seenRows duplicate) | skipping`);
      continue;
    }

    seenRows.add(key);
    logger.info(`GoogleMeetJoiner(captionProcessor): seenRows ADDED | ${key}`);

    lastCaptionLine = text;
    lastSpeakerName = name;

    logger.info(`GoogleMeetJoiner(captionProcessor): STATE UPDATED | lastCaptionLine + lastSpeakerName`);

    const formattedTime = new Date().toTimeString().split(' ')[0];    
    
    // const now = new Date();

    // const formattedTime =
    //   `${String(now.getHours()).padStart(2, '0')}:` +
    //   `${String(now.getMinutes()).padStart(2, '0')}:` +
    //   `${String(now.getSeconds()).padStart(2, '0')}`;

    const formattedLine = `[${formattedTime}] ${name}: ${text}`;

    logger.info(`GoogleMeetJoiner(captionProcessor): FORMATTED LINE | ${formattedLine}`);

    transcriptBuffer.push({
      name,
      text,
      time: formattedTime
    });

    logger.info(`GoogleMeetJoiner(captionProcessor): BUFFER PUSHED | size=${transcriptBuffer.length}`);

    if (handleCaptionEvent) {
      logger.info(`GoogleMeetJoiner(captionProcessor): CALLING handleCaptionEvent`);
      await handleCaptionEvent(text);
      logger.info(`GoogleMeetJoiner(captionProcessor): handleCaptionEvent DONE`);
    } else {
      logger.info(`GoogleMeetJoiner(captionProcessor): handleCaptionEvent NOT SET`);
    }

    logger.info(`GoogleMeetJoiner(captionProcessor): SAVING TO STORAGE FORMATTED LINE | ${formattedLine}`);
    await saveTranscriptLine(ctx, formattedLine);
    logger.info(`GoogleMeetJoiner(captionProcessor): SAVE COMPLETE`);
  }

  logger.info(`GoogleMeetJoiner(captionProcessor): EXIT processCaptionLines`);

  return { lastCaptionLine, lastSpeakerName };
}

module.exports = { processCaptionLines };