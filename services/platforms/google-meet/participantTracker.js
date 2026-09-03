/**
 * services/platforms/google-meet/participanTracker.js
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
   *
   * FIX: participantName is now trimmed up front and used consistently as
   * both the map key and the value written to the DB. Previously the map
   * key here was untrimmed while handleParticipantLeave() trimmed before
   * lookup — a name with stray whitespace on join could never be found
   * again on leave.
   */
  async handleParticipantJoin(participantName, joinTime = new Date()) {
    try {
      const key = (participantName || '').trim();

      // Check if participant already being tracked
      if (this.trackedParticipants.has(key)) {
        const tracked = this.trackedParticipants.get(key);

        // If was previously left, handle as rejoin
        if (tracked.status === 'left') {
          logger.info(
            `GoogleMeetAdapter(participantTracker): Participant rejoining - ${key}`
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
            participantName: key,
            event: 'rejoin',
            participantId: tracked.id,
            sessionId: rejoinResult.id
          };
        } else {
          // Already joined, no action needed
          logger.debug(
            `GoogleMeetAdapter(participantTracker): Participant already joined - ${key}`
          );
          return {
            success: true,
            participantName: key,
            event: 'already_joined',
            participantId: tracked.id
          };
        }
      }

      // First join - create participant record
      logger.info(
        `GoogleMeetAdapter(participantTracker): Participant first join - ${key}`
      );

      const joinResult = await ParticipantModel.recordParticipantJoin(
        this.meetingId,
        this.sessionId,
        key,
        joinTime
      );

      // Track locally
      this.trackedParticipants.set(key, {
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
        participantName: key,
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
        // FIX: sessionId is now passed through so recordParticipantLeave
        // scopes its lookup/update to THIS meeting session, not just this
        // meeting. This was previously missing and, after the sessionId
        // parameter was added to ParticipantModel.recordParticipantLeave,
        // was silently mis-binding arguments (name -> sessionId slot,
        // leaveTime -> name slot), breaking every Google Meet leave event.
        leaveResult = await ParticipantModel.recordParticipantLeave(
          this.meetingId,
          this.sessionId,
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
    return this.trackedParticipants.get((participantName || '').trim());
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
   *
   * NOTE: this still does NOT persist a leave event to the DB for
   * participants who are still "joined" in-memory when the meeting ends
   * (e.g. bot force-closed, meeting ended by host with no per-participant
   * leave detected first). Those rows stay attendance_status='active' /
   * leave_time=NULL forever. Teams' tracker persists on reset(); this one
   * doesn't. Flagging rather than changing silently — see chat for whether
   * you want this ported over.
   */
  reset() {
    this.trackedParticipants.clear();
    logger.info(
      `GoogleMeetAdapter(participantTracker): Tracker reset for meeting ${this.meetingId}`
    );
  }
}

module.exports = ParticipantTracker;