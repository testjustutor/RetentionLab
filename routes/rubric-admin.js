/**
 * root/routes/rubric-admin.js
 * 
 * Super Admin + Admin Rubric Management Endpoints
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  requireAdminRubricOwnership,
  requireAdminCategoryOwnership,
  requireAdminIndicatorOwnership,
  requireRubricAssignmentPrivilege
} = require('../middleware/adminRubricAuth');
const rubricAdminController = require('../controllers/rubric-admin/rubricAdminController');

// ─── MIDDLEWARE ─────────────────────────────────────────────────────────────
router.use((req, res, next) => {
  res.locals.userId = req.user ? req.user.id : null;
  next();
});

// ─── MASTER CATEGORIES CRUD (Super Admin only) ────────────────────────────
router.get('/categories', requireAuth, requireRole('super_admin'), rubricAdminController.getCategories);
router.get('/categories/:category_id', requireAuth, requireRole('super_admin'), rubricAdminController.getCategoryById);
router.post('/categories', requireAuth, requireRole('super_admin'), rubricAdminController.createCategory);
router.put('/categories/:category_id', requireAuth, requireRole('super_admin'), rubricAdminController.updateCategory);
router.delete('/categories/:category_id', requireAuth, requireRole('super_admin'), rubricAdminController.deleteCategory);

// ─── MASTER INDICATORS CRUD (Super Admin only) ────────────────────────────
router.get('/indicators', requireAuth, requireRole('super_admin'), rubricAdminController.getIndicators);
router.post('/indicators', requireAuth, requireRole('super_admin'), rubricAdminController.createIndicator);
router.put('/indicators/:indicator_id', requireAuth, requireRole('super_admin'), rubricAdminController.updateIndicator);
router.delete('/indicators/:indicator_id', requireAuth, requireRole('super_admin'), rubricAdminController.deleteIndicator);

// ─── ASSIGNMENTS ───────────────────────────────────────────────────────────
router.post('/assign', requireAuth, requireRole('super_admin'), requireRubricAssignmentPrivilege, rubricAdminController.assignCategory);
router.delete('/assign', requireAuth, requireRole('super_admin'), requireRubricAssignmentPrivilege, rubricAdminController.unassignCategory);
router.get('/assignments', requireAuth, requireRole('super_admin'), rubricAdminController.getAssignments);

// ─── ADMIN-SPECIFIC DATA ───────────────────────────────────────────────────
router.get('/admin-categories/:admin_user_id', requireAuth, requireAdminRubricOwnership, rubricAdminController.getAdminCategories);
router.get('/admin-indicators/:admin_user_id', requireAuth, requireAdminRubricOwnership, rubricAdminController.getAdminIndicators);
router.put('/admin-categories/:admin_user_id/:original_category_id', requireAuth, requireAdminCategoryOwnership, rubricAdminController.updateAdminCategoryWeight);
router.put('/admin-indicators/:admin_user_id/:original_indicator_id', requireAuth, requireAdminIndicatorOwnership, rubricAdminController.updateAdminIndicatorValue);
router.post('/admin-categories/bulk/:admin_user_id', requireAuth, requireAdminCategoryOwnership, rubricAdminController.bulkUpdateAdminCategories);
router.post('/admin-indicators/bulk/:admin_user_id', requireAuth, requireAdminIndicatorOwnership, rubricAdminController.bulkUpdateAdminIndicators);
router.get('/admin-summary/:admin_user_id', requireAuth, requireAdminRubricOwnership, rubricAdminController.getAdminSummary);

// ─── SYNC ───────────────────────────────────────────────────────────────────
router.post('/sync-admin/:admin_user_id', requireAuth, requireRole('super_admin'), rubricAdminController.syncAdmin);

// ─── FULL RUBRIC STRUCTURE ─────────────────────────────────────────────────
router.get('/full/:admin_user_id', requireAuth, requireAdminRubricOwnership, rubricAdminController.getFullRubric);
router.get('/master-full', requireAuth, rubricAdminController.getMasterFull);

// ─── MEETING REPORTS ───────────────────────────────────────────────────────
router.get('/meeting-report/:meetingId', requireAuth, rubricAdminController.getMeetingReport);
router.get('/weighted-score/:meetingId', requireAuth, rubricAdminController.getWeightedScore);

// ─── AUDIT LOGS ────────────────────────────────────────────────────────────
router.get('/audit-logs', requireAuth, requireRole('super_admin'), rubricAdminController.getAuditLogs);
router.post('/audit-log', requireAuth, requireRole('super_admin'), rubricAdminController.addAuditLog);

module.exports = router;