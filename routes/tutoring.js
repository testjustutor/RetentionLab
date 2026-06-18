/**
 * root/routes/tutoring.js
 * Consolidated endpoints for tutoring/session quality tables
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');

const SessionMetadataModel = require('../models/SessionMetadataModel');
const SessionQualityReportsModel = require('../models/SessionQualityReportsModel');
const SessionAnalysisModel = require('../models/SessionAnalysisModel');
const StudentLearningImpactModel = require('../models/StudentLearningImpactModel');
const SessionParentSummaryModel = require('../models/SessionParentSummaryModel');
const TeacherCoachingFeedbackModel = require('../models/TeacherCoachingFeedbackModel');
const TeacherBetterAlternativesModel = require('../models/TeacherBetterAlternativesModel');
const NextSessionPlanModel = require('../models/NextSessionPlanModel');
const SessionQualityFlagsModel = require('../models/SessionQualityFlagsModel');
const SessionFinalEvaluationModel = require('../models/SessionFinalEvaluationModel');

// Session metadata
function requireFields(body, fields) {
  const missing = [];
  for (const f of fields) if (body[f] === undefined || body[f] === null) missing.push(f);
  return missing;
}

router.post('/metadata', requireAuth, requireRole('admin','super_admin'), async (req, res) => {
  try {
    const missing = requireFields(req.body, ['meeting_id']);
    if (missing.length) return res.status(400).json({ error: 'Missing fields', missing });
    const result = await SessionMetadataModel.upsert(req.body);
    res.status(201).json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/metadata/:meetingId', requireAuth, async (req, res) => {
  try { const row = await SessionMetadataModel.getByMeeting(req.params.meetingId); res.json(row); } catch (err) { res.status(500).json({ error: err.message }); }
});

// Quality reports
router.post('/reports', requireAuth, requireRole('admin','super_admin'), async (req, res) => {
  try {
    const missing = requireFields(req.body, ['meeting_id']);
    if (missing.length) return res.status(400).json({ error: 'Missing fields', missing });
    const r = await SessionQualityReportsModel.upsert(req.body); res.status(201).json(r);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/reports/:meetingId', requireAuth, async (req, res) => {
  try { const r = await SessionQualityReportsModel.getByMeeting(req.params.meetingId); res.json(r); } catch (err) { res.status(500).json({ error: err.message }); }
});

// Session analysis
router.post('/analysis', requireAuth, requireRole('reviewer','admin','super_admin'), async (req, res) => {
  try {
    const missing = requireFields(req.body, ['meeting_id','analysis_type','description']);
    if (missing.length) return res.status(400).json({ error: 'Missing fields', missing });
    const r = await SessionAnalysisModel.create(req.body); res.status(201).json(r);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/analysis/:meetingId', requireAuth, requireRole('reviewer','admin','super_admin'), async (req, res) => {
  try { const rows = await SessionAnalysisModel.listByMeeting(req.params.meetingId); res.json({ count: rows.length, data: rows }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// Student learning impact
router.post('/impact', requireAuth, requireRole('admin','super_admin'), async (req, res) => { try { const missing = requireFields(req.body, ['meeting_id','impact_area']); if (missing.length) return res.status(400).json({ error: 'Missing fields', missing }); const r = await StudentLearningImpactModel.create(req.body); res.status(201).json(r); } catch (err) { res.status(500).json({ error: err.message }); } });
router.get('/impact/:meetingId', requireAuth, async (req, res) => { try { const rows = await StudentLearningImpactModel.listByMeeting(req.params.meetingId); res.json({ count: rows.length, data: rows }); } catch (err) { res.status(500).json({ error: err.message }); } });

// Parent summary
router.post('/parent-summary', requireAuth, requireRole('admin','super_admin'), async (req, res) => { try { const missing = requireFields(req.body, ['meeting_id']); if (missing.length) return res.status(400).json({ error: 'Missing fields', missing }); const r = await SessionParentSummaryModel.upsert(req.body); res.status(201).json(r); } catch (err) { res.status(500).json({ error: err.message }); } });
router.get('/parent-summary/:meetingId', requireAuth, async (req, res) => { try { const r = await SessionParentSummaryModel.getByMeeting(req.params.meetingId); res.json(r); } catch (err) { res.status(500).json({ error: err.message }); } });

// Teacher coaching
router.post('/coaching', requireAuth, requireRole('reviewer','admin','super_admin'), async (req, res) => { try { const missing = requireFields(req.body, ['meeting_id','feedback_type','area']); if (missing.length) return res.status(400).json({ error: 'Missing fields', missing }); const r = await TeacherCoachingFeedbackModel.create(req.body); res.status(201).json(r); } catch (err) { res.status(500).json({ error: err.message }); } });
router.get('/coaching/:meetingId', requireAuth, requireRole('reviewer','admin','super_admin'), async (req, res) => { try { const rows = await TeacherCoachingFeedbackModel.listByMeeting(req.params.meetingId); res.json({ count: rows.length, data: rows }); } catch (err) { res.status(500).json({ error: err.message }); } });

// Better alternatives
router.post('/better-alternatives', requireAuth, requireRole('reviewer','admin','super_admin'), async (req, res) => { try { const missing = requireFields(req.body, ['meeting_id','transcript_situation','better_alternative']); if (missing.length) return res.status(400).json({ error: 'Missing fields', missing }); const r = await TeacherBetterAlternativesModel.create(req.body); res.status(201).json(r); } catch (err) { res.status(500).json({ error: err.message }); } });
router.get('/better-alternatives/:meetingId', requireAuth, async (req, res) => { try { const rows = await TeacherBetterAlternativesModel.listByMeeting(req.params.meetingId); res.json({ count: rows.length, data: rows }); } catch (err) { res.status(500).json({ error: err.message }); } });

// Next session plan
router.post('/next-plan', requireAuth, requireRole('admin','super_admin'), async (req, res) => { try { const missing = requireFields(req.body, ['meeting_id']); if (missing.length) return res.status(400).json({ error: 'Missing fields', missing }); const r = await NextSessionPlanModel.upsert(req.body); res.status(201).json(r); } catch (err) { res.status(500).json({ error: err.message }); } });
router.get('/next-plan/:meetingId', requireAuth, async (req, res) => { try { const r = await NextSessionPlanModel.getByMeeting(req.params.meetingId); res.json(r); } catch (err) { res.status(500).json({ error: err.message }); } });

// Quality flags
router.post('/flags', requireAuth, requireRole('admin','super_admin'), async (req, res) => { try { const missing = requireFields(req.body, ['meeting_id','flag_description','severity']); if (missing.length) return res.status(400).json({ error: 'Missing fields', missing }); const r = await SessionQualityFlagsModel.create(req.body); res.status(201).json(r); } catch (err) { res.status(500).json({ error: err.message }); } });
router.get('/flags/:meetingId', requireAuth, async (req, res) => { try { const rows = await SessionQualityFlagsModel.listByMeeting(req.params.meetingId); res.json({ count: rows.length, data: rows }); } catch (err) { res.status(500).json({ error: err.message }); } });

// Final evaluation
router.post('/final-eval', requireAuth, requireRole('admin','super_admin'), async (req, res) => { try { const missing = requireFields(req.body, ['meeting_id']); if (missing.length) return res.status(400).json({ error: 'Missing fields', missing }); const r = await SessionFinalEvaluationModel.upsert(req.body); res.status(201).json(r); } catch (err) { res.status(500).json({ error: err.message }); } });
router.get('/final-eval/:meetingId', requireAuth, async (req, res) => { try { const r = await SessionFinalEvaluationModel.getByMeeting(req.params.meetingId); res.json(r); } catch (err) { res.status(500).json({ error: err.message }); } });

module.exports = router;
