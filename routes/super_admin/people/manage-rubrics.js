/**
 * routes/super_admin/people/manage-rubrics/index.js
 * Super Admin "Permission Rubrics" (manage-rubrics) routes — only call controllers, no logic.
 * Mounted by routes/super_admin/index.js at /people/manage-rubrics (under /api/super_admin).
 */
const express = require('express');
const router = express.Router();
const controller = require('../../../controllers/super_admin/people/manage-rubrics/manageRubricsController');

// Categories
router.get('/categories', controller.listCategories);
router.post('/categories', controller.createCategory);
router.put('/categories/:id', controller.updateCategory);
router.delete('/categories/:id', controller.deleteCategory);

// Indicators
router.get('/indicators', controller.listIndicators);
router.post('/indicators', controller.createIndicator);
router.put('/indicators/:id', controller.updateIndicator);
router.delete('/indicators/:id', controller.deleteIndicator);

module.exports = router;
