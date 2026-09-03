/**
 * root/routes/archives.js
 */
const express = require('express');
const router = express.Router();
const archivesController = require('../controllers/archives/archivesController');

// POST /api/archives (accepts JSON body: { from, to, limit, search, instructorId, page, pageSize })
router.post('/', archivesController.getArchives);

// GET /api/archives/instructors - Get list of all instructors for filter dropdown
router.get('/instructors', archivesController.getInstructors);

module.exports = router;