/**
 * controllers/recordingsController.js
 * Business logic for meeting recordings, transcripts, summaries, and assets.
 * Uses user_id from calendar_connections for lookups (not email in URL).
 */
const CalendarUsersModel = require('../../models/calendar/CalendarUsersModel');
const MeetingRecordingsModel = require('../../models/recordings/MeetingRecordingsModel');
const UsersModel = require('../../models/users/UsersModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const ASSET_KEYS = [
  { key: 'audit_json_path', label: 'Audit Log', type: 'JSON', color: 'rose' },
  { key: 'whisper_path', label: 'AI Transcript', type: 'TXT', color: 'violet' },
  { key: 'captions_raw_path', label: 'Captions', type: 'SRT', color: 'emerald' },
  { key: 'diarization_path', label: 'Diarization', type: 'JSON', color: 'sky' },
  { key: 'embeddings_path', label: 'Embeddings', type: 'JSON', color: 'amber' },
  { key: 'llm_prompts_path', label: 'LLM Prompts', type: 'JSON', color: 'fuchsia' },
  { key: 'talk_ratio_json_path', label: 'Talk Ratio', type: 'JSON', color: 'indigo' },
  { key: 'sentiment_analysis_path', label: 'Sentiment', type: 'JSON', color: 'green' },
  { key: 'action_items_path', label: 'Action Items', type: 'JSON', color: 'lime' },
  { key: 'user_silence_duration_path', label: 'Silence Track', type: 'JSON', color: 'orange' },
  { key: 'questions_asked_count_path', label: 'Questions', type: 'JSON', color: 'teal' }
];

function toUrl(p) {
  if (!p) return null;
  let normalized = p.replace(/\\/g, '/').replace(/\/+/g, '/');
  normalized = normalized.replace(/AUDIO_DIAR_/g, 'DIAR_').replace(/cache_audio_transcripts/g, 'cache_diarization');

  const hasSeparators = normalized.includes('/');
  const lower = normalized.toLowerCase();
  const filenameExtract = normalized.match(/([^\\\/]+\.\w+)$/);

  if (!hasSeparators && filenameExtract) {
    const fn = filenameExtract[1].toLowerCase();
    const fname = filenameExtract[1];
    if (fn.startsWith('summary_')) return '/storage/summaries/' + fname;
    if (fn.startsWith('trans_')) return '/storage/transcripts/' + fname;
    if (fn.startsWith('diar_')) return '/storage/diarization/' + fname;
    if (fn.endsWith('.wav') || fn.endsWith('.mp3') || fn.endsWith('.ogg')) return '/storage/audio/' + fname;
    if (fn.endsWith('.json')) return '/storage/json/' + fname;
    return '/' + fname;
  }

  normalized = normalized.replace(/AUDIO_DIAR_/g, 'DIAR_').replace(/cache_audio_transcripts/g, 'cache_diarization');

  let storageIdx = lower.indexOf('storage/');
  if (storageIdx === -1) {
    storageIdx = lower.indexOf('storage');
  }
  if (storageIdx !== -1) {
    let result = normalized.slice(storageIdx);
    result = result.replace(/\/+/g, '/');
    if (!result.includes('/', 8)) {
      if (filenameExtract) {
        const fn = filenameExtract[1].toLowerCase();
        const fname = filenameExtract[1];
        if (fn.startsWith('summary_')) return '/storage/summaries/' + fname;
        if (fn.startsWith('trans_')) return '/storage/transcripts/' + fname;
        if (fn.startsWith('diar_')) return '/storage/diarization/' + fname;
        if (fn.endsWith('.wav') || fn.endsWith('.mp3') || fn.endsWith('.ogg')) return '/storage/audio/' + fname;
        if (fn.endsWith('.json')) return '/storage/json/' + fname;
        return '/' + fname;
      }
      return null;
    }
    result = result.replace(/^\/+/, '');
    return '/' + result;
  }
  const driveMatch = normalized.match(/^[a-zA-Z]:\/?(.*)$/);
  if (driveMatch && driveMatch[1]) {
    let rest = driveMatch[1].replace(/\\/g, '/').replace(/^\/+/, '');
    if (!rest.includes('/')) {
      if (filenameExtract) {
        const fn = filenameExtract[1].toLowerCase();
        const fname = filenameExtract[1];
        if (fn.startsWith('summary_')) return '/storage/summaries/' + fname;
        if (fn.startsWith('trans_')) return '/storage/transcripts/' + fname;
        if (fn.startsWith('diar_')) return '/storage/diarization/' + fname;
        if (fn.endsWith('.wav') || fn.endsWith('.mp3') || fn.endsWith('.ogg')) return '/storage/audio/' + fname;
        if (fn.endsWith('.json')) return '/storage/json/' + fname;
        return '/' + fname;
      }
      return null;
    }
    return '/' + rest;
  }
  return normalized.startsWith('/') ? normalized : '/' + normalized;
}

