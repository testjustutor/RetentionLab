/**
 * routes/menu.js
 * Menu API routes
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const requireSuperAdmin = requireRole('super_admin');
const menuController = require('../controllers/menu/menuController');

function handle(fn) {
  return (req, res) => {
    fn(req, res).then(result => {
      const status = result.statusCode || (result.success === false ? 400 : 200);
      res.status(status).json(result);
    });
  };
}

// Get current user's resolved menu
router.get('/', requireAuth, handle(menuController.getMyMenu));

// Admin: Get/Update menu permissions (role or user via body payload)
router.post('/admin/menu-permissions', requireAuth, requireSuperAdmin, handle(menuController.getMenuPermissions));
router.post('/admin/menu-permissions/resolved', requireAuth, requireSuperAdmin, handle(menuController.getResolvedUserMenu));
router.put('/admin/menu-permissions', requireAuth, requireSuperAdmin, handle(menuController.updateMenuPermissions));

// Admin: Reseed role menu permissions to defaults
router.post('/admin/menu-permissions/reseed', requireAuth, requireSuperAdmin, handle(menuController.reseedRoleMenuPermissions));

module.exports = router;