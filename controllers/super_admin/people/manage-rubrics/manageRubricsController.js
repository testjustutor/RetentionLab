/**
 * controllers/super_admin/people/manage-rubrics/manageRubricsController.js
 * Permission Rubrics (manage-rubrics) controllers — no business logic/SQL,
 * all data access goes through ManageRubricsModel.
 */
const ManageRubricsModel = require('../../../../models/super_admin/people/manage-rubrics/ManageRubricsModel');

const controller = {
  // ── Categories ──────────────────────────────────────────────────────────
  async listCategories(req, res) {
    try {
      const rows = await ManageRubricsModel.listCategories();
      return res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
      console.error('[ManageRubrics] listCategories error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  async createCategory(req, res) {
    try {
      const { category_id, name, weight, status } = req.body || {};
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Category name is required' });
      }
      const created = await ManageRubricsModel.createCategory({ category_id, name, weight, status });
      return res.status(201).json({ success: true, data: created, message: 'Category created' });
    } catch (err) {
      console.error('[ManageRubrics] createCategory error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  async updateCategory(req, res) {
    try {
      const result = await ManageRubricsModel.updateCategory(req.params.id, req.body || {});
      return res.json({ success: true, data: result, message: 'Category updated' });
    } catch (err) {
      console.error('[ManageRubrics] updateCategory error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  async deleteCategory(req, res) {
    try {
      await ManageRubricsModel.deleteCategory(req.params.id);
      return res.json({ success: true, message: 'Category deleted' });
    } catch (err) {
      console.error('[ManageRubrics] deleteCategory error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // ── Indicators ──────────────────────────────────────────────────────────
  async listIndicators(req, res) {
    try {
      const rows = await ManageRubricsModel.listIndicators();
      return res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
      console.error('[ManageRubrics] listIndicators error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  async createIndicator(req, res) {
    try {
      const { indicator_id, category_id, name, type, is_gate, value, status } = req.body || {};
      if (!category_id || !name || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Category and indicator name are required' });
      }
      const created = await ManageRubricsModel.createIndicator({ indicator_id, category_id, name, type, is_gate, value, status });
      return res.status(201).json({ success: true, data: created, message: 'Indicator created' });
    } catch (err) {
      console.error('[ManageRubrics] createIndicator error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  async updateIndicator(req, res) {
    try {
      const result = await ManageRubricsModel.updateIndicator(req.params.id, req.body || {});
      return res.json({ success: true, data: result, message: 'Indicator updated' });
    } catch (err) {
      console.error('[ManageRubrics] updateIndicator error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  async deleteIndicator(req, res) {
    try {
      await ManageRubricsModel.deleteIndicator(req.params.id);
      return res.json({ success: true, message: 'Indicator deleted' });
    } catch (err) {
      console.error('[ManageRubrics] deleteIndicator error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
};

module.exports = controller;
