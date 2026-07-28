/**
 * root/routes/bot.js
 */
const express = require('express');
const router = express.Router();
const BotController = require('../controllers/bot/botController');

router.get('/instances', BotController.getInstances);
router.post('/start-bot', BotController.startBot);
router.get('/status/:meetingId', BotController.getStatus);
router.delete('/stop/:meetingId', BotController.stopBot);
router.get('/queued', BotController.getQueued);
router.get('/', BotController.getBotDashboard);
router.get('/monitoring/server', BotController.getBotDashboard);

module.exports = router;

