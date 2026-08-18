/**
 * controllers/rubrics/masterRubricController.js
 * Business logic for MASTER rubric categories & indicators (Super Admin only).
 * Uses MasterRubricModel — no admin-specific logic here.
 */
const MasterRubricModel = require('../../../models/super_admin/rubrics/MasterRubricModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const masterRubricController = {
  /** GET /api/rubrics/master-categories — Get all master categories */
  async getMasterCategories(req) {
    try {
      const categories = await MasterRubricModel.getCategories();
      return ok({ categories });
    } catch (e) { return err(e.message); }
  },

  /** GET /api/rubrics/master-indicators — Get all master indicators */
  async getMasterIndicators(req) {
    try {
      const indicators = await MasterRubricModel.getIndicators();
      return ok({ indicators });
    } catch (e) { return err(e.message); }
  },

  /** GET /api/rubrics/master/full — Get full master rubric (categories + indicators) */
  async getFullMaster(req) {
    try {
      const result = await MasterRubricModel.getFullMasterRubric();
      return ok({ categories: result.categories, indicators: result.indicators });
    } catch (e) { return err(e.message); }
  },

  /** POST /api/rubrics/master/categories — Create a new master category */
  async createCategory(req) {
    try {
      const { category_id, name, weight } = req.body;
      if (!category_id || !name) return err('category_id and name are required', 400);
      const result = await MasterRubricModel.createCategory({
        category_id,
        name: name.trim(),
        weight: parseFloat(weight) || 0
      });
      return ok({ result }, 'Master category created');
    } catch (e) { return err(e.message); }
  },

  /** PUT /api/rubrics/master/categories/:id — Update a master category */
  async updateCategory(req) {
    try {
      const categoryId = req.params.id;
      const updates = {};
      if (req.body.name !== undefined) updates.name = req.body.name.trim();
      if (req.body.weight !== undefined) updates.weight = parseFloat(req.body.weight);
      if (req.body.status !== undefined) updates.status = req.body.status;
      const result = await MasterRubricModel.updateCategory(categoryId, updates);
      return ok({ result }, 'Master category updated');
    } catch (e) { return err(e.message); }
  },

  /** DELETE /api/rubrics/master/categories/:id — Delete a master category */
  async deleteCategory(req) {
    try {
      const categoryId = req.params.id;
      const result = await MasterRubricModel.deleteCategory(categoryId);
      if (!result.deleted) return err('Category not found', 404);
      return ok({ message: 'Master category deleted' });
    } catch (e) { return err(e.message); }
  },

  /** POST /api/rubrics/master/indicators — Create a new master indicator */
  async createIndicator(req) {
    try {
      const { indicator_id, category_id, name, type, is_gate, value } = req.body;
      if (!indicator_id || !category_id || !name) return err('indicator_id, category_id, and name are required', 400);
      const result = await MasterRubricModel.createIndicator({
        indicator_id,
        category_id,
        name: name.trim(),
        type: type || 'HUMAN',
        is_gate: is_gate ? 1 : 0,
        value: parseFloat(value) || 1
      });
      return ok({ result }, 'Master indicator created');
    } catch (e) { return err(e.message); }
  },

  /** PUT /api/rubrics/master/indicators/:id — Update a master indicator */
  async updateIndicator(req) {
    try {
      const indicatorId = req.params.id;
      const updates = {};
      if (req.body.name !== undefined) updates.name = req.body.name.trim();
      if (req.body.type !== undefined) updates.type = req.body.type;
      if (req.body.is_gate !== undefined) updates.is_gate = req.body.is_gate ? 1 : 0;
      if (req.body.category_id !== undefined) updates.category_id = req.body.category_id;
      if (req.body.value !== undefined) updates.value = parseFloat(req.body.value);
      if (req.body.status !== undefined) updates.status = req.body.status;
      const result = await MasterRubricModel.updateIndicator(indicatorId, updates);
      return ok({ result }, 'Master indicator updated');
    } catch (e) { return err(e.message); }
  },

  /** DELETE /api/rubrics/master/indicators/:id — Delete a master indicator */
  async deleteIndicator(req) {
    try {
      const indicatorId = req.params.id;
      const result = await MasterRubricModel.deleteIndicator(indicatorId);
      if (!result.deleted) return err('Indicator not found', 404);
      return ok({ message: 'Master indicator deleted' });
    } catch (e) { return err(e.message); }
  }
};

module.exports = masterRubricController;