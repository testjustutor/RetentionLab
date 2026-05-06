const express = require('express');
const router = express.Router();
const MeetingModel = require('../models/MeetingModel');
const botManager = require('../services/shared/botManager');
const { logger } = require('../utils/logger');


// GET /api/bot/instances - Current running instances
router.get('/instances', async (req, res) => {
  try {
    const stats = botManager.getStats();
    res.json(stats);
  } catch (err) {
    logger.error('Bot instances error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bot/start-bot - IMMEDIATE launch (no queue)
router.post('/start-bot', async (req, res) => {
  try {
    const { platform, meetingId, passcode, webhookUrl, meetingUrl } = req.body;
    if (!meetingId || !platform) {
      return res.status(400).json({ error: 'meetingId and platform required' });
    }
    
    const result = await botManager.startBot(platform, meetingId, passcode, webhookUrl, meetingUrl);
    logger.info(`Immediate launch: ${meetingId} → ${result.success ? 'OK' : 'FAILED'}`);
    
    if (result && !result.success) {
      await MeetingModel.updateMeetingStatus(meetingId, 'failed');
    }
    res.json(result);
  } catch (err) {
    logger.error('Immediate start-bot error:', err);
    res.status(500).json({ error: err.message });
  }
});


// GET /api/bot/status/:meetingId
router.get('/status/:meetingId', async (req, res) => {
  try {
    const status = botManager.getStatus(req.params.meetingId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bot/stop/:meetingId
router.delete('/stop/:meetingId', async (req, res) => {
  try {
    const result = await botManager.stopBot(req.params.meetingId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bot/queued - Show queued batches
router.get('/queued', async (req, res) => {
  try {
    const queued = await MeetingModel.getQueuedMeetings ? 
      await MeetingModel.getQueuedMeetings() : [];
    res.json(queued);
  } catch (err) {
    logger.error('Queued list error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

