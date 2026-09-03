/**
 * routes/super_admin/sidebar-menu-management.js
 * Sidebar / menu management routes — only call controllers, no logic.
 * Mounted by routes/super_admin/index.js at /sidebar-menu-management (under /api/super_admin).
 */
const express = require('express');
const router = express.Router();
const menu = require('../../controllers/super_admin/menu/menuController');

// Resolved menu for a role / user
//   -> POST /api/super_admin/sidebar-menu-management/resolved
router.post('/resolved', menu.getResolvedUserMenu);

// Get role menu permissions
//   -> POST /api/super_admin/sidebar-menu-management/permissions
router.post('/permissions', menu.getMenuPermissions);

// Update role menu permissions
//   -> PUT /api/super_admin/sidebar-menu-management/permissions
router.put('/permissions', menu.updateMenuPermissions);

// Reset role menu permissions to defaults
//   -> POST /api/super_admin/sidebar-menu-management/reseed
router.post('/reseed', menu.reseedRoleMenuPermissions);

module.exports = router;
