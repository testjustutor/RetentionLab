/**
 * root/routes/audit.js
 */
const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit/auditController');

/**
 * @route   POST /api/audit/process/:meetingId
 * @desc    Triggers the Python Engine (Media -> AI -> Rubric)
 */
router.post('/process/:meetingId', auditController.processAudit);

/**
 * @route   GET /api/audit/db-results/:meetingId
 * @desc    Retrieves per-indicator AI audit results from the database
 */
router.get('/db-results/:meetingId', auditController.getDbResults);

/**
 * @route   GET /api/audit/report/:meetingId
 * @desc    Retrieves an existing audit report from storage
 */
router.get('/report/:meetingId', auditController.getReport);

/**
 * @route   GET /api/audit
 * @desc    Fetch audit logs with filtering
 */
router.get('/', auditController.getLogs);

module.exports = router;