/**
 * controllers/recordings/videoRecordingsController.js
 * Business logic for video recordings page with filters
 */
const VideoRecordingsModel = require('../../models/recordings/VideoRecordingsModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /**
   * GET /api/recordings/videos
   * Get all recordings with optional filters
   */
  async getRecordings(req) {
    try {
      const filters = {
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null,
        instructorId: req.query.instructorId ? parseInt(req.query.instructorId) : null
      };

      const recordings = await VideoRecordingsModel.getRecordings(
        filters,
        req.user.id,
        req.user.role_name
      );

      // Transform data for frontend
      const transformedRecordings = recordings.map(rec => {
        // Determine video URL (prefer wav_audio_path, fallback to audio_path)
        const videoUrl = rec.wav_audio_path || rec.audio_path || null;
        
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

  /**
   * GET /api/recordings/videos/instructors
   * Get all instructors for filter dropdown
   */
  async getInstructors(req) {
    try {
      const instructors = await VideoRecordingsModel.getInstructors(
        req.user.id,
        req.user.role_name
      );

      return ok({ 
        instructors: instructors.map(inst => ({
          id: inst.id,
          name: `${inst.first_name} ${inst.last_name}`,
          email: inst.email
        }))
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
      if (!recording) return err('Recording not found', 404);

      const videoUrl = recording.wav_audio_path || recording.audio_path || null;

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