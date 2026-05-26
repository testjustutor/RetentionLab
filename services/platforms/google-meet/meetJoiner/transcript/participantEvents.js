const { logger } = require('../../../../../utils/logger');

async function handleCaptionEvent(line) {
  if (!this.participantTracker) {
    return;
  }

  const text = line.trim();
  const joinMatch = text.match(/(.+?) joined/i);

  if (joinMatch) {
    const name = joinMatch[1].trim();
    logger.info(`GoogleMeetJoiner(participantEvent): JOIN detected from caption → ${name}`);
    await this.participantTracker.handleParticipantJoin(name);
    return;
  }

  const leaveMatch = text.match(/(.+?) (has )?left the meeting/i);

  if (leaveMatch) {
    const name = leaveMatch[1].trim();
    logger.info(`GoogleMeetJoiner(participantEvent): LEAVE detected from caption → ${name}`);
    await this.participantTracker.handleParticipantLeave(name);
    return;
  }
}

module.exports = { handleCaptionEvent };