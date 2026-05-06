/**
 * Meetings API Routes
 * Platform-agnostic meeting management endpoints
 * Supports: Zoom, Microsoft Teams, Google Meet
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const botManager = require('../services/shared/botManager');
const TranscriptModel = require('../models/transcriptModel');
const PlatformFactory = require('../services/platforms/platformFactory');

/**
 * GET /api/meetings - List all active meetings
 */
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
    logger.error('Error listing meetings:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * GET /api/meetings/:meetingId - Get meeting details
 */
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
    logger.error('Error fetching meeting:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * POST /api/meetings/join - Join a meeting with a bot
 * Body: {
 *   platform: 'zoom' | 'teams' | 'google-meet',
 *   meetingId: string,
 *   meetingUrl: string,
 *   passcode?: string,
 *   botName?: string,
 *   webhookUrl?: string
 * }
 */
router.post('/join', async (req, res) => {
  try {
    const { platform, meetingId, meetingUrl, passcode, botName, webhookUrl } = req.body;

    // Validate required fields
    if (!platform || !meetingId || !meetingUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: platform, meetingId, meetingUrl'
      });
    }

    logger.info(`API: Attempting to join ${platform} meeting: ${meetingId}`);

    // Use platform factory to create appropriate bot
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
    logger.error('Error joining meeting:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * POST /api/meetings/:meetingId/leave - Leave a meeting
 */
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
    logger.error('Error leaving meeting:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * GET /api/meetings/:meetingId/status - Get meeting bot status
 */
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
    logger.error('Error getting meeting status:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
