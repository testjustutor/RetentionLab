/**
 * controllers/super_admin/content/assets/manageAssetsController.js
 * Media Assets controllers — thin, all file access goes through ManageAssetsModel.
 */
const ManageAssetsModel = require('../../../../models/super_admin/content/assets/ManageAssetsModel');

const controller = {
  /**
   * GET /api/super_admin/content/assets/folder/:folderName
   */
  async getFolderAssets(req, res) {
    try {
      const { folderName } = req.params;
      const data = await ManageAssetsModel.listFolder(folderName);
      return res.json(data);
    } catch (err) {
      const code = err.statusCode || 500;
      if (code >= 500) console.error('[ManageAssets] getFolderAssets error:', err);
      return res.status(code).json({ status: 'error', message: err.message });
    }
  },

  /**
   * GET /api/super_admin/content/assets/folder/:folderName/file/:fileName
   */
  async getFolderFile(req, res) {
    try {
      const { folderName, fileName } = req.params;
      const data = await ManageAssetsModel.getFile(folderName, fileName);
      if (data && data.stream) {
        return res.sendFile(data.path);
      }
      return res.json({ content: data.content, mime: data.mime });
    } catch (err) {
      const code = err.statusCode || 500;
      if (code >= 500) console.error('[ManageAssets] getFolderFile error:', err);
      return res.status(code).json({ status: 'error', message: err.message });
    }
  }
};

module.exports = controller;
