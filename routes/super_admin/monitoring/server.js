/**
 * routes/super_admin/monitoring/server.js
 * Server monitoring routes — only call controllers, no logic.
 * Mounted by routes/super_admin/index.js at /monitoring/server (under /api/super_admin).
 */
const express = require('express');
const router = express.Router();
const controller = require('../../../controllers/super_admin/monitoring/serverController');

// Server monitoring data
//   -> GET /api/super_admin/monitoring/server
router.get('/', controller.getServer);

module.exports = router;