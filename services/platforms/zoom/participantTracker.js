/**
 * root/services/platforms/zoom/participantTracker.js
 *
 */
const { logger } = require('../../../utils/logger');
const ParticipantModel = require('../../../models/participants/ParticipantModel');

/**
 * ParticipantTracker - Service for managing participant attendance
 * Handles state machine for join/leave/rejoin events
 */
class ParticipantTracker {
  constructor(meetingId, sessionId) {
    this.meetingId = meetingId;
    this.sessionId = sessionId;
    this.trackedParticipants = new Map(); // participant_name -> { id, status, joinTime, sessions[] }
  }

  /**
   * Handle a participant joining the meeting
   * First join → creates main participant record
   * Subsequent joins → creates rejoin session (if not already tracked)
   */
  async handleParticipantJoin(participantName, joinTime = new Date()) {
    try {
      // Check if participant already being tracked
      if (this.trackedParticipants.has(participantName)) {
        const tracked = this.trackedParticipants.get(participantName);

        // If was previously left, handle as rejoin
        if (tracked.status === 'left') {
          logger.info(
            `ZoomAdapter(participantTracker): Participant rejoining - ${participantName}`
          );

          // Create rejoin session
          const rejoinResult = await ParticipantModel.recordParticipantRejoin(
            this.meetingId,
            tracked.id,
            joinTime
          );

          tracked.status = 'joined';
          tracked.currentSessionId = rejoinResult.id;
          tracked.joinTime = joinTime;
          tracked.sessions.push({
            sessionId: rejoinResult.id,
            joinTime,
            type: 'rejoin'
          });

          return {
            success: true,
            participantName,
            event: 'rejoin',
            participantId: tracked.id,
            sessionId: rejoinResult.id
          };
        } else {
          // Already joined, no action needed
          logger.debug(
            `ZoomAdapter(participantTracker): Participant already joined - ${participantName}`
          );
          return {
            success: true,
            participantName,
            event: 'already_joined',
            participantId: tracked.id
          };
        }
      }

      // First join - create participant record
      logger.info(
        `ZoomAdapter(participantTracker): Participant first join - ${participantName}`
      );

      const joinResult = await ParticipantModel.recordParticipantJoin(
        this.meetingId,
        this.sessionId,
        participantName,
        joinTime
      );

      // Track locally
      this.trackedParticipants.set(participantName, {
        id: joinResult.id,
        status: 'joined',
        joinTime,
        currentSessionId: null,
        sessions: [
          {
            type: 'initial',
            joinTime
          }
        ]
      });

      return {
        success: true,
        participantName,
        event: 'first_join',
        participantId: joinResult.id
      };
    } catch (err) {
      logger.error(
        `ZoomAdapter(participantTracker): Error handling participant join - ${participantName}:`,
        err
      );
      return {
        success: false,
        participantName,
        error: err.message
      };
    }
  }

  /**
   * Handle a participant leaving the meeting
   * First leave → updates main participant record with duration
   * Subsequent leaves → updates rejoin session record
   */
  async handleParticipantLeave(participantName, leaveTime = new Date()) {
    try {

      const key = participantName.trim();           // exact case for map lookup
      const originalName = participantName.trim();  // same, for DB

      if (!this.trackedParticipants.has(key)) {
        logger.warn(`ZoomAdapter(participantTracker): Participant not tracked - ${key}`);
        return { success: false, participantName: key, message: 'Participant not tracked' };
      }

      const tracked = this.trackedParticipants.get(key);

      if (tracked.status !== 'joined') {
        logger.debug(`ZoomAdapter(participantTracker): Participant already left - ${key}`);
        return { success: true, participantName: key, event: 'already_left', participantId: tracked.id };
      }

      const lastSession = tracked.sessions[tracked.sessions.length - 1];
      const isRejoin = lastSession?.type === 'rejoin';

      logger.info(`ZoomAdapter(participantTracker): Participant leaving - ${originalName} (rejoin: ${isRejoin})`);

      const leaveResult = isRejoin && tracked.currentSessionId
        ? await ParticipantModel.recordRejoinLeave(tracked.currentSessionId, leaveTime)
        : await ParticipantModel.recordParticipantLeave(this.meetingId, originalName, leaveTime);

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
      logger.error(
        `ZoomAdapter(participantTracker): Error handling participant leave - ${participantName}:`,
        err
      );
      return { success: false, participantName, error: err.message };
    }
  }

  /**
   * Get current tracked participants
   */
  getTrackedParticipants() {
    const participants = [];
    for (const [name, data] of this.trackedParticipants.entries()) {
      participants.push({
        name,
        ...data,
        sessionsCount: data.sessions.length
      });
    }
    return participants;
  }

  /**
   * Get participant by name
   */
  getParticipant(participantName) {
    return this.trackedParticipants.get(participantName);
  }

  /**
   * Get summary of all participants
   */
  getSummary() {
    const summary = {
      totalParticipants: this.trackedParticipants.size,
      currentlyJoined: 0,
      currentlyLeft: 0,
      participants: []
    };

    for (const [name, data] of this.trackedParticipants.entries()) {
      if (data.status === 'joined') {
        summary.currentlyJoined++;
      } else if (data.status === 'left') {
        summary.currentlyLeft++;
      }

      summary.participants.push({
        name,
        status: data.status,
        rejoins: (data.sessions.filter(s => s.type === 'rejoin') || []).length
      });
    }

    return summary;
  }

  /**
   * Reset tracker (e.g., at meeting end)
   */
  reset() {
    this.trackedParticipants.clear();
    logger.info(
      `ZoomAdapter(participantTracker): Tracker reset for meeting ${this.meetingId}`
    );
  }
}

module.exports = ParticipantTracker;
