/**
 * controllers/roleController.js
 * Business logic for role management and role-page assignments.
 */

const RolesModel = require('../../models/roles/RolesModel');
const { HeaderConfigModel } = require('../../models/header/HeaderConfigModel');

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
   * GET /api/roles/:id/pages
   * Get pages assigned to a role from header_page_configs.
   * Falls back to all pages if no menu items exist for the role.
   */
  async getPages(req) {
    try {
      const roleId = parseInt(req.params.id);
      if (isNaN(roleId)) return err('Invalid role ID', 400);

      // 1. Get menu items for this role from DB
      const MenuModel = require('../../models/menu/MenuModel');
      const menuItems = await MenuModel.getResolvedMenuForUser(req.user.id, roleId);

      // 2. Extract page keys from menu hrefs
      const pageKeys = new Set();
      function extractPages(items) {
        (items || []).forEach(item => {
          if (item.href) {
            const parts = item.href.replace(/\.html$/, '').split('/').filter(Boolean);
            const fileName = parts[parts.length - 1];
            const camelKey = fileName.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            pageKeys.add(camelKey);
            if (parts.length >= 3) {
              const subKey = parts.slice(1).join('_').replace(/-/g, '');
              pageKeys.add(subKey);
            }
          }
          if (item.submenu) extractPages(item.submenu);
        });
      }
      extractPages(menuItems);

      // 3. Get all page configs for this role from DB
      const pages = (await HeaderConfigModel.getPagesByRoleId(roleId, { activeOnly: false })) || [];

      // 4. If no menu items exist for this role, return all pages
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