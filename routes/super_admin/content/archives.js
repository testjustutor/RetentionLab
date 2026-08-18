/**
 * routes/super_admin/content/archives/index.js
 * Super Admin "Archives & Transcripts" routes — only call controllers, no logic.
 * Mounted by routes/super_admin/index.js at /content/archives (under /api/super_admin).
 */
const express = require('express');
const router = express.Router();
const controller = require('../../../controllers/super_admin/content/archives/manageArchivesController');

// List completed meetings with transcripts (+ filters/pagination)
//   -> POST /api/super_admin/content/archives/meetings
router.post('/meetings', controller.getMeetings);

// Instructor dropdown
//   -> GET /api/super_admin/content/archives/instructors
router.get('/instructors', controller.getInstructors);

module.exports = router;
