/**
 * root/routes/sidebar-menu-admin.js
 * 
 * Super Admin sidebar menu management endpoints for CRUD operations
 * on header_menu_items table. Allows dynamic management of sidebar navigation
 * structure for all roles.
 */
const express = require('express');
const router = express.Router();
const { HeaderConfigModel } = require('../models/HeaderConfigModel');
const { requireAuth, requireRole } = require('../middleware/auth');

// ─── ROLES ──────────────────────────────────────────────────────────────

/**
 * GET /api/sidebar-menu-admin/roles
 * Get all roles for the dropdown selector
 */
router.get('/roles', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const roles = await HeaderConfigModel.getAllRoles();
    res.json({ count: roles.length, data: roles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MENU ITEMS ─────────────────────────────────────────────────────────

/**
 * GET /api/sidebar-menu-admin/items/:roleId
 * Get all menu items (flat list) for a specific role
 */
router.get('/items/:roleId', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const roleId = parseInt(req.params.roleId);
    const items = await HeaderConfigModel.getMenuItemsFlatByRoleId(roleId);
    const tree = await HeaderConfigModel.getMenuItemsByRoleId(roleId);
    res.json({ 
      count: items.length, 
      flat: items, 
      tree: tree 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sidebar-menu-admin/items/:roleId
 * Create a new menu item for a role
 * Body: { menu_id, parent_id?, label, icon?, href?, display_order?, is_active? }
 */
router.post('/items/:roleId', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const roleId = parseInt(req.params.roleId);
    const { menu_id, parent_id, label, icon, href, display_order, is_active } = req.body;
    if (!menu_id || !label) {
      return res.status(400).json({ error: 'menu_id and label are required' });
    }
    const result = await HeaderConfigModel.insertMenuItem(roleId, {
      menu_id,
      parent_id: parent_id || null,
      label,
      icon: icon || null,
      href: href || null,
      display_order: display_order !== undefined ? parseInt(display_order) : 0,
      is_active: is_active !== undefined ? is_active : true
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/sidebar-menu-admin/items/:id
 * Update a menu item by its DB id
 * Body: { label?, icon?, href?, parent_id?, display_order?, is_active? }
 */
router.put('/items/:id', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = {};
    if (req.body.label !== undefined) updates.label = req.body.label;
    if (req.body.icon !== undefined) updates.icon = req.body.icon;
    if (req.body.href !== undefined) updates.href = req.body.href;
    if (req.body.parent_id !== undefined) updates.parent_id = req.body.parent_id;
    if (req.body.display_order !== undefined) updates.display_order = parseInt(req.body.display_order);
    if (req.body.is_active !== undefined) updates.is_active = req.body.is_active;
    const result = await HeaderConfigModel.updateMenuItemById(id, updates);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/sidebar-menu-admin/items/:id
 * Delete a menu item (and its children) by its DB id
 */
router.delete('/items/:id', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await HeaderConfigModel.deleteMenuItemById(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sidebar-menu-admin/reseed/:roleId
 * Re-seed default menu items for a role (replaces all items with defaults)
 * Body: { menuItems: [...] } — the default menu items structure
 */
router.post('/reseed/:roleId', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const roleId = parseInt(req.params.roleId);
    const { menuItems } = req.body;
    if (!Array.isArray(menuItems) || menuItems.length === 0) {
      return res.status(400).json({ error: 'menuItems array is required' });
    }
    await HeaderConfigModel.seedMenuItems(roleId, menuItems);
    // Fetch and return the new menu
    const items = await HeaderConfigModel.getMenuItemsFlatByRoleId(roleId);
    const tree = await HeaderConfigModel.getMenuItemsByRoleId(roleId);
    res.json({ success: true, flat: items, tree });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;