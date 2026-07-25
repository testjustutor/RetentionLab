/**
 * controllers/rubricController.js
 * Business logic for admin rubric management (categories + indicators).
 * Wraps RubricAdminModel calls — no raw DB queries here.
 */
const RubricAdminModel = require('../../models/rubrics/RubricAdminModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const rubricController = {
  /** GET /api/rubrics/admin/:adminUserId — Get full rubric (categories + indicators) for an admin */
  async getAdminFull(req) {
    try {
      const id = parseInt(req.params.adminUserId);
      const result = await RubricAdminModel.getFullRubricForAdmin(id);
      return ok({ categories: result.categories, indicators: result.indicators });
    } catch (e) { return err(e.message); }
  },

  /** PUT /api/rubrics/admin/:adminUserId/category/:catId — Update category weight */
  async updateCategoryWeight(req) {
    try {
      const adminId = parseInt(req.params.adminUserId);
      const catId = req.params.catId;
      const { weight } = req.body;
      if (weight === undefined) return err('weight is required', 400);
      const result = await RubricAdminModel.updateAdminCategoryWeight(adminId, catId, weight, req.user?.id);
      return ok({ result }, 'Weight updated');
    } catch (e) { return err(e.message); }
  },

  /** PUT /api/rubrics/admin/:adminUserId/indicator/:indId — Update indicator value */
  async updateIndicatorValue(req) {
    try {
      const adminId = parseInt(req.params.adminUserId);
      const indId = req.params.indId;
      const { value } = req.body;
      if (value === undefined) return err('value is required', 400);
      const result = await RubricAdminModel.updateAdminIndicatorValue(adminId, indId, value, req.user?.id);
      return ok({ result }, 'Value updated');
    } catch (e) { return err(e.message); }
  },

  /** POST /api/rubrics/admin/:adminUserId/bulk — Bulk update everything */
  async bulkUpdate(req) {
    try {
      const adminId = parseInt(req.params.adminUserId);
      const { categories, indicators } = req.body;
      const results = {};
      if (categories && Array.isArray(categories)) {
        results.categories = await RubricAdminModel.bulkUpdateAdminCategories(adminId, categories, req.user?.id);
      }
      if (indicators && Array.isArray(indicators)) {
        results.indicators = await RubricAdminModel.bulkUpdateAdminIndicators(adminId, indicators, req.user?.id);
      }
      return ok({ results }, 'Rubric updated');
    } catch (e) { return err(e.message); }
  }
};

module.exports = rubricController;