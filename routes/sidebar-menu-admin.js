/**
 * root/routes/sidebar-menu-admin.js
 * 
 * Super Admin sidebar menu management endpoints for CRUD operations
 * on header_menu_items table. Allows dynamic management of sidebar navigation
 * structure for all roles.
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const sidebarMenuAdminController = require('../controllers/sidebar/sidebarMenuAdminController');

// ─── ROLES ──────────────────────────────────────────────────────────────
router.get('/roles', requireAuth, requireRole('super_admin'), sidebarMenuAdminController.getRoles);

// ─── MENU ITEMS ─────────────────────────────────────────────────────────
router.get('/items/:roleId', requireAuth, requireRole('super_admin'), sidebarMenuAdminController.getItems);

/**
 * POST /api/sidebar-menu-admin/items/:roleId
 * Create a new menu item for a role
 * DEPRECATED: Use /api/menu/admin/menu-permissions instead
 */
router.post('/items/:roleId', requireAuth, requireRole('super_admin'), (req, res) => {
  res.json({ success: false, error: 'This endpoint is deprecated. Use /api/menu/admin/menu-permissions' });
});

/**
 * PUT /api/sidebar-menu-admin/items/:id
 * Update a menu item by its DB id
 * DEPRECATED: Use /api/menu/admin/menu-permissions instead
 */
router.put('/items/:id', requireAuth, requireRole('super_admin'), (req, res) => {
  res.json({ success: false, error: 'This endpoint is deprecated. Use /api/menu/admin/menu-permissions' });
});

/**
 * DELETE /api/sidebar-menu-admin/items/:id
 * Delete a menu item (and its children) by its DB id
 * DEPRECATED: Use /api/menu/admin/menu-permissions instead
 */
router.delete('/items/:id', requireAuth, requireRole('super_admin'), (req, res) => {
  res.json({ success: false, error: 'This endpoint is deprecated. Use /api/menu/admin/menu-permissions' });
});

/**
 * POST /api/sidebar-menu-admin/reseed/:roleId
 * Re-seed default menu items for a role
 * DEPRECATED: Use /api/menu/admin/menu-permissions instead
 */
router.post('/reseed/:roleId', requireAuth, requireRole('super_admin'), (req, res) => {
  res.json({ success: false, error: 'This endpoint is deprecated. Use /api/menu/admin/menu-permissions' });
});

module.exports = router;