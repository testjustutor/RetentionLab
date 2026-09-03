/**
 * root/services/platforms/teams/participantTracker.js
 *
 */
const { logger } = require('../../../utils/logger');
const ParticipantModel = require('../../../models/participants/ParticipantModel');

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

  // Auto-recover a participant whose join event was never observed (e.g. missed by
  // the monitor). Creates the participant record so the leave can still be recorded.
  async _autoRecoverParticipant(participantName) {
    const originalName = participantName.trim();
    const joinTime = new Date(Date.now() - 60000); // assume joined ~1 minute ago

    logger.warn(
      `TeamsAdapter(participantTracker): Missing join state, auto-creating participant record - ${originalName}`
    );

    const joinResult = await ParticipantModel.recordParticipantJoin(
      this.meetingId,
      this.sessionId,
      originalName,
      joinTime
    );

    const tracked = this._buildTrackedRecord(joinResult.id, joinTime, 'auto-recovered');
    this.trackedParticipants.set(this._key(originalName), tracked);
    return tracked;
  }

  // FIX: trim participantName once before it's used both as the map key
  // source and the value written to the DB. Previously the raw (possibly
  // whitespace-padded) participantName was passed straight into
  // recordParticipantJoin while handleParticipantLeave()/reset() always
  // matched against a .trim()'d name — a mismatch could leave the DB row
  // unfindable on leave.
  async handleParticipantJoin(participantName, joinTime = new Date()) {
    try {
      const originalName = participantName.trim();
      const key = this._key(originalName);

      // Already tracked
      if (this.trackedParticipants.has(key)) {
        const tracked = this.trackedParticipants.get(key);

        if (tracked.status === 'left') return this._handleRejoin(tracked, originalName, joinTime);

        logger.debug(`TeamsAdapter(participantTracker): Participant already joined - ${originalName}`);
        return { success: true, participantName: originalName, event: 'already_joined', participantId: tracked.id };
      }

      // First join
      logger.info(`TeamsAdapter(participantTracker): Participant first join - ${originalName}`);

      const joinResult = await ParticipantModel.recordParticipantJoin(
        this.meetingId,
        this.sessionId,
        originalName,
        joinTime
      );

      this.trackedParticipants.set(key, this._buildTrackedRecord(joinResult.id, joinTime, 'initial'));

      return { success: true, participantName: originalName, event: 'first_join', participantId: joinResult.id };

    } catch (err) {
      logger.error(`TeamsAdapter(participantTracker): Error handling participant join - ${participantName}:`, err);
      return { success: false, participantName, error: err.message };
    }
  }

  // ─────────────────────────────────────────────
  // LEAVE HANDLING
  // ─────────────────────────────────────────────

  async handleParticipantLeave(participantName, leaveTime = new Date()) {
    try {
      if (!participantName || typeof participantName !== 'string') {
        logger.warn(`TeamsAdapter(participantTracker): Invalid leave event (missing name)`);
        return { success: false, participantName: 'UNKNOWN_PARTICIPANT', message: 'Invalid participant name' };
      }

      const key = this._key(participantName);
      const originalName = participantName.trim();

      let tracked = this.trackedParticipants.get(key);

      if (!tracked) {
        try {
          tracked = await this._autoRecoverParticipant(originalName);
        } catch (err) {
          logger.error(`TeamsAdapter(participantTracker): Auto-recovery failed - ${originalName}`, err);
          return { success: false, participantName: originalName, message: 'Auto recovery failed' };
        }
      }

      if (tracked.status !== 'joined') {
        logger.debug(`TeamsAdapter(participantTracker): Participant already left - ${originalName}`);
        return { success: true, participantName: originalName, event: 'already_left', participantId: tracked.id };
      }

      const lastSession = tracked.sessions[tracked.sessions.length - 1];
      const isRejoin = lastSession?.type === 'rejoin';

      logger.info(`TeamsAdapter(participantTracker): Participant leaving - ${originalName} (rejoin: ${isRejoin})`);

      // FIX: sessionId is now passed through — see note in
      // google-meet/participantTracker.js. Previously missing here too,
      // which meant every Teams leave was mis-binding arguments once
      // ParticipantModel.recordParticipantLeave required sessionId.
      const leaveResult = isRejoin && tracked.currentSessionId
        ? await ParticipantModel.recordRejoinLeave(tracked.currentSessionId, leaveTime)
        : await ParticipantModel.recordParticipantLeave(this.meetingId, this.sessionId, originalName, leaveTime);

      // Guard: ParticipantModel returned { success:false } (e.g. the DB row was deleted
      // out from under us) — do not report a successful leave that was never persisted.
      if (leaveResult && leaveResult.success === false) {
        logger.warn(
          `TeamsAdapter(participantTracker): Leave not persisted for ${originalName}: ${leaveResult.message || 'unknown reason'}`
        );
        return { success: false, participantName: originalName, message: leaveResult.message || 'Leave not persisted' };
      }

      tracked.status = 'left';
      tracked.leaveTime = leaveTime;
      if (lastSession) lastSession.leaveTime = leaveTime;

      return {
        success: true,
        participantName: originalName,
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

  // FIX: sessionId now passed to recordParticipantLeave here too. This is
  // the meeting-end cleanup path — without this fix, EVERY dangling
  // "joined" participant would fail to be closed out when the bot shuts
  // down, since the DB call was mis-binding arguments the same way as
  // handleParticipantLeave() was.
  reset(meetingEndTime = new Date()) {
    for (const [name, data] of this.trackedParticipants.entries()) {
      if (data.status === 'joined') {
        ParticipantModel.recordParticipantLeave(this.meetingId, this.sessionId, name, meetingEndTime)
          .catch(err => logger.error(`Cleanup leave failed for ${name}:`, err));
      }
    }
    this.trackedParticipants.clear();
    logger.info(`TeamsAdapter(participantTracker): Tracker reset for meeting ${this.meetingId}`);
  }
}

module.exports = ParticipantTracker;