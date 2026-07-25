/**
 * root/routes/tutoring.js
 * Thin route layer for Session Quality & Impact Report endpoints.
 * All business logic lives in controllers/sessionQualityController.js.
 *
 * Pattern: handle(fn) calls fn(req) and routes use r.statusCode / r.success
 * to determine HTTP response codes, matching evaluation-reports.js style.
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/session-quality/sessionQualityController');

// ── Route handler wrapper (matches project convention) ──────────────────────
function handle(fn) {
  return (req, res) => fn(req).then(r =>
    res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r)
  );
}

// ── SNAPSHOT / METADATA ─────────────────────────────────────────────────────
router.post('/metadata', requireAuth, requireRole('admin','super_admin'), handle(ctrl.upsertMetadata));

// ── RUBRIC REPORTS ──────────────────────────────────────────────────────────
router.post('/reports', requireAuth, requireRole('admin','super_admin'), handle(ctrl.upsertReport));

// ── INDIVIDUAL SECTIONS (single-row-per-session) ────────────────────────────
router.post('/analysis', requireAuth, handle(ctrl.getAnalysis));
router.post('/impact', requireAuth, handle(ctrl.getLearningImpact));
router.post('/parent-summary', requireAuth, handle(ctrl.getParentSummary));
router.post('/coaching', requireAuth, handle(ctrl.getCoachingFeedback));
router.post('/better-alternatives', requireAuth, handle(ctrl.getBetterAlternatives));
router.post('/next-plan', requireAuth, handle(ctrl.getNextPlan));
router.post('/flags', requireAuth, handle(ctrl.getQualityFlags));
router.post('/final-eval', requireAuth, handle(ctrl.getFinalEvaluation));

// ── GENERATION PIPELINE ─────────────────────────────────────────────────────
router.post('/report/:meetingId/generate', requireAuth, requireRole('admin','super_admin'), handle(ctrl.generateReport));

// ── AGGREGATE REPORT ────────────────────────────────────────────────────────
router.post('/report', requireAuth, handle(ctrl.getAggregateReport));

// ── DASHBOARD & FILTERS ─────────────────────────────────────────────────────
router.post('/dashboard', requireAuth, handle(ctrl.getDashboard));
router.post('/filters/options', requireAuth, handle(ctrl.getFilterOptions));

// ── CASCADING FILTERS ───────────────────────────────────────────────────────
const sessionQualityFilterController = require('../controllers/session-quality/sessionQualityFilterController');
router.post('/filters/instructors', requireAuth, handle(sessionQualityFilterController.getInstructors));
router.post('/filters/boards', requireAuth, handle(sessionQualityFilterController.getBoards));
router.post('/filters/classes', requireAuth, handle(sessionQualityFilterController.getClasses));
router.post('/filters/subjects', requireAuth, handle(sessionQualityFilterController.getSubjects));
router.post('/filters/meetings', requireAuth, handle(sessionQualityFilterController.getMeetings));
router.post('/filters/sessions', requireAuth, handle(sessionQualityFilterController.getSessions));

module.exports = router;
