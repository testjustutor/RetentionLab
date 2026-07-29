/**
 * controllers/admin/adminRubricController.js
 * Business logic for admin rubric management
 */
const AdminRubricModel = require('../../models/rubrics/RubricAdminModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /**
   * GET /api/admin/rubrics/master-categories
   * Get all master rubric categories
   */
  async getMasterCategories(req) {
    try {
      const categories = await AdminRubricModel.getMasterCategories();
      return ok({ categories });
    } catch (e) {
      return err(e.message, 500);
    }
  },

  /**
   * GET /api/admin/rubrics/master-indicators
   * Get all master rubric indicators
   */
  async getMasterIndicators(req) {
    try {
      const categoryId = req.query.categoryId || null;
      const indicators = await AdminRubricModel.getMasterIndicators(categoryId);
      return ok({ indicators });
    } catch (e) {
      return err(e.message, 500);
    }
  },

  /**
   * GET /api/admin/rubrics/categories
   * Get admin's rubric categories
   */
  async getAdminCategories(req) {
    try {
      const categories = await AdminRubricModel.getAdminCategories(req.user.id);
      return ok({ categories });
    } catch (e) {
      return err(e.message, 500);
    }
  },

  /**
   * GET /api/admin/rubrics/indicators
   * Get admin's rubric indicators
   */
  async getAdminIndicators(req) {
    try {
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId) : null;
      const indicators = await AdminRubricModel.getAdminIndicators(req.user.id, categoryId);
      return ok({ indicators });
    } catch (e) {
      return err(e.message, 500);
    }
  },

  /**
   * POST /api/admin/rubrics/copy-from-master
   * Copy selected master categories to admin
   */
  async copyFromMaster(req) {
    try {
      const { categoryIds } = req.body;

      if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
        return err('Please select at least one category', 400);
      }

      const copied = await AdminRubricModel.copyMasterCategories(req.user.id, categoryIds);

      return ok({ 
        copied,
        message: `Successfully copied ${copied} categor${copied !== 1 ? 'ies' : 'y'}`
      });
    } catch (e) {
      return err(e.message, 500);
    }
  },

  /**
   * POST /api/admin/rubrics/categories
   * Create custom category for admin
   */
  async createCategory(req) {
    try {
      const { name, weight } = req.body;

      if (!name || !name.trim()) {
        return err('Category name is required', 400);
      }

      const categoryId = await AdminRubricModel.createAdminCategory(req.user.id, {
        name: name.trim(),
        weight: parseFloat(weight) || 0
      });

      return ok({ 
        categoryId,
        message: 'Category created successfully'
      }, 201);
    } catch (e) {
      return err(e.message, 500);
    }
  },

  /**
   * POST /api/admin/rubrics/indicators
   * Create custom indicator for admin
   */
  async createIndicator(req) {
    try {
      const { category_id, name, type, is_gate, value, description } = req.body;

      if (!category_id || !name || !name.trim()) {
        return err('Category and indicator name are required', 400);
      }

      const indicatorId = await AdminRubricModel.createAdminIndicator({
        original_category_id: category_id,
        admin_user_id: req.user.id,
        category_id: parseInt(category_id),
        name: name.trim(),
        type: type || 'HUMAN',
        is_gate: is_gate ? 1 : 0,
        value: parseFloat(value) || 1,
        description: description || null
      });

      return ok({ 
        indicatorId,
        message: 'Indicator created successfully'
      }, 201);
    } catch (e) {
      return err(e.message, 500);
    }
  },

  /**
   * DELETE /api/admin/rubrics/categories/:id
   * Delete admin category
   */
  async deleteCategory(req) {
    try {
      const categoryId = parseInt(req.params.id);
      if (!categoryId) return err('Category ID required', 400);

      const deleted = await AdminRubricModel.deleteAdminCategory(categoryId, req.user.id);

      if (!deleted) {
        return err('Category not found or already deleted', 404);
      }

      return ok({ message: 'Category deleted successfully' });
    } catch (e) {
      return err(e.message, 500);
    }
  },

  /**
   * DELETE /api/admin/rubrics/indicators/:id
   * Delete admin indicator
   */
  async deleteIndicator(req) {
    try {
      const indicatorId = parseInt(req.params.id);
      if (!indicatorId) return err('Indicator ID required', 400);

      const deleted = await AdminRubricModel.deleteAdminIndicator(indicatorId, req.user.id);

      if (!deleted) {
        return err('Indicator not found or already deleted', 404);
      }

      return ok({ message: 'Indicator deleted successfully' });
    } catch (e) {
      return err(e.message, 500);
    }
  }
};

module.exports = controller;