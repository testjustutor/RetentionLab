/**
 * routes/content-dashboard.js
 * Routes for video content page with filters
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/recordings/videoRecordingsController');
const recordingsCtrl = require('../controllers/recordings/recordingsController');

// POST /api/content/videos - Get all recordings with filters (POST with filters in body)
router.post('/videos', requireAuth, (req, res) => ctrl.getRecordings(req).then(r => res.status(r.statusCode || 200).json(r)));

// GET /api/content/videos/instructors - Get instructors for filter
router.get('/videos/instructors', requireAuth, (req, res) => ctrl.getInstructors(req).then(r => res.status(r.statusCode || 200).json(r)));

// GET /api/content/instructors - Get instructors for filter (generic endpoint for all content pages)
router.get('/instructors', requireAuth, (req, res) => ctrl.getInstructors(req).then(r => res.status(r.statusCode || 200).json(r)));

// GET /api/content/videos/:meetingId - Get single recording
router.get('/videos/:meetingId', requireAuth, (req, res) => ctrl.getRecordingById(req).then(r => res.status(r.statusCode || 200).json(r)));

// POST /api/content/audio - Get recordings by user with filters (POST with filters in body)
router.post('/audio', requireAuth, (req, res) => recordingsCtrl.getRecordings(req).then(r => res.status(r.statusCode || 200).json(r)));

// POST /api/content/transcripts - Get transcripts by user with filters (POST with filters in body)
router.post('/transcripts', requireAuth, (req, res) => recordingsCtrl.getTranscripts(req).then(r => res.status(r.statusCode || 200).json(r)));

// POST /api/content/summaries - Get summaries by user with filters (POST with filters in body)
router.post('/summaries', requireAuth, (req, res) => recordingsCtrl.getSummaries(req).then(r => res.status(r.statusCode || 200).json(r)));

module.exports = router;
