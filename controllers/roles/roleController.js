/**
 * controllers/roleController.js
 * Business logic for role management and role-page assignments.
 */

const RolesModel = require('../../models/roles/RolesModel');
const { HeaderConfigModel } = require('../../models/header/HeaderConfigModel');
const MenuModel = require('../../models/menu/MenuModel');

/** Standard success response */
function ok(data, message) {
  return { success: true, message: message || null, ...data };
}

/** Standard error response */
function err(message, statusCode) {
  return { success: false, error: message, statusCode: statusCode || 500 };
}

const roleController = {
  /**
   * GET /api/roles
   * List all roles (filtered for admin users).
   */
  async list(req) {
    try {
      let rows = await RolesModel.getAllRoles();
      // Filter out restricted roles for non-super_admin users
      if (req.user && req.user.role_name !== 'super_admin') {
        rows = rows.filter(r => !['super_admin', 'solo_instructor', 'admin'].includes(r.role_name));
      }
      return ok({ count: rows.length, data: rows });
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * GET /api/roles/:name
   * Get single role by name.
   */
  async getByName(req) {
    try {
      const name = req.params.name;
      const row = await RolesModel.getRoleByName(name);
      if (!row) return err('Role not found', 404);
      return ok(row);
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * POST /api/roles/pages
   * Get pages assigned to a role from header_page_configs.
   * Falls back to all pages if no menu items exist for the role.
   * 
   * Body: { roleId: number }
   * 
   * IMPORTANT: This uses ONLY the role's default menu permissions,
   * NOT the logged-in user's personal overrides.
   */
  async getPages(req) {
    try {
      const roleId = parseInt(req.body.roleId);
      if (isNaN(roleId)) return err('Invalid role ID', 400);

      // 1. Get ONLY the role's default menu permissions (no user overrides)
      const rolePermissions = await MenuModel.getRoleMenuPermissions(roleId);
      
      // 2. Get all menu items to build the tree
      const allMenuItems = await MenuModel.getAllMenuItems();
      
      // 3. Build menu tree from role defaults only (no user overrides)
      const menuItems = MenuModel.buildMenuTree(allMenuItems, rolePermissions);

      // 4. Extract page keys from menu items using menu_id directly
      const pageKeys = new Set();
      function extractPages(items) {
        (items || []).forEach(item => {
          // Use the menu_id directly as it's the canonical identifier
          if (item.menu_id) {
            pageKeys.add(item.menu_id);
            // Also add camelCase version for matching
            const camelKey = item.menu_id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            pageKeys.add(camelKey);
          }
          if (item.submenu) extractPages(item.submenu);
        });
      }
      extractPages(menuItems);

      // 5. Get all page configs for this role from DB
      const pages = (await HeaderConfigModel.getPagesByRoleId(roleId, { activeOnly: false })) || [];

      // 6. If no menu items exist for this role, return all pages
      //    Otherwise filter to only pages referenced in menu items
      const filtered = (pageKeys.size === 0) ? pages : pages.filter(p => pageKeys.has(p.pageKey));

      return ok({ roleId, count: filtered.length, data: filtered });
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * POST /api/roles
   * Create a new role (super_admin only).
   */
  async create(req) {
    try {
      const { role_name, description } = req.body;
      const created = await RolesModel.createRole(role_name, description);
      return ok({ created }, 'Role created', 201);
    } catch (e) {
      return err(e.message);
    }
  },
};

module.exports = roleController;