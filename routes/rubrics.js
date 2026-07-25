/**
 * routes/rubrics.js
 * Thin route layer for admin rubric management.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/rubrics/rubricController');

function handle(fn) {
  return (req, res) => fn(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r));
}

// Admin's full rubric (categories + indicators)
router.get('/admin/:adminUserId', requireAuth, handle(ctrl.getAdminFull));

// Update category weight
router.put('/admin/:adminUserId/category/:catId', requireAuth, handle(ctrl.updateCategoryWeight));

// Update indicator value
router.put('/admin/:adminUserId/indicator/:indId', requireAuth, handle(ctrl.updateIndicatorValue));

// Bulk update all
router.post('/admin/:adminUserId/bulk', requireAuth, handle(ctrl.bulkUpdate));

module.exports = router;