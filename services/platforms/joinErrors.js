/**
 * services/platforms/joinErrors.js
 *
 * Typed errors thrown by platform joiners so the bot service can classify a
 * failed join attempt precisely:
 *
 *   HostDeniedError        - host rejected/denied/removed the bot
 *   WaitingRoomTimeoutError - bot sat in the waiting room until the timeout
 *                             expired without ever being admitted
 *
 * Any other error raised by a joiner is treated as a technical failure.
 */
class HostDeniedError extends Error {
  constructor(message) {
    super(message || 'Host denied the bot entry to the meeting');
    this.name = 'HostDeniedError';
    this.kind = 'host_denied';
  }
}

class WaitingRoomTimeoutError extends Error {
  constructor(message) {
    super(message || 'Bot timed out in the waiting room');
    this.name = 'WaitingRoomTimeoutError';
    this.kind = 'waiting_room_timeout';
  }
}

module.exports = { HostDeniedError, WaitingRoomTimeoutError };
