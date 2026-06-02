const fs = require('fs');
const path = require('path');
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
// GET /api/assets/folder/:folderName
router.get('/folder/:folderName', async (req, res) => {
  try {
    const { folderName } = req.params;
    logger.info(`Route(assets): Fetching assets for folder: ${folderName}`);

    const storageRoot = path.resolve(__dirname, '..', 'storage');
    const targetPath = path.resolve(storageRoot, folderName);
    const relative = path.relative(storageRoot, targetPath);

    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      return res.status(400).json({ status: 'error', message: 'Invalid folder name.' });
    }

    const folderExists = fs.existsSync(targetPath) && fs.lstatSync(targetPath).isDirectory();
    if (!folderExists) {
      return res.status(404).json({ status: 'error', message: 'Folder not found.' });
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const filePath = path.join(targetPath, entry.name);
        const stats = fs.statSync(filePath);
        const ext = path.extname(entry.name).toUpperCase() || '';
        const type = ext === '.MP3' || ext === '.WAV' ? 'Audio' : ext === '.JSON' ? 'JSON' : ext === '.TXT' ? 'Text' : 'File';

        return {
          name: entry.name,
          size: formatBytes(stats.size),
          type,
          ext
        };
      });

    const response = {
      folders: [],
      currentPath: `/storage/${folderName}`,
      files
    };

    res.json(response);
  } catch (err) {
    logger.error('Route(assets): Error fetching assets:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/assets/folder/:folderName/file/:fileName
router.get('/folder/:folderName/file/:fileName', async (req, res) => {
  try {
    const { folderName, fileName } = req.params;

    const storageRoot = path.resolve(__dirname, '..', 'storage');
    const targetPath = path.resolve(storageRoot, folderName, fileName);
    const relative = path.relative(storageRoot, targetPath);

    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      return res.status(400).json({ status: 'error', message: 'Invalid file path.' });
    }

    if (!fs.existsSync(targetPath) || !fs.lstatSync(targetPath).isFile()) {
      return res.status(404).json({ status: 'error', message: 'File not found.' });
    }

    const ext = path.extname(targetPath).toLowerCase();

    // Stream audio/video directly
    if (['.mp3', '.wav', '.m4a', '.ogg'].includes(ext)) {
      return res.sendFile(targetPath);
    }

    // For text/json return content payload
    const content = fs.readFileSync(targetPath, { encoding: 'utf8' });
    const mime = ext === '.json' ? 'application/json' : 'text/plain';

    return res.json({ content, mime });
  } catch (err) {
    logger.error('Route(assets): Error fetching file:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}


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