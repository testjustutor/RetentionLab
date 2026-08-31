/**
 * controllers/recordings/videoRecordingsController.js
 * Business logic for video recordings page with filters
 */
const VideoRecordingsModel = require('../../models/recordings/VideoRecordingsModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

// Convert a stored file path (relative `storage/...`, absolute Windows `C:\...`,
// or malformed concatenated `storage...`) into a web-accessible `/storage/...` URL.
function toUrl(p) {
  if (!p) return null;
  let normalized = p.replace(/\\/g, '/').replace(/\/+/g, '/');

  // Handle malformed paths (no separators after 'storage', e.g. "storagesummariesFILE.txt")
  const hasSeparators = normalized.includes('/');
  const lower = normalized.toLowerCase();
  const filenameExtract = normalized.match(/([^/]+\.\w+)$/);

  const byPrefix = (fn, fname) => {
    if (fn.startsWith('summary_')) return '/storage/summaries/' + fname;
    if (fn.startsWith('trans_')) return '/storage/transcripts/' + fname;
    if (fn.startsWith('diar_')) return '/storage/diarization/' + fname;
    if (fn.endsWith('.wav') || fn.endsWith('.mp3') || fn.endsWith('.ogg')) return '/storage/audio/' + fname;
    if (fn.endsWith('.mp4') || fn.endsWith('.webm') || fn.endsWith('.mov')) return '/storage/screen-recordings/' + fname;
    if (fn.endsWith('.json')) return '/storage/json/' + fname;
    return '/' + fname;
  };

  if (!hasSeparators) {
    if (filenameExtract) return byPrefix(filenameExtract[1].toLowerCase(), filenameExtract[1]);
    return '/' + normalized;
  }

  let storageIdx = lower.indexOf('storage/');
  if (storageIdx === -1) storageIdx = lower.indexOf('storage');
  if (storageIdx !== -1) {
    let result = normalized.slice(storageIdx).replace(/\/+/g, '/');
    // storage but no folder separator after it -> malformed; rebuild from filename
    if (!result.includes('/', 'storage'.length + 1)) {
      if (filenameExtract) return byPrefix(filenameExtract[1].toLowerCase(), filenameExtract[1]);
      return null;
    }
    return '/' + result.replace(/^\/+/, '');
  }

  // Absolute Windows drive path (e.g. C:/xampp/htdocs/RetentionLab/storage/...)
  const driveMatch = normalized.match(/^[a-zA-Z]:\/?(.*)$/);
  if (driveMatch && driveMatch[1]) {
    const rest = driveMatch[1].replace(/^\/+/, '');
    if (!rest.includes('/')) {
      if (filenameExtract) return byPrefix(filenameExtract[1].toLowerCase(), filenameExtract[1]);
      return null;
    }
    const sIdx = rest.toLowerCase().indexOf('storage');
    if (sIdx !== -1) return '/' + rest.slice(sIdx).replace(/^\/+/, '');
    return '/' + rest;
  }

  return normalized.startsWith('/') ? normalized : '/' + normalized;
}

const controller = {
  /**
   * GET /api/recordings/videos
   * Get all recordings with optional filters
   */
  async getVideoRecordings(req) {
    try {
      // Support both GET (query params) and POST (request body)
      const filters = {
        startDate: req.body?.startDate || req.query.startDate || null,
        endDate: req.body?.endDate || req.query.endDate || null,
        instructorId: req.body?.instructorId ? parseInt(req.body.instructorId) : (req.query.instructorId ? parseInt(req.query.instructorId) : null)
      };

      const recordings = await VideoRecordingsModel.getAssets(
        filters,
        req.user.id,
        req.user.role_name,
        req.user.company_id,
        'video'
      );

      // Transform data for frontend
      const transformedRecordings = recordings.map(rec => {
        // Determine video URL (prefer video_path, fallback to audio_path)
        const videoUrl = rec.video_path || null;
        
        return {
          meeting_id: rec.meeting_id,
          title: rec.title,
          description: rec.description,
          platform: rec.platform,
          meeting_link: rec.meeting_link,
          scheduled_start_time: rec.scheduled_start_time,
          scheduled_end_time: rec.scheduled_end_time,
          actual_start_time: rec.actual_start_time,
          actual_end_time: rec.actual_end_time,
          meeting_status: rec.meeting_status,
          instructor_id: rec.instructor_id,
          instructor_name: `${rec.instructor_first_name} ${rec.instructor_last_name}`,
          instructor_email: rec.instructor_email,
          session_id: rec.session_id,
          session_start_time: rec.session_start_time,
          session_end_time: rec.session_end_time,
          session_status: rec.session_status,
          video_url: videoUrl,
          video_path: rec.video_path || null,
          has_video: !!videoUrl,
          transcript_path: rec.transcript_path,
          oqi_score: rec.oqi_score,
          asset_status: rec.asset_status
        };
      });

      return ok({ 
        recordings: transformedRecordings,
        count: transformedRecordings.length,
        filters: filters
      });
    } catch (e) {
      return err(e.message, 500);
    }
  },

  /** POST /api/recordings/summaries - Get summaries with filters in body */
  async getSummaries(req) {
    try {
      // User is already authenticated by requireAuth middleware
      if (!req.user || !req.user.user_uuid) {
        return err('Unauthorized', 401);
      }

      const userRole = req.user.role_name || '';

      // Support both GET (userId param) and POST (userId in body with optional filters)
      // Accept either numeric ID or UUID
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
      const startDate = req.body?.startDate || req.query.startDate || null;
      const endDate = req.body?.endDate || req.query.endDate || null;

      // Convert UUID to userId if needed
      let targetUserId = requestedUserId;
      if (requestedUserUuid && !requestedUserId) {
        const UsersModel = require('../../models/users/UsersModel');
        const targetUser = await UsersModel.getUserByUuid(requestedUserUuid);
        targetUserId = targetUser ? targetUser.id : null;
      }

      const filters = {
        startDate,
        endDate,
        instructorId: targetUserId,
        limit
      };

      // Same shared model function used by getVideoRecordings — only assetType
      // and the return transform differ
      const data = await VideoRecordingsModel.getAssets(
        filters,
        req.user.id,
        userRole,
        req.user.company_id,
        'summary'
      );

      const summaries = data.map(r => {
        let summaryUrl = toUrl(r.summary_path);
        return {
          meeting_id: r.meeting_id,
          title: r.title || 'Untitled',
          description: r.description,
          platform: r.platform || 'unknown',
          meeting_link: r.meeting_link,
          instructor_id: r.instructor_id,
          instructor_name: `${r.instructor_first_name} ${r.instructor_last_name}`,
          instructor_email: r.instructor_email,
          start_time: r.scheduled_start_time,
          end_time: r.scheduled_end_time,
          session_id: r.session_id,
          session_start_time: r.session_start_time,
          session_end_time: r.session_end_time,
          session_status: r.session_status,
          summary_url: summaryUrl,
          transcript_path: r.transcript_path,
          oqi_score: r.oqi_score || null,
          audit_summary: r.audit_summary || null,
          has_summary: !!(summaryUrl || r.oqi_score),
          asset_status: r.asset_status || 'not_started'
        };
      });

      return ok({ 
        count: summaries.length, 
        summaries: summaries
      });
    } catch (e) { return err(e.message, 500); }
  },
  /**
   * GET /api/recordings/videos/instructors
   * Get all instructors for filter dropdown
   */
  async getInstructors(req) {
    try {
      // Use CalendarUsersModel to get instructors who have connected calendars
      const CalendarUsersModel = require('../../models/calendar/CalendarUsersModel');
      const adminId = req.user ? req.user.id : null;
      const userRole = req.user ? req.user.role_name : null;
      
      // Build filter options
      const filterOptions = {
        status: 'active',
        email: true,
        roles: ['instructor', 'solo_instructor']
      };
      
      // For admin: only get users they created
      if (userRole === 'admin' && adminId) {
        filterOptions.createdBy = adminId;
        filterOptions.excludeSelf = true;
        filterOptions.adminId = adminId;
      }
      
      const conns = await CalendarUsersModel.getAllUsers(filterOptions);
      const instructors = (conns || [])
        .filter(c => c.email) // Only require email
        .map(c => ({
          // id: c.user_id || c.user_id_ref,
          uuid: c.user_uuid,
          name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email,
          email: c.email
        }));

      return ok({ 
        instructors: instructors
      });
    } catch (e) {
      return err(e.message, 500);
    }
  },

  /**
   * GET /api/recordings/videos/:meetingId
   * Get single recording details
   */
  async getRecordingById(req) {
    try {
      const meetingId = parseInt(req.params.meetingId);
      if (!meetingId) return err('Meeting ID required', 400);

      const recording = await VideoRecordingsModel.getRecordingByMeetingId(meetingId);
      if (!recording) return err('Vide Recording not found', 404);

      const videoUrl = recording.video_path || null;

      return ok({
        recording: {
          meeting_id: recording.meeting_id,
          title: recording.title,
          description: recording.description,
          platform: recording.platform,
          meeting_link: recording.meeting_link,
          scheduled_start_time: recording.scheduled_start_time,
          scheduled_end_time: recording.scheduled_end_time,
          actual_start_time: recording.actual_start_time,
          actual_end_time: recording.actual_end_time,
          meeting_status: recording.meeting_status,
          instructor_name: `${recording.instructor_first_name} ${recording.instructor_last_name}`,
          instructor_email: recording.instructor_email,
          session_id: recording.session_id,
          session_start_time: recording.session_start_time,
          session_end_time: recording.session_end_time,
          video_url: videoUrl,
          video_path: recording.video_path || null,
          has_video: !!videoUrl,
          transcript_path: recording.transcript_path,
          oqi_score: recording.oqi_score,
          audit_summary: recording.audit_summary,
          asset_status: recording.asset_status
        }
      });
    } catch (e) {
      return err(e.message, 500);
    }
  }
};

module.exports = controller;