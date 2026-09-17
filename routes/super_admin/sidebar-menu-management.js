/**
 * routes/super_admin/sidebar-menu-management.js
 * Sidebar / menu management routes — only call controllers, no logic.
 * Mounted by routes/super_admin/index.js at /sidebar-menu-management (under /api/super_admin).
 */
const express = require('express');
const router = express.Router();
const menu = require('../../controllers/super_admin/menu/menuController');
const { logger } = require('../../utils/logger');

// Thin response adapter — same pattern as `handle()` in
// routes/super_admin/index.js. The menu controllers resolve to a plain
// { success, ... } object and do NOT send the response themselves, so the
// response is sent here. (FIX: without this wrapper these routes computed
// the result but never sent it, leaving the HTTP request hanging.)
function handle(fn) {
  return (req, res) => fn(req, res).then(r => {
    const status = r.statusCode || (r.success === false ? 400 : 200);
    res.status(status).json(r);
  });
}

// Resolved menu for a role / user
//   -> POST /api/super_admin/sidebar-menu-management/resolved
router.post('/resolved', handle(menu.getResolvedUserMenu));

// Get role menu permissions — pure read, so this is a GET with role_id as
// a query param (?role_id=), not a POST with a body. Was POST before; the
// read side of this page never writes anything, so the HTTP verb should
// say so too.
//   -> GET /api/super_admin/sidebar-menu-management/permissions?role_id=
router.get('/permissions', (req, res, next) => {
  logger.info(`[Route:SidebarMenu] GET /permissions dispatched (query=${JSON.stringify(req.query)}) -> controller.menu.getMenuPermissions`);
  next();
}, handle(menu.getMenuPermissions));

// Update role menu permissions
//   -> PUT /api/super_admin/sidebar-menu-management/permissions
router.put('/permissions', handle(menu.updateMenuPermissions));

// Reset role menu permissions to defaults
//   -> POST /api/super_admin/sidebar-menu-management/reseed
router.post('/reseed', handle(menu.reseedRoleMenuPermissions));

module.exports = router;
