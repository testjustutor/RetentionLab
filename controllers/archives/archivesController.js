/**
 * controllers/archivesController.js
 * Archive management logic.
 */
const ArchivesModel = require('../../models/archives/ArchivesModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  async list(req) {
    try {
      const rows = await ArchivesModel.getAll();
      return ok({ archives: rows }, 'Archives fetched');
    } catch (e) {
      return err(e.message, 500);
    }
  }
};

module.exports = controller;
