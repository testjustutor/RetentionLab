const fs = require('fs').promises;
const { logger } = require('../../../../../utils/logger');

async function saveTranscriptLine(ctx, formattedLine) {
  logger.info('GoogleMeetJoiner(transcriptStorage): ENTER saveTranscriptLine');

  // logger.debug(`GoogleMeetJoiner(transcriptStorage): formattedLine = ${formattedLine}`);
  // logger.info(Object.keys(formattedLine));
  
  if (!formattedLine) {
    logger.warn('GoogleMeetJoiner(transcriptStorage): formattedLine is undefined/null');
  }

  if (ctx && !ctx.filePath) {
    logger.warn('GoogleMeetJoiner(transcriptStorage): filePath missing inside captionMonitor');
  }

  const filePath = ctx.filePath;

  logger.info(`GoogleMeetJoiner(transcriptStorage): RESOLVED filePath = ${filePath}`);

  try {
    logger.info('GoogleMeetJoiner(transcriptStorage): APPEND FILE START');

    const dataToWrite = `${formattedLine}\n`;
    logger.debug(`GoogleMeetJoiner(transcriptStorage): DATA TO WRITE = ${dataToWrite}`);

    await fs.appendFile(filePath, dataToWrite);

    logger.info('GoogleMeetJoiner(transcriptStorage): APPEND FILE SUCCESS');
  } catch (err) {
    logger.error('GoogleMeetJoiner(transcriptStorage): APPEND FILE FAILED');
    logger.error(`GoogleMeetJoiner(transcriptStorage): ERROR MESSAGE = ${err?.message}`);
    logger.error(`GoogleMeetJoiner(transcriptStorage): ERROR STACK = ${err?.stack}`);

    logger.error(
      'GoogleMeetJoiner(transcriptStorage): File append error raw:',
      err
    );
  }

  logger.info('GoogleMeetJoiner(transcriptStorage): EXIT saveTranscriptLine');
}

module.exports = { saveTranscriptLine };