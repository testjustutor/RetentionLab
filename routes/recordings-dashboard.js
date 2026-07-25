/**
 * routes/recordings-dashboard.js
 * Thin route for recordings dashboard.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/recordings/recordingsController');

router.get('/users', requireAuth, (req, res) => ctrl.listUsers(req).then(r => res.status(r.statusCode || 200).json(r)));
router.get('/by-user/:userId', requireAuth, (req, res) => ctrl.getRecordings(req).then(r => res.status(r.statusCode || 200).json(r)));
router.get('/transcripts/:userId', requireAuth, (req, res) => ctrl.getTranscripts(req).then(r => res.status(r.statusCode || 200).json(r)));
router.get('/summaries/:userId', requireAuth, (req, res) => ctrl.getSummaries(req).then(r => res.status(r.statusCode || 200).json(r)));
router.get('/assets/:userId', requireAuth, (req, res) => ctrl.getAssets(req).then(r => res.status(r.statusCode || 200).json(r)));

module.exports = router;