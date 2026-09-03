/**
 * root/routes/assets.js
 */
const express = require('express');
const router = express.Router();
const assetsController = require('../controllers/assets/assetsController');

/**
 * @route   POST /api/assets/wav
 * @desc    Store the processed .wav path for a meeting
 */
router.post('/wav', assetsController.storeWav);

/**
 * @route   GET /api/assets/folder/:folderName
 * @desc    List files in a storage folder
 */
router.get('/folder/:folderName', assetsController.getFolderAssets);

/**
 * @route   GET /api/assets/folder/:folderName/file/:fileName
 * @desc    Retrieve a specific file from a storage folder
 */
router.get('/folder/:folderName/file/:fileName', assetsController.getFolderFile);

/**
 * @route   GET /api/assets/:meetingId
 * @desc    Retrieve all intelligence pointers and paths for a meeting
 */
router.get('/:meetingId', assetsController.getAssets);

module.exports = router;