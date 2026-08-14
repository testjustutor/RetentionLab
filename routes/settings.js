/**
 * root/routes/settings.js
 * Thin route layer — delegates all logic to settingsController.
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const requireSuperAdmin = requireRole('super_admin');
const settingsController = require('../controllers/settings/settingsController');
const organizationController = require('../controllers/settings/organizationController');
const notificationSettingsController = require('../controllers/settings/notificationSettingsController');
const meetingSettingsController = require('../controllers/settings/meetingSettingsController');


function handle(fn) {
  return (req, res) => {
    fn(req).then(result => {
      const status = result.statusCode || (result.success === false ? 400 : 200);
      res.status(status).json(result);
    });
  };
}

// System Settings Routes (Super Admin only)
router.get('/system', requireAuth, requireSuperAdmin, handle(settingsController.getSystemSettings));
router.post('/system/filter', requireAuth, requireSuperAdmin, handle(settingsController.getSystemSettingsByFilter));
router.get('/system/categories', requireAuth, requireSuperAdmin, handle(settingsController.getCategories));
router.get('/system/:key', requireAuth, requireSuperAdmin, handle(settingsController.getSystemSetting));
router.post('/system', requireAuth, requireSuperAdmin, handle(settingsController.upsertSystemSetting));
router.post('/system/bulk', requireAuth, requireSuperAdmin, handle(settingsController.bulkUpdateSystemSettings));
router.delete('/system/:key', requireAuth, requireSuperAdmin, handle(settingsController.deleteSystemSetting));

// User Settings Routes (Authenticated users)
router.get('/user', requireAuth, handle(settingsController.getUserSettings));
router.post('/user', requireAuth, handle(settingsController.upsertUserSetting));
router.post('/user/bulk', requireAuth, requireSuperAdmin, handle(settingsController.bulkUpdateUserSettings));

// Import/Export Routes (Super Admin only)
router.get('/export', requireAuth, requireSuperAdmin, handle(settingsController.exportSettings));
router.post('/import', requireAuth, requireSuperAdmin, handle(settingsController.importSettings));

// Organization Settings Routes (admin)
router.get('/organization', requireAuth, handle(organizationController.get));
router.put('/organization', requireAuth, handle(organizationController.update));

// Notification Settings Routes (admin)
router.get('/notifications', requireAuth, handle(notificationSettingsController.get));
router.put('/notifications', requireAuth, handle(notificationSettingsController.update));

// Meeting Settings Routes (admin)
router.get('/meetings', requireAuth, handle(meetingSettingsController.get));
router.put('/meetings', requireAuth, handle(meetingSettingsController.update));

module.exports = router;