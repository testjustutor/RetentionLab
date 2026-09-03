/**
 * routes/super_admin/settings/table-controls.js
 * Table Controls routes — only call controllers, no logic.
 * Mounted by routes/super_admin/index.js at /settings/table-controls (under /api/super_admin).
 */
const express = require('express');
const router = express.Router();
const controller = require('../../../controllers/super_admin/settings/tableControlsController');

// List all table controls
//   -> GET /api/super_admin/settings/table-controls
router.get('/', controller.list);

// Get controls for one table
//   -> GET /api/super_admin/settings/table-controls/:tableId
router.get('/:tableId', controller.get);

// Set controls for a table
//   -> PUT /api/super_admin/settings/table-controls/:tableId
router.put('/:tableId', controller.update);
router.post('/:tableId', controller.update);

module.exports = router;
