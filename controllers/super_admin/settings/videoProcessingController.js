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
      const fileName = extractFileName(req.body, req.query);
      if (!fileName) {
        return res.status(400).json({ success: false, error: 'fileName is required' });
      }

      const result = await VideoProcessingModel.convertToAudio(fileName);
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
      const fileName = extractFileName(req.body, req.query);
      if (!fileName) {
        return res.status(400).json({ success: false, error: 'fileName is required' });
      }

      const result = await VideoProcessingModel.processAudio(fileName);
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
  },

  /**
   * Handle the "named" video type:
   *   <instructorId>_<First>_<Last>_<externalMeetingId>_<sessionId>_<Title>_<YYYY_MM_DD>_<hash>.mp4
   * Seeds instructor user + dummy teams integration + meeting + meeting_session rows.
   */
  async seedNamedVideo(req, res) {
    const fileName = extractFileName(req.body, req.query);
    if (!fileName) {
      return res.status(400).json({ success: false, error: 'fileName is required' });
    }

    // The model validates/parses the filename and derives all DB rows server-side.
    try {
      const result = await VideoProcessingModel.seedNamedVideo(fileName);
      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }
      return res.json(result);
    } catch (err) {
      console.error('[VideoProcessingController] seedNamedVideo error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
};

module.exports = controller;

