/**
 * routes/recordings-dashboard.js
 * Routes for video recordings page with filters
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/recordings/videoRecordingsController');

// GET /api/recordings/videos - Get all recordings with filters
router.get('/videos', requireAuth, (req, res) => ctrl.getRecordings(req).then(r => res.status(r.statusCode || 200).json(r)));

// GET /api/recordings/videos/instructors - Get instructors for filter
router.get('/videos/instructors', requireAuth, (req, res) => ctrl.getInstructors(req).then(r => res.status(r.statusCode || 200).json(r)));

// GET /api/recordings/videos/:meetingId - Get single recording
router.get('/videos/:meetingId', requireAuth, (req, res) => ctrl.getRecordingById(req).then(r => res.status(r.statusCode || 200).json(r)));

module.exports = router;