const controller = {
  /** GET /api/recordings/users — list connected instructors with user_id */
  async listUsers(req) {
    try {
      const conns = await CalendarUsersModel.getAllUsers();
      const users = (conns || []).filter(c => c.connection_status === 'active' && c.email)
        .map(c => ({ user_id: c.user_id || c.user_id_ref, email: c.email, role_name: c.role_name || 'instructor' }));
      return ok({ users });
    } catch (e) { return err(e.message); }
  },

  // ── Generic data fetcher (shared by all content pages) ──────────────
  async _fetchByUserId(userId, userRole, currentUserId, selectFields, mapFn, limit, startDate, endDate) {
    limit = limit || 50;
    const rows = await MeetingRecordingsModel.fetchMeetings({
      userId,
      userRole,
      currentUserId,
      limit,
      startDate,
      endDate
    });
    return mapFn(rows);
  },

  // ── Shared role-based row resolution (used by recordings & transcripts) ──
  async _resolveRows({ requestedUserId, requestedUserUuid, userRole, currentUserId, limit, startDate, endDate }) {
    // If a specific instructor/user was requested, fetch only their data
    if (requestedUserId || requestedUserUuid) {
      let targetUserId = requestedUserId;
      if (requestedUserUuid && !requestedUserId) {
        const targetUser = await UsersModel.getUserByUuid(requestedUserUuid);
        targetUserId = targetUser ? targetUser.id : null;
      }
      return MeetingRecordingsModel.fetchMeetings({ userId: targetUserId, userRole, currentUserId, limit, startDate, endDate });
    }
    // Admin without a filter: get all instructors they created, plus their meetings
    if (userRole === 'admin') {
      return MeetingRecordingsModel.getRecordingsForAdmin(currentUserId, limit, startDate, endDate);
    }
    // Instructor: their own meetings
    if (userRole === 'instructor' || userRole === 'solo_instructor') {
      return MeetingRecordingsModel.fetchMeetings({ userId: currentUserId, userRole, currentUserId, limit, startDate, endDate });
    }
    // Fallback for any other/unrecognized role: default to the caller's own account
    // (fetchMeetings itself also defaults userId -> currentUserId, this just makes intent explicit)
    return MeetingRecordingsModel.fetchMeetings({ userId: currentUserId, userRole, currentUserId, limit, startDate, endDate });
  },

  /** POST /api/recordings/by-user - Get recordings with filters in body */
  async getRecordings(req) {
    try {
      if (!req.user || !req.user.user_uuid) {
        return err('Unauthorized', 401);
      }

      const currentUserUuid = req.user.user_uuid;
      const userRole = req.user.role_name || '';
      const currentUserId = req.user.id;

      let requestedUserId = null;
      let requestedUserUuid = null;

      if (req.body?.userId) {
        const userIdVal = req.body.userId;
        if (typeof userIdVal === 'string' && userIdVal.includes('-')) {
          requestedUserUuid = userIdVal;
        } else {
          requestedUserId = parseInt(userIdVal);
        }
      } else if (req.params.userId) {
        const userIdVal = req.params.userId;
        if (typeof userIdVal === 'string' && userIdVal.includes('-')) {
          requestedUserUuid = userIdVal;
        } else {
          requestedUserId = parseInt(userIdVal);
        }
      }

      const limit = req.body?.limit || 50;
      const startDate = req.body?.startDate || null;
      const endDate = req.body?.endDate || null;

      const rows = await this._resolveRows({ requestedUserId, requestedUserUuid, userRole, currentUserId, limit, startDate, endDate });

      const data = rows.map(r => {
        let audioUrl = null;
        if (r.session_audio_file && r.session_audio_file.trim() !== '') {
          audioUrl = r.session_audio_file.trim();
        } else if (r.audio_path) {
          audioUrl = toUrl(r.audio_path);
        }
        const instructorName = [r.instructor_first_name, r.instructor_last_name].filter(Boolean).join(' ') || 'Unknown';
        return {
          meeting_id: r.meeting_id,
          title: r.title || 'Untitled',
          start_time: r.scheduled_start_time,
          end_time: r.scheduled_end_time,
          platform: r.platform || 'unknown',
          play_url: audioUrl,
          has_recording: !!audioUrl,
          asset_status: r.asset_status || 'not_started',
          status: r.meeting_status || 'unknown',
          instructor_name: instructorName,
          instructor_email: r.instructor_email || ''
        };
      });

      return ok({
        count: data.length,
        recordings: data
      });
    } catch (e) { return err(e.message); }
  },

  /** POST /api/recordings/transcripts - Get transcripts with filters in body */
  async getTranscripts(req) {
    try {
      if (!req.user || !req.user.user_uuid) {
        return err('Unauthorized', 401);
      }

      const currentUserUuid = req.user.user_uuid;
      const userRole = req.user.role_name || '';
      const currentUserId = req.user.id;

      let requestedUserId = null;
      let requestedUserUuid = null;

      if (req.body?.userId) {
        const userIdVal = req.body.userId;
        if (typeof userIdVal === 'string' && userIdVal.includes('-')) {
          requestedUserUuid = userIdVal;
        } else {
          requestedUserId = parseInt(userIdVal);
        }
      } else if (req.params.userId) {
        const userIdVal = req.params.userId;
        if (typeof userIdVal === 'string' && userIdVal.includes('-')) {
          requestedUserUuid = userIdVal;
        } else {
          requestedUserId = parseInt(userIdVal);
        }
      }

      const limit = req.body?.limit || 50;
      const startDate = req.body?.startDate || null;
      const endDate = req.body?.endDate || null;

      const rows = await this._resolveRows({ requestedUserId, requestedUserUuid, userRole, currentUserId, limit, startDate, endDate });

      const data = rows.map(r => {
        let url = null;
        let hasTranscript = false;
        if (r.session_transcript_file) {
          url = r.session_transcript_file;
          hasTranscript = true;
        } else {
          url = r.transcript_path || r.whisper_path || null;
          hasTranscript = !!(r.transcript_path || r.whisper_path);
        }
        const instructorName = [r.instructor_first_name, r.instructor_last_name].filter(Boolean).join(' ') || 'Unknown';
        return {
          meeting_id: r.meeting_id,
          title: r.title || 'Untitled',
          start_time: r.scheduled_start_time,
          end_time: r.scheduled_end_time,
          platform: r.platform || 'unknown',
          view_url: toUrl(url),
          has_transcript: hasTranscript,
          asset_status: r.asset_status || 'not_started',
          status: r.meeting_status || 'unknown',
          instructor_name: instructorName,
          instructor_email: r.instructor_email || ''
        };
      });
      return ok({
        count: data.length,
        transcripts: data
      });
    } catch (e) { return err(e.message); }
  },

  /** GET /api/recordings/assets/:userId */
  async getAssets(req) {
    try {
      if (!req.user || !req.user.user_uuid) {
        return err('Unauthorized', 401);
      }

      const currentUserUuid = req.user.user_uuid;
      const userRole = req.user.role_name || '';
      const currentUserId = req.user.id;

      let requestedUserId = null;
      let requestedUserUuid = null;

      if (req.params.userId) {
        const userIdVal = req.params.userId;
        if (typeof userIdVal === 'string' && userIdVal.includes('-')) {
          requestedUserUuid = userIdVal;
        } else {
          requestedUserId = parseInt(userIdVal);
        }
      }

      let targetUserId = requestedUserId;
      if (requestedUserUuid && !requestedUserId) {
        const targetUser = await UsersModel.getUserByUuid(requestedUserUuid);
        targetUserId = targetUser ? targetUser.id : null;
      }

      if (!targetUserId) return err('User ID required', 400);

      const startDate = req.body?.startDate || null;
      const endDate = req.body?.endDate || null;

      const data = await this._fetchByUserId(targetUserId, userRole, currentUserId, null, rows => {
        const meetings = rows.map(r => {
          const files = [];
          ASSET_KEYS.forEach(a => { if (r[a.key]) files.push({ key: a.key, label: a.label, type: a.type, color: a.color, url: toUrl(r[a.key]) }); });
          return { meeting_id: r.meeting_id, title: r.title || 'Untitled', start_time: r.scheduled_start_time, end_time: r.scheduled_end_time, platform: r.platform || 'unknown', files, fileCount: files.length, has_assets: files.length > 0 };
        }).filter(m => m.has_assets);
        return meetings;
      });
      return ok({
        count: data.length,
        meetings: data
      });
    } catch (e) { return err(e.message); }
  }
};

module.exports = controller;