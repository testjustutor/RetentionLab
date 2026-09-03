const express = require('express');
const router = express.Router();
const controller = require('../../../controllers/super_admin/settings/deepgramProcessingController');

// SEPARATE Deepgram pipeline endpoints (/api/super_admin/settings/deepgram-processing)
router.get('/', controller.getAllVideos);
router.post('/convert', controller.convertAudio);
router.post('/process', controller.processAudio);
router.get('/history', controller.getHistory);

module.exports = router;
