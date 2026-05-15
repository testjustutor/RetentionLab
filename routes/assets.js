const express = require('express');
const router = express.Router();

const { logger } = require('../utils/logger');
const MeetingAssetsModel = require('../models/MeetingAssetsModel');

/**
 * @route   POST /api/assets/wav
 * @desc    Store the processed .wav path for a meeting
 * @body    { meetingId: string, wavPath: string }
 */
router.post('/wav', async (req, res) => {
  try {
    const { meetingId, wavPath } = req.body;

    if (!meetingId || !wavPath) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: meetingId, wavPath'
      });
    }

    // Logic Fix: We use saveAssets instead of updateAssets.
    // Why? saveAssets handles the "ON CONFLICT" logic. 
    // If the record exists, it updates; if not, it creates it.
    await MeetingAssetsModel.saveAssets(meetingId, {
      wav_audio_path: wavPath // Corrected column name
    });

    // Fetch the updated record to return to the caller
    const updatedRow = await MeetingAssetsModel.getAssets(meetingId);

    logger.info(`[Route:Assets] WAV path registered for ${meetingId}`);

    return res.json({
      status: 'success',
      message: 'WAV path stored successfully',
      data: updatedRow
    });
  } catch (err) {
    logger.error('Route(assets): Error storing wav path:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error while saving asset path'
    });
  }
});

/**
 * @route   GET /api/assets/:meetingId
 * @desc    Retrieve all intelligence pointers and paths for a meeting
 */
router.get('/:meetingId', async (req, res) => {
    try {
      const { meetingId } = req.params;
      const assets = await MeetingAssetsModel.getAssets(meetingId);
  
      if (!assets) {
        return res.status(404).json({
          status: 'error',
          message: 'No assets found for this meeting ID'
        });
      }
  
      return res.json({
        status: 'success',
        data: assets
      });
    } catch (err) {
      logger.error('Route(assets): Error retrieving assets:', err);
      return res.status(500).json({ status: 'error', message: err.message });
    }
  });

module.exports = router;