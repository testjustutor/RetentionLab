/**
 * controllers/transcriptsController.js
 * Transcript management logic.
 */
const TranscriptModel = require('../../models/transcripts/transcriptModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  async list(req) {
    try {
      const rows = await TranscriptModel.getAll();
      return ok({ transcripts: rows }, 'Transcripts fetched');
    } catch (e) {
      return err(e.message, 500);
    }
  }
};

module.exports = controller;
