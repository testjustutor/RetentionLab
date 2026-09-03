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
   *
   * FIX 1: name is now trimmed before being used as the map key, matching
   * handleParticipantLeave() below. Previously an untrimmed key here vs. a
   * trimmed key on leave meant a name with stray whitespace on join could
   * never be found again on leave, silently dropping the leave event.
   */
  async handleParticipantJoin(participantName, joinTime = new Date()) {
    try {
      const key = participantName.trim();

      // Check if participant already being tracked
      if (this.trackedParticipants.has(key)) {
        const tracked = this.trackedParticipants.get(key);

        // If was previously left, handle as rejoin
        if (tracked.status === 'left') {
          logger.info(
            `ZoomAdapter(participantTracker): Participant rejoining - ${key}`
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
            `ZoomAdapter(participantTracker): Participant already joined - ${key}`
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
        `ZoomAdapter(participantTracker): Participant first join - ${key}`
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
        participantName: key,
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
   *
   * FIX 2: auto-recovery added (mirrors google-meet/teams trackers). If a
   * leave event arrives for a name we never saw a join for (e.g. the join
   * was missed by the DOM scraper in monitor.js), we now backfill a
   * participant record instead of just logging a warning and dropping the
   * leave entirely.
   */
  async handleParticipantLeave(participantName, leaveTime = new Date()) {
    try {

      if (!participantName || typeof participantName !== 'string') {
        logger.warn(`ZoomAdapter(participantTracker): Invalid leave event (missing name)`);
        return { success: false, participantName: 'UNKNOWN_PARTICIPANT', message: 'Invalid participant name' };
      }

      const key = participantName.trim();           // exact case for map lookup
      const originalName = participantName.trim();  // same, for DB

      let tracked = this.trackedParticipants.get(key);

      // AUTO-RECOVERY: participant exists but was never recorded via join
      if (!tracked) {
        logger.warn(
          `ZoomAdapter(participantTracker): Missing join state, auto-creating participant record - ${key}`
        );

        try {
          const joinTime = new Date(Date.now() - 60000); // assume joined ~1 minute ago

          const joinResult = await ParticipantModel.recordParticipantJoin(
            this.meetingId,
            this.sessionId,
            originalName,
            joinTime
          );

          tracked = {
            id: joinResult.id,
            status: 'joined',
            joinTime,
            currentSessionId: null,
            sessions: [
              {
                type: 'auto-recovered',
                joinTime
              }
            ]
          };

          this.trackedParticipants.set(key, tracked);
        } catch (err) {
          logger.error(
            `ZoomAdapter(participantTracker): Auto-recovery failed - ${key}`,
            err
          );
          return { success: false, participantName: key, message: 'Auto recovery failed' };
        }
      }

      if (tracked.status !== 'joined') {
        logger.debug(`ZoomAdapter(participantTracker): Participant already left - ${key}`);
        return { success: true, participantName: key, event: 'already_left', participantId: tracked.id };
      }

      const lastSession = tracked.sessions[tracked.sessions.length - 1];
      const isRejoin = lastSession?.type === 'rejoin';

      logger.info(`ZoomAdapter(participantTracker): Participant leaving - ${originalName} (rejoin: ${isRejoin})`);

      // FIX 3: recordParticipantLeave now takes sessionId so it can't grab
      // a stale row from an earlier session with the same participant name.
      const leaveResult = isRejoin && tracked.currentSessionId
        ? await ParticipantModel.recordRejoinLeave(tracked.currentSessionId, leaveTime)
        : await ParticipantModel.recordParticipantLeave(this.meetingId, this.sessionId, originalName, leaveTime);

      // Guard: ParticipantModel returned { success:false } (e.g. the DB row was deleted
      // out from under us) — do not report a successful leave that was never persisted.
      if (leaveResult && leaveResult.success === false) {
        logger.warn(
          `ZoomAdapter(participantTracker): Leave not persisted for ${originalName}: ${leaveResult.message || 'unknown reason'}`
        );
        return { success: false, participantName: originalName, message: leaveResult.message || 'Leave not persisted' };
      }

      tracked.status = 'left';
      tracked.leaveTime = leaveTime;
      if (lastSession) lastSession.leaveTime = leaveTime;

      return {
        success: true,
        participantName: key,
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
    return this.trackedParticipants.get(participantName?.trim());
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