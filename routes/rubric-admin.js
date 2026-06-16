/**
 * root/routes/rubric-admin.js
 * 
 * Super Admin + Admin Rubric Management Endpoints:
 * - CRUD for master categories and indicators (Super Admin)
 * - Assignment of categories to admin users (creates admin-specific copies)
 * - Admin-specific weightage/value management (Admins update only their copies)
 * - Audit log retrieval
 * - Sync admin copies from master
 */
const express = require('express');
const router = express.Router();
const RubricAdminModel = require('../models/RubricAdminModel');
const { requireAuth, requireRole } = require('../middleware/auth');

// Initialize scoped tables on first load
RubricAdminModel.initTables().catch(err => {
  console.error('Failed to init rubric admin tables:', err.message);
});

// ─── MIDDLEWARE ─────────────────────────────────────────────────────────────

// Attach user info for audit logging
router.use((req, res, next) => {
  res.locals.userId = req.user ? req.user.id : null;
  next();
});

// ─── MASTER CATEGORIES CRUD (Super Admin only) ────────────────────────────

/**
 * GET /api/rubric-admin/categories
 * Get all master categories
 */
router.get('/categories', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const companyId = req.query.company_id ? parseInt(req.query.company_id) : null;
    const rows = await RubricAdminModel.getCategories(companyId);
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/rubric-admin/categories/:category_id
 * Get a single master category
 */
router.get('/categories/:category_id', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const row = await RubricAdminModel.getCategoryById(req.params.category_id);
    if (!row) return res.status(404).json({ error: 'Category not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/rubric-admin/categories
 * Create a new master rubric category
 */
router.post('/categories', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const { category_id, name, weight, company_id } = req.body;
    if (!category_id || !name) {
      return res.status(400).json({ error: 'category_id and name are required' });
    }
    const result = await RubricAdminModel.createCategory({
      category_id,
      name,
      weight: weight !== undefined ? parseFloat(weight) : 0,
      company_id: company_id ? parseInt(company_id) : 0
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/rubric-admin/categories/:category_id
 * Update a master rubric category (with audit log)
 */
router.put('/categories/:category_id', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.weight !== undefined) updates.weight = parseFloat(req.body.weight);
    const result = await RubricAdminModel.updateCategory(req.params.category_id, updates, res.locals.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/rubric-admin/categories/:category_id
 * Delete a master rubric category and all related records (with audit log)
 */
router.delete('/categories/:category_id', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const result = await RubricAdminModel.deleteCategory(req.params.category_id, res.locals.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MASTER INDICATORS CRUD (Super Admin only) ────────────────────────────

/**
 * GET /api/rubric-admin/indicators
 * Get all master indicators
 */
router.get('/indicators', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    let rows;
    if (req.query.category_id) {
      rows = await RubricAdminModel.getIndicatorsByCategory(req.query.category_id);
    } else {
      const companyId = req.query.company_id ? parseInt(req.query.company_id) : null;
      rows = await RubricAdminModel.getIndicators(companyId);
    }
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/rubric-admin/indicators
 * Create a new master rubric indicator (with value)
 */
router.post('/indicators', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const { indicator_id, category_id, name, type, is_gate, value, company_id } = req.body;
    if (!indicator_id || !category_id || !name) {
      return res.status(400).json({ error: 'indicator_id, category_id, and name are required' });
    }
    const result = await RubricAdminModel.createIndicator({
      indicator_id,
      category_id,
      name,
      type: type || 'HUMAN',
      is_gate: is_gate ? 1 : 0,
      value: value !== undefined ? parseFloat(value) : 1,
      company_id: company_id ? parseInt(company_id) : 0
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/rubric-admin/indicators/:indicator_id
 * Update a master rubric indicator (with audit log, includes value)
 */
router.put('/indicators/:indicator_id', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.type !== undefined) updates.type = req.body.type;
    if (req.body.is_gate !== undefined) updates.is_gate = req.body.is_gate ? 1 : 0;
    if (req.body.category_id !== undefined) updates.category_id = req.body.category_id;
    if (req.body.value !== undefined) updates.value = parseFloat(req.body.value);
    const result = await RubricAdminModel.updateIndicator(req.params.indicator_id, updates, res.locals.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/rubric-admin/indicators/:indicator_id
 * Delete a master rubric indicator (with audit log)
 */
router.delete('/indicators/:indicator_id', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const result = await RubricAdminModel.deleteIndicator(req.params.indicator_id, res.locals.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ASSIGNMENTS (Super Admin assigns categories to Admin users) ─────────

/**
 * POST /api/rubric-admin/assign
 * Assign a rubric category to an admin user.
 * Creates admin-specific copies of the category and all its indicators.
 */
router.post('/assign', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const { category_id, admin_user_id } = req.body;
    if (!category_id || !admin_user_id) {
      return res.status(400).json({ error: 'category_id and admin_user_id are required' });
    }
    const result = await RubricAdminModel.assignCategoryToAdmin(category_id, parseInt(admin_user_id), req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/rubric-admin/assign
 * Remove assignment. Deletes admin-specific copies too.
 */
router.delete('/assign', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const { category_id, admin_user_id } = req.query;
    if (!category_id || !admin_user_id) {
      return res.status(400).json({ error: 'category_id and admin_user_id query params required' });
    }
    const result = await RubricAdminModel.unassignCategoryFromAdmin(category_id, parseInt(admin_user_id), req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/rubric-admin/assignments
 * Get all assignments
 */
router.get('/assignments', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    let rows;
    if (req.query.admin_user_id) {
      rows = await RubricAdminModel.getAssignmentsForAdmin(parseInt(req.query.admin_user_id));
    } else if (req.query.category_id) {
      rows = await RubricAdminModel.getAdminsForCategory(req.query.category_id);
    } else {
      rows = await RubricAdminModel.getAllAssignments();
    }
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN-SPECIFIC RUBRIC DATA ENDPOINTS ──────────────────────────────────

/**
 * GET /api/rubric-admin/admin-categories/:admin_user_id
 * Get admin-specific rubric categories (their assigned copies)
 */
router.get('/admin-categories/:admin_user_id', requireAuth, async (req, res) => {
  try {
    const rows = await RubricAdminModel.getAdminCategories(parseInt(req.params.admin_user_id));
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/rubric-admin/admin-indicators/:admin_user_id
 * Get admin-specific rubric indicators
 */
router.get('/admin-indicators/:admin_user_id', requireAuth, async (req, res) => {
  try {
    let rows;
    if (req.query.category_id) {
      rows = await RubricAdminModel.getAdminIndicatorsByCategory(parseInt(req.params.admin_user_id), req.query.category_id);
    } else {
      rows = await RubricAdminModel.getAdminIndicators(parseInt(req.params.admin_user_id));
    }
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/rubric-admin/admin-categories/:admin_user_id/:original_category_id
 * Update admin-specific category weight (only admin's own copy)
 * Body: { weight }
 */
router.put('/admin-categories/:admin_user_id/:original_category_id', requireAuth, async (req, res) => {
  try {
    const { weight } = req.body;
    if (weight === undefined) {
      return res.status(400).json({ error: 'weight is required' });
    }
    const result = await RubricAdminModel.updateAdminCategoryWeight(
      parseInt(req.params.admin_user_id),
      req.params.original_category_id,
      weight,
      req.user.id
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/rubric-admin/admin-indicators/:admin_user_id/:original_indicator_id
 * Update admin-specific indicator value (only admin's own copy)
 * Body: { value }
 */
router.put('/admin-indicators/:admin_user_id/:original_indicator_id', requireAuth, async (req, res) => {
  try {
    const { value } = req.body;
    if (value === undefined) {
      return res.status(400).json({ error: 'value is required' });
    }
    const result = await RubricAdminModel.updateAdminIndicatorValue(
      parseInt(req.params.admin_user_id),
      req.params.original_indicator_id,
      value,
      req.user.id
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/rubric-admin/admin-categories/bulk/:admin_user_id
 * Bulk update admin-specific category weights
 * Body: { categories: [{ original_category_id, weight }] }
 */
router.post('/admin-categories/bulk/:admin_user_id', requireAuth, async (req, res) => {
  try {
    const { categories } = req.body;
    if (!categories || !Array.isArray(categories)) {
      return res.status(400).json({ error: 'categories array is required' });
    }
    const result = await RubricAdminModel.bulkUpdateAdminCategories(
      parseInt(req.params.admin_user_id),
      categories,
      req.user.id
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/rubric-admin/admin-indicators/bulk/:admin_user_id
 * Bulk update admin-specific indicator values
 * Body: { indicators: [{ original_indicator_id, value }] }
 */
router.post('/admin-indicators/bulk/:admin_user_id', requireAuth, async (req, res) => {
  try {
    const { indicators } = req.body;
    if (!indicators || !Array.isArray(indicators)) {
      return res.status(400).json({ error: 'indicators array is required' });
    }
    const result = await RubricAdminModel.bulkUpdateAdminIndicators(
      parseInt(req.params.admin_user_id),
      indicators,
      req.user.id
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/rubric-admin/admin-summary/:admin_user_id
 * Get admin category summary with weighted calculations
 */
router.get('/admin-summary/:admin_user_id', requireAuth, async (req, res) => {
  try {
    const rows = await RubricAdminModel.getAdminCategorySummary(parseInt(req.params.admin_user_id));
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SYNC ───────────────────────────────────────────────────────────────────

/**
 * POST /api/rubric-admin/sync-admin/:admin_user_id
 * Sync admin's rubric copies from master (name/type/is_gate only,
 * preserves admin's custom weight/value)
 */
router.post('/sync-admin/:admin_user_id', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const result = await RubricAdminModel.syncAdminCopiesFromMaster(parseInt(req.params.admin_user_id));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── FULL RUBRIC STRUCTURE ─────────────────────────────────────────────────

/**
 * GET /api/rubric-admin/full/:admin_user_id
 * Get the complete admin-specific rubric structure (categories + indicators)
 * Returns admin's copies with their custom weight/value settings
 */
router.get('/full/:admin_user_id', requireAuth, async (req, res) => {
  try {
    const result = await RubricAdminModel.getFullRubricForAdmin(parseInt(req.params.admin_user_id));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/rubric-admin/master-full
 * Get the complete master rubric structure
 */
router.get('/master-full', requireAuth, async (req, res) => {
  try {
    const result = await RubricAdminModel.getFullMasterRubric();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MEETING REPORTS (with admin-specific data) ───────────────────────────

/**
 * GET /api/rubric-admin/meeting-report/:meetingId
 * Get meeting report with optional admin_id query param for admin-specific data
 */
router.get('/meeting-report/:meetingId', requireAuth, async (req, res) => {
  try {
    const adminUserId = req.query.admin_id ? parseInt(req.query.admin_id) : null;
    const rows = await RubricAdminModel.getMeetingReportWithAdmin(req.params.meetingId, adminUserId);
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AUDIT LOGS ────────────────────────────────────────────────────────────

/**
 * GET /api/rubric-admin/audit-logs
 * Get rubric audit logs, optionally filtered
 * Query params: entity_type, entity_id, admin_user_id, limit
 */
router.get('/audit-logs', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const filters = {};
    if (req.query.entity_type) filters.entity_type = req.query.entity_type;
    if (req.query.entity_id) filters.entity_id = req.query.entity_id;
    if (req.query.admin_user_id) filters.admin_user_id = parseInt(req.query.admin_user_id);
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    const rows = await RubricAdminModel.getAuditLogs(filters);
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/rubric-admin/audit-log
 * Manually record an audit log entry (for future extensibility)
 */
router.post('/audit-log', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const { action, entity_type, entity_id, admin_user_id, old_values, new_values } = req.body;
    if (!action || !entity_type) {
      return res.status(400).json({ error: 'action and entity_type are required' });
    }
    const result = await RubricAdminModel.addAuditLog({
      action,
      entity_type,
      entity_id,
      admin_user_id: admin_user_id ? parseInt(admin_user_id) : null,
      performed_by: req.user.id,
      old_values,
      new_values
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;