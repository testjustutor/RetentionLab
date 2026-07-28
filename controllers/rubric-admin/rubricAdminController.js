/**
 * controllers/rubric-admin/rubricAdminController.js
 * Rubric admin controller
 */
const RubricAdminModel = require('../../models/rubrics/RubricAdminModel');

const controller = {
  async getCategories(req, res) {
    try {
      const companyId = req.query.company_id ? parseInt(req.query.company_id) : null;
      const rows = await RubricAdminModel.getCategories(companyId);
      res.json({ count: rows.length, data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async getCategoryById(req, res) {
    try {
      const row = await RubricAdminModel.getCategoryById(req.params.category_id);
      if (!row) return res.status(404).json({ error: 'Category not found' });
      res.json(row);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async createCategory(req, res) {
    try {
      const { category_id, name, weight, company_id } = req.body;
      if (!category_id || !name) return res.status(400).json({ error: 'category_id and name are required' });
      const result = await RubricAdminModel.createCategory({ category_id, name, weight: weight !== undefined ? parseFloat(weight) : 0, company_id: company_id ? parseInt(company_id) : 0 });
      res.status(201).json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async updateCategory(req, res) {
    try {
      const updates = {};
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.weight !== undefined) updates.weight = parseFloat(req.body.weight);
      const result = await RubricAdminModel.updateCategory(req.params.category_id, updates, res.locals.userId);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async deleteCategory(req, res) {
    try {
      const result = await RubricAdminModel.deleteCategory(req.params.category_id, res.locals.userId);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async getIndicators(req, res) {
    try {
      let rows;
      if (req.query.category_id) rows = await RubricAdminModel.getIndicatorsByCategory(req.query.category_id);
      else { const companyId = req.query.company_id ? parseInt(req.query.company_id) : null; rows = await RubricAdminModel.getIndicators(companyId); }
      res.json({ count: rows.length, data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async createIndicator(req, res) {
    try {
      const { indicator_id, category_id, name, type, is_gate, value, company_id } = req.body;
      if (!indicator_id || !category_id || !name) return res.status(400).json({ error: 'indicator_id, category_id, and name are required' });
      const result = await RubricAdminModel.createIndicator({ indicator_id, category_id, name, type: type || 'HUMAN', is_gate: is_gate ? 1 : 0, value: value !== undefined ? parseFloat(value) : 1, company_id: company_id ? parseInt(company_id) : 0 });
      res.status(201).json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async updateIndicator(req, res) {
    try {
      const updates = {};
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.type !== undefined) updates.type = req.body.type;
      if (req.body.is_gate !== undefined) updates.is_gate = req.body.is_gate ? 1 : 0;
      if (req.body.category_id !== undefined) updates.category_id = req.body.category_id;
      if (req.body.value !== undefined) updates.value = parseFloat(req.body.value);
      const result = await RubricAdminModel.updateIndicator(req.params.indicator_id, updates, res.locals.userId);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async deleteIndicator(req, res) {
    try {
      const result = await RubricAdminModel.deleteIndicator(req.params.indicator_id, res.locals.userId);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async assignCategory(req, res) {
    try {
      const { category_id, admin_user_id } = req.body;
      if (!category_id || !admin_user_id) return res.status(400).json({ error: 'category_id and admin_user_id are required' });
      const result = await RubricAdminModel.assignCategoryToAdmin(category_id, parseInt(admin_user_id), req.user.id);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async unassignCategory(req, res) {
    try {
      const { category_id, admin_user_id } = req.query;
      if (!category_id || !admin_user_id) return res.status(400).json({ error: 'category_id and admin_user_id query params required' });
      const result = await RubricAdminModel.unassignCategoryFromAdmin(category_id, parseInt(admin_user_id), req.user.id);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async getAssignments(req, res) {
    try {
      let rows;
      if (req.query.admin_user_id) rows = await RubricAdminModel.getAssignmentsForAdmin(parseInt(req.query.admin_user_id));
      else if (req.query.category_id) rows = await RubricAdminModel.getAdminsForCategory(req.query.category_id);
      else rows = await RubricAdminModel.getAllAssignments();
      res.json({ count: rows.length, data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async getAdminCategories(req, res) {
    try {
      const rows = await RubricAdminModel.getAdminCategories(parseInt(req.params.admin_user_id));
      res.json({ count: rows.length, data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async getAdminIndicators(req, res) {
    try {
      let rows;
      if (req.query.category_id) rows = await RubricAdminModel.getAdminIndicatorsByCategory(parseInt(req.params.admin_user_id), req.query.category_id);
      else rows = await RubricAdminModel.getAdminIndicators(parseInt(req.params.admin_user_id));
      res.json({ count: rows.length, data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async updateAdminCategoryWeight(req, res) {
    try {
      const { weight } = req.body;
      if (weight === undefined) return res.status(400).json({ error: 'weight is required' });
      const result = await RubricAdminModel.updateAdminCategoryWeight(parseInt(req.params.admin_user_id), req.params.original_category_id, weight, req.user.id);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async updateAdminIndicatorValue(req, res) {
    try {
      const { value } = req.body;
      if (value === undefined) return res.status(400).json({ error: 'value is required' });
      const result = await RubricAdminModel.updateAdminIndicatorValue(parseInt(req.params.admin_user_id), req.params.original_indicator_id, value, req.user.id);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async bulkUpdateAdminCategories(req, res) {
    try {
      const { categories } = req.body;
      if (!categories || !Array.isArray(categories)) return res.status(400).json({ error: 'categories array is required' });
      const result = await RubricAdminModel.bulkUpdateAdminCategories(parseInt(req.params.admin_user_id), categories, req.user.id);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async bulkUpdateAdminIndicators(req, res) {
    try {
      const { indicators } = req.body;
      if (!indicators || !Array.isArray(indicators)) return res.status(400).json({ error: 'indicators array is required' });
      const result = await RubricAdminModel.bulkUpdateAdminIndicators(parseInt(req.params.admin_user_id), indicators, req.user.id);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async getAdminSummary(req, res) {
    try {
      const rows = await RubricAdminModel.getAdminCategorySummary(parseInt(req.params.admin_user_id));
      res.json({ count: rows.length, data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async syncAdmin(req, res) {
    try {
      const result = await RubricAdminModel.syncAdminCopiesFromMaster(parseInt(req.params.admin_user_id));
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async getFullRubric(req, res) {
    try {
      const result = await RubricAdminModel.getFullRubricForAdmin(parseInt(req.params.admin_user_id));
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async getMasterFull(req, res) {
    try {
      const result = await RubricAdminModel.getFullMasterRubric();
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async getMeetingReport(req, res) {
    try {
      let adminUserId = null;
      const currentUserId = req.user?.id;
      const currentUserRole = req.user?.role_name;
      const queryAdminId = req.query.admin_id ? parseInt(req.query.admin_id) : null;
      if (queryAdminId) {
        if (currentUserRole === 'admin' && currentUserId !== queryAdminId) return res.status(403).json({ error: 'Forbidden' });
        adminUserId = queryAdminId;
      } else if (currentUserRole === 'admin') adminUserId = currentUserId;
      const rows = await RubricAdminModel.getMeetingReportWithAdmin(req.params.meetingId, adminUserId);
      res.json({ count: rows.length, data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async getWeightedScore(req, res) {
    try {
      let adminUserId = null;
      const currentUserId = req.user?.id;
      const currentUserRole = req.user?.role_name;
      const queryAdminId = req.query.admin_id ? parseInt(req.query.admin_id) : null;
      if (queryAdminId) {
        if (currentUserRole === 'admin' && currentUserId !== queryAdminId) return res.status(403).json({ error: 'Forbidden' });
        adminUserId = queryAdminId;
      } else if (currentUserRole === 'admin') adminUserId = currentUserId;
      if (!adminUserId) return res.status(400).json({ error: 'admin_id is required for super admins' });
      const result = await RubricAdminModel.calculateAdminWeightedScore(req.params.meetingId, adminUserId);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async getAuditLogs(req, res) {
    try {
      const filters = {};
      if (req.query.entity_type) filters.entity_type = req.query.entity_type;
      if (req.query.entity_id) filters.entity_id = req.query.entity_id;
      if (req.query.admin_user_id) filters.admin_user_id = parseInt(req.query.admin_user_id);
      if (req.query.limit) filters.limit = parseInt(req.query.limit);
      const rows = await RubricAdminModel.getAuditLogs(filters);
      res.json({ count: rows.length, data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async addAuditLog(req, res) {
    try {
      const { action, entity_type, entity_id, admin_user_id, old_values, new_values } = req.body;
      if (!action || !entity_type) return res.status(400).json({ error: 'action and entity_type are required' });
      const result = await RubricAdminModel.addAuditLog({ action, entity_type, entity_id, admin_user_id: admin_user_id ? parseInt(admin_user_id) : null, performed_by: req.user.id, old_values, new_values });
      res.status(201).json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
};

module.exports = controller;