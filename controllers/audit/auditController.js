/**
 * controllers/auditController.js
 * Audit reporting logic.
 */
const TranscriptModel = require('../../models/transcripts/transcriptModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  async list(req) {
    try {
      const rows = await TranscriptModel.getAuditRows();
      return ok({ rows }, 'Audit data fetched');
    } catch (e) {
      return err(e.message, 500);
    }
  }
};

module.exports = controller;
