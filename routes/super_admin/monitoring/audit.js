/**
 * routes/super_admin/monitoring/audit.js
 * Audit log routes — only call controllers, no logic.
 * Mounted by routes/super_admin/index.js at /monitoring/audit (under /api/super_admin).
 */
const express = require('express');
const router = express.Router();
const controller = require('../../../controllers/super_admin/monitoring/auditController');

// List recent audit log entries
//   -> GET /api/super_admin/monitoring/audit?limit=100
router.get('/', controller.list);

module.exports = router;
