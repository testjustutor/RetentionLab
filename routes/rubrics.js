/**
 * routes/rubrics.js
 * Thin route layer for admin rubric management.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/rubrics/rubricController');
const masterCtrl = require('../controllers/rubrics/masterRubricController');

function handle(fn) {
  return (req, res) => fn(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r));
}

// ─── Admin-Specific Routes (uses rubricController) ───

// Admin's full rubric (categories + indicators)
router.post('/list', requireAuth, handle(ctrl.getAdminFull));

// Update category weight
router.put('/admin/:adminUserId/category/:catId', requireAuth, handle(ctrl.updateCategoryWeight));

// Update indicator value
router.put('/admin/:adminUserId/indicator/:indId', requireAuth, handle(ctrl.updateIndicatorValue));

// Bulk update all
router.post('/admin/:adminUserId/bulk', requireAuth, handle(ctrl.bulkUpdate));

// Assigned category IDs for admin
router.get('/admin/:adminUserId/assigned-ids', requireAuth, handle(ctrl.getAssignedCategoryIds));

// Copy from master
router.post('/admin/:adminUserId/copy-from-master', requireAuth, handle(ctrl.copyFromMaster));

// Create custom category
router.post('/admin/:adminUserId/categories', requireAuth, handle(ctrl.createAdminCategory));

// Create custom indicator
router.post('/admin/:adminUserId/indicators', requireAuth, handle(ctrl.createAdminIndicator));

// Delete admin category
router.delete('/admin/:adminUserId/categories/:id', requireAuth, handle(ctrl.deleteAdminCategory));

// Delete admin indicator
router.delete('/admin/:adminUserId/indicators/:id', requireAuth, handle(ctrl.deleteAdminIndicator));

// Update indicator status
router.post('/my_rubrics/status', requireAuth, handle(ctrl.updateIndicatorStatus));

// ─── Master Rubric Routes (uses masterRubricController) ───

// Master categories
router.get('/master-categories', requireAuth, handle(masterCtrl.getMasterCategories));

// Master indicators
router.get('/master-indicators', requireAuth, handle(masterCtrl.getMasterIndicators));

module.exports = router;
