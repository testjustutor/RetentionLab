const express = require('express');
const router = express.Router();
const controller = require('../../../controllers/super_admin/settings/videoProcessingController');

router.get('/', controller.getAllVideos);
router.post('/convert', controller.convertAudio);
router.post('/process', controller.processAudio);
router.get('/history', controller.getProcessingHistory);

module.exports = router;

