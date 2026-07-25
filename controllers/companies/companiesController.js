/**
 * controllers/companiesController.js
 * Company management logic.
 */
const CompaniesModel = require('../../models/companies/CompaniesModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  async list(req) {
    try {
      const rows = await CompaniesModel.getAllCompanies();
      return ok({ companies: rows }, 'Companies fetched');
    } catch (e) {
      return err(e.message, 500);
    }
  }
};

module.exports = controller;
