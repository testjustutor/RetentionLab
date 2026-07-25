/**
 * root/routes/bot.js
 */
const express = require('express');
const router = express.Router();
const MeetingModel = require('../models/meetings/MeetingModel');
const botManager = require('../services/shared/botManager');
const { logger } = require('../utils/logger');
const BotController = require('../controllers/bot/botController');

router.get('/instances', async (req, res) => {
  try {
    const stats = botManager.getStats();
    res.json(stats);
  } catch (err) {
    logger.error('Route(Bot): Bot instances error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/start-bot', async (req, res) => {
  try {
    const { platform, meetingId, passcode, webhookUrl, meetingUrl } = req.body;
    if (!meetingId || !platform) {
      return res.status(400).json({ error: 'meetingId and platform required' });
    }
    
    const result = await botManager.startBot(platform, meetingId, passcode, webhookUrl, meetingUrl);
    logger.info(`Route(Bot): Immediate launch: ${meetingId} → ${result.success ? 'OK' : 'FAILED'}`);
    
    if (result && !result.success) {
      await MeetingModel.updateMeetingStatus(meetingId, 'failed');
    }
    res.json(result);
  } catch (err) {
    logger.error('Route(Bot): Immediate start-bot error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/status/:meetingId', async (req, res) => {
  try {
    const status = botManager.getStatus(req.params.meetingId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/stop/:meetingId', async (req, res) => {
  try {
    const result = await botManager.stopBot(req.params.meetingId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/queued', async (req, res) => {
  try {
    const queued = await MeetingModel.getQueuedMeetings ? 
      await MeetingModel.getQueuedMeetings() : [];
    res.json(queued);
  } catch (err) {
    logger.error('Route(Bot): Queued list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bot - Real-time dashboard data
router.get('/', async (req, res) => {
  try {
    const data = await BotController.getBotDashboard(req, res);
    res.json(data);
  } catch (err) {
    logger.error('Route(bot): Error fetching bot dashboard data:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/monitoring/server - Server performance monitoring
router.get('/monitoring/server', async (req, res) => {
  try {
    const data = await BotController.getBotDashboard(req, res);
    res.json(data);
  } catch (err) {
    logger.error('Route(bot): Error fetching server monitoring data:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;

