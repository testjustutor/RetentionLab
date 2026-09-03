/**
 * controllers/companiesController.js
 * Company management logic.
 */
const CompaniesModel = require('../../models/companies/CompaniesModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  async list(req, res) {
    try {
      const rows = await CompaniesModel.getAllCompanies();
      if (res) return res.json({ count: rows.length, data: rows });
      return ok({ companies: rows }, 'Companies fetched');
    } catch (e) {
      if (res) return res.status(500).json({ error: e.message });
      return err(e.message, 500);
    }
  }
};

module.exports = controller;
