const fs = require('fs').promises;
const { logger } = require('../../../../../utils/logger');

async function saveTranscriptLine(ctx, formattedLine) {

  if (!formattedLine) {
    logger.warn('GoogleMeetJoiner(transcriptStorage): formattedLine is undefined/null');
  }

  if (ctx && !ctx.filePath) {
    logger.warn('GoogleMeetJoiner(transcriptStorage): filePath missing inside captionMonitor');
  }

  const filePath = ctx.filePath;
  
  try {

    const dataToWrite = `${formattedLine}\n`;

    await fs.appendFile(filePath, dataToWrite);

  } catch (err) {

    logger.error(
      'GoogleMeetJoiner(transcriptStorage): File append error raw:',
      err
    );
  }

}

module.exports = { saveTranscriptLine };