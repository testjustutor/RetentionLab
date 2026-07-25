/**
 * controllers/assetsController.js
 * Meeting asset management logic.
 */
const MeetingAssetsModel = require('../../models/recordings/MeetingAssetsModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  async list(req) {
    try {
      const rows = await MeetingAssetsModel.getAll();
      return ok({ assets: rows }, 'Assets fetched');
    } catch (e) {
      return err(e.message, 500);
    }
  }
};

module.exports = controller;
