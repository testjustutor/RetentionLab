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
   * INITIAL ROSTER CAPTURE (join-time)
   *
   * When the bot joins a meeting that already has other participants in it,
   * the normal join-detection loop (monitor.js's 5s roster diff) only ever
   * notices them on its *next* poll - and only "works" today because that
   * poll happens to diff against an empty previousParticipants list on its
   * very first tick, so everyone already present looks like a fresh join.
   * That's an accident of the diffing, not an explicit step, has no
   * dedicated logging, and depends on the DOM roster/People-panel already
   * being readable by the time that first poll runs.
   *
   * This method makes it explicit: call it once, right after the bot joins,
   * with whatever names monitor.js's DOM scrape (getCurrentParticipantNames,
   * after opening the People panel) returns at that moment.
   *
   * TIMESTAMP LIMITATION: Google Meet exposes no API/event that tells a bot
   * the TRUE original join time of someone who was already in the call
   * before the bot arrived - there is only the current DOM snapshot at the
   * moment the bot looks. snapshotTime is therefore the moment THIS BOT
   * first observed each participant, not their real join time. That is the
   * most accurate value obtainable without inventing one, and mirrors the
   * same documented limitation on handleParticipantLeave's leaveTime
   * parameter above.
   *
   * Every name is routed through handleParticipantJoin(), so this reuses
   * the exact same identifier matching, idempotency, and DB persistence
   * path as any other join - no separate/duplicate logic. That also means
   * it is safe to call even if monitor.js's next poll independently reports
   * the same names again: the second call just hits the "already_joined"
   * no-op branch.
   *
   * Runs independently per participant (Promise.allSettled) so one failing
   * write doesn't stop the rest of the people already in the meeting from
   * being recorded.
   */
  async handleInitialRoster(names, snapshotTime = new Date()) {
    const unique = Array.from(
      new Set((Array.isArray(names) ? names : []).map((n) => (n || '').trim()).filter(Boolean))
    );

    if (unique.length === 0) {
      logger.info(
        `GoogleMeetAdapter(participantTracker): INITIAL_ROSTER: bot joined meeting ${this.meetingId} with no other participants present`
      );
      return [];
    }

    logger.info(
      `GoogleMeetAdapter(participantTracker): INITIAL_ROSTER: ${unique.length} participant(s) already in meeting ${this.meetingId} at join time - recording attendance: ${unique.join(', ')}`
    );

    const results = await Promise.allSettled(
      unique.map((name) => this.handleParticipantJoin(name, snapshotTime))
    );

    results.forEach((result, idx) => {
      const name = unique[idx];
      if (result.status === 'rejected') {
        logger.error(
          `GoogleMeetAdapter(participantTracker): INITIAL_ROSTER: failed to record ${name}:`,
          result.reason
        );
      } else if (result.value && result.value.success === false) {
        logger.warn(
          `GoogleMeetAdapter(participantTracker): INITIAL_ROSTER: not persisted for ${name}: ${result.value.error || 'unknown reason'}`
        );
      }
    });

    return unique;
  }

  /**
   * Handle a participant leaving the meeting
   * First leave → updates main participant record with duration
   * Subsequent leaves → updates rejoin session record
   *
   * IDENTIFIER: matches the same key the join side uses — the trimmed
   * display name (see handleParticipantJoin's FIX note above) — because
   * that's the only stable-ish identifier the Google Meet UI DOM exposes to
   * this bot. Meet's People-panel/tile markup does not expose a persistent
   * per-participant id that this scraper can reliably map back to a name
   * across polls (the `data-participant-id` values read elsewhere in
   * monitor.js are per-tile DOM ids, not a durable participant identity), so
   * inventing one here would mean guessing rather than reusing something
   * Meet actually provides. Two simultaneous participants sharing the exact
   * same display name is the known limitation of this approach.
   *
   * TIMESTAMP: leaveTime defaults to "now" because there is no Google Meet
   * API/event this bot subscribes to that hands back an authoritative
   * per-participant leave timestamp — this integration is a Puppeteer bot
   * polling the meeting DOM (see monitor.js), not a call against a Meet
   * REST/websocket API. The value passed in by monitor.js is always the
   * moment the polling loop noticed the participant's name had disappeared
   * from the roster, which is the most reliable timestamp available (accurate
   * to within one PARTICIPANT_CHECK_INTERVAL, currently 5s) — server "now" is
   * never substituted for a real event timestamp because Meet doesn't supply
   * one to fall back from.
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

      if (tracked) {
        logger.debug(
          `GoogleMeetAdapter(participantTracker): Participant/session matched - ${participantName} ` +
          `(participantId: ${tracked.id}, sessionId: ${tracked.currentSessionId ?? this.sessionId}, status: ${tracked.status})`
        );
      }

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
        // IDEMPOTENCY: the DOM poll can report the same participant absent on
        // back-to-back cycles (e.g. a retried/duplicated leave signal, or the
        // roster flickering empty for one tick). Since status is only flipped
        // to 'left' after a persisted DB write, landing here means that write
        // already happened — skip re-persisting so retried/duplicate leave
        // events never double-count a session's duration or re-close an
        // already-closed attendance_sessions row.
        logger.info(
          `GoogleMeetAdapter(participantTracker): Duplicate leave event ignored - ${participantName} (already left)`
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
   * MEETING-END SCENARIO: close out every participant still marked "joined"
   * in memory when the meeting ends (bot force-closed, page navigated away,
   * host ended the call, meeting page torn down, etc.) with no per-participant
   * leave detected first. Without this, those rows stayed
   * attendance_status='active' / left_at=NULL forever — the gap this tracker
   * used to flag on reset() rather than fix (Teams' tracker already
   * persisted on reset(), Google Meet's didn't).
   *
   * Deliberately reuses handleParticipantLeave() for each still-joined
   * participant instead of a separate persistence path, so meeting-end
   * closeout goes through the exact same rejoin-session lookup, idempotency
   * check, and "leave not persisted" DB guard as a normal detected leave —
   * no duplicated/parallel logic to keep in sync.
   *
   * leaveTime here is the time the monitor loop noticed the meeting had
   * ended, not a timestamp Google Meet provides — see the note on
   * handleParticipantLeave's leaveTime parameter below for why that's the
   * most reliable value available.
   *
   * Runs independently per participant (Promise.allSettled) so one failing
   * DB write (temporary API/DB failure) doesn't stop the others still
   * present from being closed out.
   */
  async finalizeActiveParticipants(meetingEndTime = new Date()) {
    const stillJoined = [];
    for (const [name, data] of this.trackedParticipants.entries()) {
      if (data.status === 'joined') stillJoined.push(name);
    }

    if (stillJoined.length === 0) {
      return [];
    }

    logger.info(
      `GoogleMeetAdapter(participantTracker): Meeting ending with ${stillJoined.length} participant(s) still joined - closing out attendance: ${stillJoined.join(', ')}`
    );

    const results = await Promise.allSettled(
      stillJoined.map((name) => this.handleParticipantLeave(name, meetingEndTime))
    );

    results.forEach((result, idx) => {
      const name = stillJoined[idx];
      if (result.status === 'rejected') {
        logger.error(
          `GoogleMeetAdapter(participantTracker): Failed to close out attendance at meeting end - ${name}:`,
          result.reason
        );
      } else if (result.value && result.value.success === false) {
        logger.warn(
          `GoogleMeetAdapter(participantTracker): Leave not persisted at meeting end - ${name}: ${result.value.message || result.value.error || 'unknown reason'}`
        );
      }
    });

    return results;
  }

  /**
   * Reset tracker (e.g., at meeting end). Persists a leave for anyone still
   * "joined" first (see finalizeActiveParticipants) so no attendance session
   * is left open just because the tracker itself is being discarded.
   */
  async reset(meetingEndTime = new Date()) {
    await this.finalizeActiveParticipants(meetingEndTime);
    this.trackedParticipants.clear();
    logger.info(
      `GoogleMeetAdapter(participantTracker): Tracker reset for meeting ${this.meetingId}`
    );
  }
}

module.exports = ParticipantTracker;