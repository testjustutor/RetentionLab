/**
 * controllers/super_admin/settings/videoProcessingController.js
 */
const VideoProcessingModel = require('../../../models/super_admin/settings/VideoProcessingModel');

/** Normalize the fileName from body or query. */
function extractFileName(body, query) {
  return body?.fileName || query?.fileName;
}

const controller = {
  async getAllVideos(req, res) {
    try {
      const rows = await VideoProcessingModel.getAllVideos();
      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error('[VideoProcessingController] getAllVideos error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  async convertAudio(req, res) {
    try {
      // Convert sends the .mp4 video file link (videoPath); fall back to fileName.
      const videoPath = req.body?.videoPath || req.body?.filePath || req.body?.fileName;
      if (!videoPath) {
        return res.status(400).json({ success: false, error: 'videoPath is required' });
      }

      const result = await VideoProcessingModel.convertToAudio(videoPath);
      if (!result.success && /unsafe|Invalid/i.test(result.error)) {
        return res.status(400).json({ success: false, error: result.error });
      }
      return res.json({ success: true, data: result });
    } catch (err) {
      console.error('[VideoProcessingController] convertAudio error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  async processAudio(req, res) {
    try {
      // Process sends the .mp3 audio file link (audioPath) plus the meeting
      // id + session id so they can be passed straight to the Python bridge.
      const audioPath = req.body?.audioPath || req.body?.filePath || req.body?.fileName;
      const meetingId = req.body?.meetingId || null;
      const sessionId = req.body?.sessionId || null;
      if (!audioPath) {
        return res.status(400).json({ success: false, error: 'audioPath is required' });
      }

      const result = await VideoProcessingModel.processAudio(audioPath, meetingId, sessionId);
      if (!result.success && /unsafe|Invalid/i.test(result.error)) {
        return res.status(400).json({ success: false, error: result.error });
      }
      return res.json({ success: true, data: result });
    } catch (err) {
      console.error('[VideoProcessingController] processAudio error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  async getProcessingHistory(req, res) {
    try {
      const rows = await VideoProcessingModel.getProcessingHistory();
      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error('[VideoProcessingController] getProcessingHistory error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  
};

module.exports = controller;

