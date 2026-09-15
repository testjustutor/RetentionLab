const express = require('express');
const router = express.Router();
const controller = require('../../../controllers/super_admin/content/videoProcessingController');

router.get('/', controller.getAllVideos);
router.post('/convert', controller.convertAudio);
router.post('/process', controller.processAudio);
router.post('/transcript', controller.generateTranscript);
router.post('/upload', controller.uploadVideo);
router.get('/history', controller.getProcessingHistory);

module.exports = router;

