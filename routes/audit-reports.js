/**
 * routes/audit-reports.js
 * Thin route layer for audit report data.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/auditReportController');

function handle(fn) {
  return (req, res) => fn(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r));
}

router.get('/summary', requireAuth, handle(ctrl.getSummary));
router.get('/detail/:type', requireAuth, handle(ctrl.getByType));

module.exports = router;