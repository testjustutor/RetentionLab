/**
 * root/routes/meetings.js
 */
const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
const botManager = require('../services/shared/botManager');
const TranscriptModel = require('../models/transcriptModel');
const PlatformFactory = require('../services/platforms/platformFactory');

router.get('/', (req, res) => {
  try {
    const meetings = botManager.listInstances();
    res.json({
      status: 'success',
      data: {
        total: meetings.length,
        meetings
      }
    });
  } catch (err) {
    logger.error('Route(meeting): Error listing meetings:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * GET /api/meetings/list
 * List all meetings from the database with their details for reports
 */
router.get('/list', requireAuth, async (req, res) => {
  try {
    const { db } = require('../database/db');
    const days = parseInt(req.query.days) || 90;

    const sql = `
      SELECT m.*,
             CONCAT(u.first_name, ' ', u.last_name) as owner_name,
             u.email as owner_email
      FROM meetings m
      LEFT JOIN users u ON u.id = m.owner_user_id
      WHERE m.start_time >= DATE_SUB(NOW(), INTERVAL ? DAY) OR m.start_time IS NULL
      ORDER BY m.start_time DESC
      LIMIT 100
    `;

    const meetings = await new Promise((resolve, reject) => {
      db.all(sql, [days], (err, rows) => err ? reject(err) : resolve(rows || []));
    });

    res.json({ meetings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:meetingId', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const session = await TranscriptModel.getSessionByMeetingId(meetingId);
    
    if (!session) {
      return res.status(404).json({ status: 'error', message: 'Meeting not found' });
    }

    res.json({
      status: 'success',
      data: session
    });
  } catch (err) {
    logger.error('Route(meeting): Error fetching meeting:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/join', async (req, res) => {
  try {
    const { platform, meetingId, meetingUrl, passcode, botName, webhookUrl } = req.body;

    if (!platform || !meetingId || !meetingUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: platform, meetingId, meetingUrl'
      });
    }

    logger.info(`Route(meeting): API: Attempting to join ${platform} meeting: ${meetingId}`);

    const result = await PlatformFactory.startBot({
      platform,
      meetingId,
      meetingUrl,
      passcode,
      botName: botName || `Bot-${platform}`,
      webhookUrl
    });

    if (result.success) {
      res.status(200).json({
        status: 'success',
        data: {
          meetingId: result.meetingId,
          sessionId: result.sessionId,
          platform,
          status: 'joining'
        }
      });
    } else {
      res.status(400).json({
        status: 'error',
        message: result.error || 'Failed to join meeting'
      });
    }
  } catch (err) {
    logger.error('Route(meeting): Error joining meeting:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});


router.post('/:meetingId/leave', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const result = await botManager.stopBot(meetingId);

    if (result.success) {
      res.json({
        status: 'success',
        message: `Bot left meeting ${meetingId}`,
        data: result
      });
    } else {
      res.status(400).json({
        status: 'error',
        message: result.error || 'Failed to leave meeting'
      });
    }
  } catch (err) {
    logger.error('Route(meeting): Error leaving meeting:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/:meetingId/status', (req, res) => {
  try {
    const { meetingId } = req.params;
    const instance = botManager.getInstance(meetingId);

    if (!instance) {
      return res.status(404).json({ status: 'error', message: 'Bot not found for this meeting' });
    }

    res.json({
      status: 'success',
      data: {
        meetingId,
        botStatus: instance.status,
        duration: instance.startedAt ? Math.floor((Date.now() - instance.startedAt) / 1000) : 0,
        startedAt: instance.startedAt,
        platform: instance.config.platform
      }
    });
  } catch (err) {
    logger.error('Route(meeting): Error getting meeting status:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
