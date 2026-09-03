/**
 * routes/super_admin/reports/meeting-ai-evaluation.js
 * Thin route layer for the Super Admin Meeting AI Evaluation report.
 * Mounted in routes/super_admin/index.js at /reports/meeting-ai-evaluation.
 */
const express = require('express');
const router = express.Router();
const ctrl = require('../../../controllers/super_admin/reports/MeetingAiEvaluationReportController');

function handle(fn) {
  return (req, res) => fn(req, res).then(r => {
    const status = r.statusCode || (r.success === false ? 400 : 200);
    res.status(status).json(r);
  });
}

router.get('/instructors', handle(ctrl.getInstructors));
router.get('/summary', handle(ctrl.getSummary));
router.get('/session/:sessionId', handle(ctrl.getSessionReport));

module.exports = router;