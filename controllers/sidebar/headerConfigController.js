/**
 * controllers/headerConfigController.js
 * Header configuration logic.
 */
const { HeaderConfigModel } = require('../../models/header/HeaderConfigModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  async getConfig(req) {
    try {
      const config = await HeaderConfigModel.getFullConfigByRoleId(req.user.role_id);
      return ok({ config }, 'Header config fetched');
    } catch (e) {
      return err(e.message, 500);
    }
  }
};

module.exports = controller;
