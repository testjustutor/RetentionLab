/**
 * root/services/platforms/google-meet/participanTracker.js
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
            `GoogleMeetAdapter(participantTracker): Participant rejoining - ${participantName}`
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
            `GoogleMeetAdapter(participantTracker): Participant already joined - ${participantName}`
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
        `GoogleMeetAdapter(participantTracker): Participant first join - ${participantName}`
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
        currentSessionId: this.sessionId,
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
        `GoogleMeetAdapter(participantTracker): Error handling participant join - ${participantName}:`,
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

      if (!participantName || typeof participantName !== 'string') {
        logger.warn(
          `GoogleMeetAdapter(participantTracker): Invalid leave event (missing name)`
        );

        return {
          success: false,
          participantName: 'UNKNOWN_PARTICIPANT',
          message: 'Invalid participant name'
        };
      }

      participantName = participantName.trim();

      let tracked = this.trackedParticipants.get(participantName);

      // AUTO-RECOVERY: participant exists but was never recorded via join
      if (!tracked) {
        logger.warn(
          `GoogleMeetAdapter(participantTracker): Missing join state, auto-creating participant record - ${participantName}`
        );

        try {
          const joinTime = new Date(Date.now() - 60000);

          const joinResult = await ParticipantModel.recordParticipantJoin(
            this.meetingId,
            this.sessionId,
            participantName,
            joinTime
          );

          tracked = {
            id: joinResult.id,
            status: 'joined',
            joinTime,
            currentSessionId: this.sessionId,
            sessions: [
              {
                type: 'auto-recovered',
                joinTime: joinTime 
              }
            ]
          };

          this.trackedParticipants.set(participantName, tracked);
        } catch (err) {
          logger.error(
            `GoogleMeetAdapter(participantTracker): Auto-recovery failed - ${participantName}`,
            err
          );
          return {
            success: false,
            participantName,
            message: 'Auto recovery failed'
          };
        }
      }

      if (tracked.status !== 'joined') {
        logger.debug(
          `GoogleMeetAdapter(participantTracker): Participant already left - ${participantName}`
        );
        return {
          success: true,
          participantName,
          event: 'already_left',
          participantId: tracked.id
        };
      }

      // Check if this is a rejoin leave or initial leave
      const lastSession = tracked.sessions[tracked.sessions.length - 1];
      const isRejoin = lastSession?.type === 'rejoin';

      logger.info(
        `GoogleMeetAdapter(participantTracker): Participant leaving - ${participantName} (rejoin: ${isRejoin})`
      );

      let leaveResult;

      if (isRejoin && tracked.currentSessionId) {
        // Update rejoin session
        leaveResult = await ParticipantModel.recordRejoinLeave(
          tracked.currentSessionId,
          leaveTime
        );
      } else {
        // Update main participant record
        leaveResult = await ParticipantModel.recordParticipantLeave(
          this.meetingId,
          participantName,
          leaveTime
        );
      }

      // Guard: ParticipantModel returned { success:false } (e.g. the DB row was deleted
      // out from under us) — do not report a successful leave that was never persisted.
      if (leaveResult && leaveResult.success === false) {
        logger.warn(
          `GoogleMeetAdapter(participantTracker): Leave not persisted for ${participantName}: ${leaveResult.message || 'unknown reason'}`
        );
        return { success: false, participantName, message: leaveResult.message || 'Leave not persisted' };
      }

      tracked.status = 'left';
      tracked.leaveTime = leaveTime;
      if (lastSession) {
        lastSession.leaveTime = leaveTime;
      }

      return {
        success: true,
        participantName,
        event: 'leave',
        participantId: tracked.id,
        duration: leaveResult.sessionDuration || leaveResult.duration || 0
      };
    } catch (err) {
      logger.error(
        `GoogleMeetAdapter(participantTracker): Error handling participant leave - ${participantName}:`,
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
      `GoogleMeetAdapter(participantTracker): Tracker reset for meeting ${this.meetingId}`
    );
  }
}

module.exports = ParticipantTracker;
