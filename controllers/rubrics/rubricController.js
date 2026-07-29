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
  },

  /** GET /api/rubrics/master-categories — Get all master categories */
  async getMasterCategories(req) {
    try {
      const categories = await RubricAdminModel.getCategories();
      return ok({ categories });
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

  /** GET /api/rubrics/master-indicators — Get all master indicators */
  async getMasterIndicators(req) {
    try {
      const indicators = await RubricAdminModel.getIndicators();
      return ok({ indicators });
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

  /** POST /api/rubrics/admin/:adminUserId/categories — Create custom category for admin */
  async createAdminCategory(req) {
    try {
      const adminId = parseInt(req.params.adminUserId);
      const { name, weight } = req.body;

      if (!name || !name.trim()) {
        return err('Category name is required', 400);
      }

      const categoryId = 'CUSTOM_' + Date.now();
      await RubricAdminModel.createCategory({
        category_id: categoryId,
        name: name.trim(),
        weight: parseFloat(weight) || 0
      });

      // Assign to admin
      await RubricAdminModel.assignCategoryToAdmin(categoryId, adminId, req.user?.id);

      return ok({ 
        categoryId,
        message: 'Category created successfully'
      }, 201);
    } catch (e) { return err(e.message); }
  },

  /** POST /api/rubrics/admin/:adminUserId/indicators — Create custom indicator for admin */
  async createAdminIndicator(req) {
    try {
      const adminId = parseInt(req.params.adminUserId);
      const { category_id, name, type, is_gate, value, description } = req.body;

      if (!category_id || !name || !name.trim()) {
        return err('Category and indicator name are required', 400);
      }

      const indicatorId = 'IND_' + Date.now();
      await RubricAdminModel.createIndicator({
        indicator_id: indicatorId,
        category_id: category_id,
        name: name.trim(),
        type: type || 'HUMAN',
        is_gate: is_gate ? 1 : 0,
        value: parseFloat(value) || 1
      });

      // Also create in admin_rubric_indicators
      const adminIndicators = await RubricAdminModel.getAdminIndicatorsByCategory(adminId, category_id);
      const adminIndicator = adminIndicators.find(i => i.original_indicator_id === indicatorId);
      
      if (!adminIndicator) {
        await new Promise((resolve, reject) => {
          const { db } = require('../../database/db');
          db.run(
            `INSERT INTO admin_rubric_indicators 
             (original_indicator_id, original_category_id, admin_user_id, category_id, name, type, is_gate, value, description, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
              indicatorId,
              category_id,
              adminId,
              category_id,
              name.trim(),
              type || 'HUMAN',
              is_gate ? 1 : 0,
              parseFloat(value) || 1,
              description || null
            ],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      return ok({ 
        indicatorId,
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

      await new Promise((resolve, reject) => {
        const { db } = require('../../database/db');
        db.run(
          `DELETE FROM admin_rubric_indicators WHERE id = ? AND admin_user_id = ?`,
          [indicatorId, adminId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      return ok({ message: 'Indicator deleted successfully' });
    } catch (e) { return err(e.message); }
  }
};

module.exports = rubricController;