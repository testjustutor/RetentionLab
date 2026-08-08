/**
 * controllers/rubrics/rubricController.js
 * Business logic for ADMIN-specific rubric management (categories + indicators).
 * Uses RubricAdminModel — no master rubric logic here.
 * For master rubric operations, see masterRubricController.js
 */
const RubricAdminModel = require('../../models/rubrics/RubricAdminModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const rubricController = {
  /** POST /api/evaluation/rubrics/list — Get full rubric (categories + indicators) for an admin */
  async getAdminFull(req) {
    try {
      const adminUserId = parseInt(req.body.admin_user_id);
      const result = await RubricAdminModel.getFullRubricForAdmin(adminUserId);
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
  },

  /** GET /api/rubrics/admin/:adminUserId/assigned-ids — Get assigned category IDs for admin */
  async getAssignedCategoryIds(req) {
    try {
      const adminId = parseInt(req.params.adminUserId);
      const ids = await RubricAdminModel.getAdminAssignedCategoryIds(adminId);
      return ok({ assignedIds: ids });
    } catch (e) { return err(e.message); }
  },

  /** POST /api/rubrics/admin/:adminUserId/copy-from-master — Copy selected master categories to admin */
  async copyFromMaster(req) {
    try {
      const adminId = parseInt(req.params.adminUserId);
      const { categoryIds } = req.body;

      if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
        return err('Please select at least one category', 400);
      }

      let copied = 0;
      for (const categoryId of categoryIds) {
        await RubricAdminModel.assignCategoryToAdmin(categoryId, adminId, req.user?.id);
        copied++;
      }

      return ok({ 
        copied,
        message: `Successfully copied ${copied} categor${copied !== 1 ? 'ies' : 'y'}`
      });
    } catch (e) { return err(e.message); }
  },

  /** POST /api/rubrics/admin/:adminUserId/categories — Create custom category for admin (admin tables only) */
  async createAdminCategory(req) {
    try {
      const adminId = parseInt(req.params.adminUserId);
      const { name, weight } = req.body;

      if (!name || !name.trim()) {
        return err('Category name is required', 400);
      }

      const result = await RubricAdminModel.createCustomCategory(adminId, name.trim(), weight);

      return ok({ 
        categoryId: result.categoryId,
        message: 'Category created successfully'
      }, 201);
    } catch (e) { return err(e.message); }
  },

  /** POST /api/rubrics/admin/:adminUserId/indicators — Create custom indicator for admin (admin tables only) */
  async createAdminIndicator(req) {
    try {
      const adminId = parseInt(req.params.adminUserId);
      const { category_id, name, type, is_gate, value, description } = req.body;

      if (!category_id || !name || !name.trim()) {
        return err('Category and indicator name are required', 400);
      }

      const result = await RubricAdminModel.createCustomIndicator(adminId, {
        category_id,
        name: name.trim(),
        type,
        is_gate,
        value,
        description
      });

      return ok({ 
        indicatorId: result.indicatorId,
        message: 'Indicator created successfully'
      }, 201);
    } catch (e) { return err(e.message); }
  },

  /** DELETE /api/rubrics/admin/:adminUserId/categories/:id — Delete admin category */
  async deleteAdminCategory(req) {
    try {
      const adminId = parseInt(req.params.adminUserId);
      const categoryId = req.params.id;
      
      const result = await RubricAdminModel.unassignCategoryFromAdmin(categoryId, adminId, req.user?.id);
      
      if (!result.unassigned) {
        return err('Category not found', 404);
      }

      return ok({ message: 'Category deleted successfully' });
    } catch (e) { return err(e.message); }
  },

  /** DELETE /api/rubrics/admin/:adminUserId/indicators/:id — Delete admin indicator */
  async deleteAdminIndicator(req) {
    try {
      const adminId = parseInt(req.params.adminUserId);
      const indicatorId = req.params.id;

      const result = await RubricAdminModel.deleteAdminIndicator(adminId, indicatorId);

      if (!result.deleted) {
        return err('Indicator not found', 404);
      }

      return ok({ message: 'Indicator deleted successfully' });
    } catch (e) { return err(e.message); }
  },

  // Update indicator status
  async updateIndicatorStatus(req, res) {
    try {
      const adminId = req.user?.id;
      const { indicator_id, status } = req.body;
      
      if (!indicator_id) {
        return res.status(400).json({ success: false, error: 'indicator_id is required' });
      }
      
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status. Must be active or inactive' });
      }

      // Update indicator status via model
      await RubricAdminModel.updateIndicatorStatus(adminId, indicator_id, status);

      // Check if all indicators in this category are inactive
      const categoryRow = await RubricAdminModel.getCategoryIdForIndicator(adminId, indicator_id);

      if (categoryRow) {
        const indicators = await RubricAdminModel.getIndicatorsByCategoryForAdmin(adminId, categoryRow.original_category_id);

        const allInactive = indicators.length > 0 && indicators.every(ind => ind.status === 'inactive');
        
        if (allInactive) {
          // Auto-deactivate category via model
          await RubricAdminModel.updateCategoryStatus(adminId, categoryRow.original_category_id, 'inactive');
        }
      }

      return ok({ message: 'Status updated successfully' });
    } catch (e) { return err(e.message); }
  }
};

module.exports = rubricController;
