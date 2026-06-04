/**
 * root/services/platforms/teams/participantTracker.js
 *
 */
const { logger } = require('../../../utils/logger');
const ParticipantModel = require('../../../models/ParticipantModel');

/**
 * ParticipantTracker - Service for managing participant attendance
 * Handles state machine for join/leave/rejoin events
 */
class ParticipantTracker {

  // ─────────────────────────────────────────────
  // CONSTRUCTOR
  // ─────────────────────────────────────────────

  constructor(meetingId, sessionId) {
    this.STATES = { LOBBY: 'lobby', JOINED: 'joined', LEFT: 'left' };
    this.meetingId = meetingId;
    this.sessionId = sessionId;
    this.trackedParticipants = new Map(); // participant_name -> { id, status, joinTime, sessions[] }
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  _key(participantName) {
    return participantName.trim().toLowerCase();
  }

  _buildTrackedRecord(id, joinTime, type = 'initial') {
    return {
      id,
      status: 'joined',
      joinTime,
      currentSessionId: this.sessionId,
      sessions: [{ type, joinTime }]
    };
  }

  // ─────────────────────────────────────────────
  // JOIN HANDLING
  // ─────────────────────────────────────────────

  async _handleRejoin(tracked, participantName, joinTime) {
    logger.info(`TeamsAdapter(participantTracker): Participant rejoining - ${this._key(participantName)}`);

    const rejoinResult = await ParticipantModel.recordParticipantRejoin(
      this.meetingId,
      tracked.id,
      joinTime
    );

    tracked.status = 'joined';
    tracked.currentSessionId = rejoinResult.id;
    tracked.joinTime = joinTime;
    tracked.sessions.push({ sessionId: rejoinResult.id, joinTime, type: 'rejoin' });

    return { success: true, participantName, event: 'rejoin', participantId: tracked.id, sessionId: rejoinResult.id };
  }

  async handleParticipantJoin(participantName, joinTime = new Date()) {
    try {
      const key = this._key(participantName);

      // Already tracked
      if (this.trackedParticipants.has(key)) {
        const tracked = this.trackedParticipants.get(key);

        if (tracked.status === 'left') return this._handleRejoin(tracked, participantName, joinTime);

        logger.debug(`TeamsAdapter(participantTracker): Participant already joined - ${participantName}`);
        return { success: true, participantName, event: 'already_joined', participantId: tracked.id };
      }

      // First join
      logger.info(`TeamsAdapter(participantTracker): Participant first join - ${participantName}`);

      const joinResult = await ParticipantModel.recordParticipantJoin(
        this.meetingId,
        this.sessionId,
        participantName,
        joinTime
      );

      this.trackedParticipants.set(key, this._buildTrackedRecord(joinResult.id, joinTime, 'initial'));

      return { success: true, participantName, event: 'first_join', participantId: joinResult.id };

    } catch (err) {
      logger.error(`TeamsAdapter(participantTracker): Error handling participant join - ${participantName}:`, err);
      return { success: false, participantName, error: err.message };
    }
  }

  // ─────────────────────────────────────────────
  // LEAVE HANDLING
  // ─────────────────────────────────────────────

  async _autoRecoverParticipant(participantName) {
    logger.warn(`TeamsAdapter(participantTracker): Missing join state, auto-creating participant record - ${participantName}`);

    const joinTime = new Date(Date.now() - 60000);

    const joinResult = await ParticipantModel.recordParticipantJoin(
      this.meetingId,
      this.sessionId,
      participantName,
      joinTime
    );

    const tracked = this._buildTrackedRecord(joinResult.id, joinTime, 'auto-recovered');
    this.trackedParticipants.set(this._key(participantName), tracked);

    return tracked;
  }

  async handleParticipantLeave(participantName, leaveTime = new Date()) {
    try {
      if (!participantName || typeof participantName !== 'string') {
        logger.warn(`TeamsAdapter(participantTracker): Invalid leave event (missing name)`);
        return { success: false, participantName: 'UNKNOWN_PARTICIPANT', message: 'Invalid participant name' };
      }

      participantName = participantName.trim().toLowerCase();

      let tracked = this.trackedParticipants.get(participantName);

      // AUTO-RECOVERY: participant exists but was never recorded via join
      if (!tracked) {
        try {
          tracked = await this._autoRecoverParticipant(participantName);
        } catch (err) {
          logger.error(`TeamsAdapter(participantTracker): Auto-recovery failed - ${participantName}`, err);
          return { success: false, participantName, message: 'Auto recovery failed' };
        }
      }

      if (tracked.status !== 'joined') {
        logger.debug(`TeamsAdapter(participantTracker): Participant already left - ${participantName}`);
        return { success: true, participantName, event: 'already_left', participantId: tracked.id };
      }

      // Check if this is a rejoin leave or initial leave
      const lastSession = tracked.sessions[tracked.sessions.length - 1];
      const isRejoin = lastSession?.type === 'rejoin';

      logger.info(`TeamsAdapter(participantTracker): Participant leaving - ${participantName} (rejoin: ${isRejoin})`);

      const leaveResult = isRejoin && tracked.currentSessionId
        ? await ParticipantModel.recordRejoinLeave(tracked.currentSessionId, leaveTime)
        : await ParticipantModel.recordParticipantLeave(this.meetingId, participantName, leaveTime);

      tracked.status = 'left';
      tracked.leaveTime = leaveTime;
      if (lastSession) lastSession.leaveTime = leaveTime;

      return {
        success: true,
        participantName,
        event: 'leave',
        participantId: tracked.id,
        duration: leaveResult.sessionDuration || leaveResult.duration || 0
      };

    } catch (err) {
      logger.error(`TeamsAdapter(participantTracker): Error handling participant leave - ${participantName}:`, err);
      return { success: false, participantName, error: err.message };
    }
  }

  // ─────────────────────────────────────────────
  // GETTERS
  // ─────────────────────────────────────────────

  getParticipant(participantName) {
    return this.trackedParticipants.get(this._key(participantName));
  }

  getTrackedParticipants() {
    const participants = [];
    for (const [name, data] of this.trackedParticipants.entries()) {
      participants.push({ name, ...data, sessionsCount: data.sessions.length });
    }
    return participants;
  }

  getSummary() {
    const summary = { totalParticipants: this.trackedParticipants.size, currentlyJoined: 0, currentlyLeft: 0, participants: [] };

    for (const [name, data] of this.trackedParticipants.entries()) {
      if (data.status === 'joined') summary.currentlyJoined++;
      else if (data.status === 'left') summary.currentlyLeft++;

      summary.participants.push({
        name,
        status: data.status,
        rejoins: (data.sessions.filter(s => s.type === 'rejoin') || []).length
      });
    }

    return summary;
  }

  // ─────────────────────────────────────────────
  // RESET
  // ─────────────────────────────────────────────

  reset(meetingEndTime = new Date()) {
    for (const [name, data] of this.trackedParticipants.entries()) {
      if (data.status === 'joined') {
        ParticipantModel.recordParticipantLeave(this.meetingId, name, meetingEndTime)
          .catch(err => logger.error(`Cleanup leave failed for ${name}:`, err));
      }
    }
    this.trackedParticipants.clear();
    logger.info(`TeamsAdapter(participantTracker): Tracker reset for meeting ${this.meetingId}`);
  }
}

module.exports = ParticipantTracker;