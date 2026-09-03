/**
 * routes/super_admin/content/assets/index.js
 * Super Admin "Media Assets" routes — only call controllers, no logic.
 * Mounted by routes/super_admin/index.js at /content/assets (under /api/super_admin).
 */
const express = require('express');
const router = express.Router();
const controller = require('../../../controllers/super_admin/content/assets/manageAssetsController');

// List files in a storage folder
//   -> GET /api/super_admin/content/assets/folder/:folderName
router.get('/folder/:folderName', controller.getFolderAssets);

// Get a file from a folder (audio stream or text/json)
//   -> GET /api/super_admin/content/assets/folder/:folderName/file/:fileName
router.get('/folder/:folderName/file/:fileName', controller.getFolderFile);

module.exports = router;
