const express = require('express');
const router = express.Router();
const MeetingModel = require('../models/MeetingModel');
const botManager = require('../services/shared/botManager');
const { logger } = require('../utils/logger');

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

// GET /api/bot
router.get('/', async (req, res) => {
  try {
    // TODO: Pull live stats from your botManager and DB, e.g.:
    // const workers = botManager.listActiveWorkers();
    // const stats = await botManager.getSystemStats();
    
    const mockBotData = {
      "stats": {
        "status": "ONLINE",
        "activeBots": "3 / 50",
        "gpuCompute": "14%",
        "taskQueue": "0"
      },
      "logs": [
        { "time": "10:41:01", "type": "SYSTEM", "typeColor": "indigo", "message": "Initializing orchestrator core..." }
      ],
      "workers": [
        {
          "id": "Bot 89X-ZM",
          "status": "Recording",
          "statusColor": "emerald",
          "isPulsing": true,
          "platform": "Zoom",
          "meeting": "Product Sync",
          "duration": "04:12",
          "action": "Terminate"
        }
      ]
    };

    res.json(mockBotData);
  } catch (err) {
    logger.error('Route(bot): Error fetching bot dashboard data:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;

