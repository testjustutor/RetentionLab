/**
 * controllers/super_admin/menu/menuController.js
 * Handles menu resolution and admin management
 */

const MenuModel = require('../../../models/super_admin/menu/MenuModel');
const UsersModel = require('../../../models/users/UsersModel');
const RolesModel = require('../../../models/roles/RolesModel');
const { logger } = require('../../../utils/logger');

function ok(data, message) {
  return { success: true, message: message || null, ...(data || {}) };
}

function err(message, statusCode) {
  return { success: false, error: message, statusCode: statusCode || 500 };
}

const menuController = {
  /**
   * GET /api/menu
   * Get resolved menu for current logged-in user
   * Returns nested tree structure with role defaults
   */
  async getMyMenu(req, res) {
    try {
      const roleId = req.user.role_id;

      const menuTree = await MenuModel.getResolvedMenuForUser(roleId);

      return ok({ data: menuTree });
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * POST /api/admin/menu-permissions/resolved
   * Get resolved menu for a specific user (role defaults only, no user overrides)
   */
  async getResolvedUserMenu(req, res) {
    try {
      const { user_id } = req.body;
      if (!user_id) return err('user_id is required', 400);

      const user = await UsersModel.getRoleIdById(user_id);
      if (!user) return err('User not found', 404);

      const [menuItems, rolePermissions] = await Promise.all([
        MenuModel.getAllMenuItems(user.role_id),
        MenuModel.getRoleMenuPermissions(user.role_id)
      ]);

      const resolvedView = menuItems.map(item => {
        const roleDefault = rolePermissions[item.id];
        const roleVisible = roleDefault?.is_visible ?? 0;
        const roleSort = roleDefault?.sort_order ?? item.sort_order;
        const parentId = roleDefault?.parent_id ?? item.parent_id;

        return {
          menu_item_id: item.id,
          menu_key: item.menu_key,
          label: item.label,
          icon: item.icon,
          route_path: item.route_path,
          parent_id: parentId,
          role_default_visible: roleVisible,
          role_default_sort: roleSort,
          user_override_visible: null,
          user_override_sort: null,
          is_overridden: false,
          is_visible: roleVisible,
          sort_order: roleSort,
          user_overrides_supported: false
        };
      });

      return ok({ data: resolvedView });
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * GET /api/super_admin/sidebar-menu-management/permissions?role_id=&user_id=
   *
   * Pure read — this is a GET now (was a POST-with-body), because it never
   * writes anything; role_id/user_id are query params, not a request body.
   *
   * Data-fetching approach: ONE joined DB query
   * (MenuModel.getMenuItemsWithPermissions, inside getRoleMenuTree) instead
   * of two separate queries, and the response is the role's menu already
   * nested into a tree (via MenuModel.getRoleMenuTree/_nestByParentId)
   * instead of a flat list the frontend has to re-derive parent/child
   * relationships from. Includes hidden items (unlike the real sidebar's
   * getResolvedMenuForUser), since the admin page needs to show and toggle
   * every item, not just the currently-visible ones.
   */
  async getMenuPermissions(req, res) {
    logger.info('[Controller:Menu] getMenuPermissions() invoked — request reached the controller layer');
    const controllerStart = Date.now();
    try {
      const role_id = req.query.role_id ? Number(req.query.role_id) : null;
      const user_id = req.query.user_id ? Number(req.query.user_id) : null;
      logger.info(`[Controller:Menu] getMenuPermissions() parsed query args — role_id=${role_id} user_id=${user_id}`);

      if (user_id) {
        logger.info(`[Controller:Menu] getMenuPermissions() branch: user_id=${user_id} present — resolving that user's role_id from DB first`);
        const user = await UsersModel.getRoleIdById(user_id);
        if (!user) {
          logger.info(`[Controller:Menu] getMenuPermissions() — user_id=${user_id} NOT found in DB, returning 404`);
          return err('User not found', 404);
        }
        logger.info(`[Controller:Menu] getMenuPermissions() — user found (role_id=${user.role_id}); calling MenuModel.getRoleMenuTree`);
        const tree = await MenuModel.getRoleMenuTree(user.role_id);
        logger.info(`[Controller:Menu] getMenuPermissions() — tree ready (${Array.isArray(tree) ? tree.length : '?'} top-level nodes), sending ok() response (${Date.now() - controllerStart}ms)`);
        return ok({ data: tree });
      } else if (role_id) {
        // This is the path the Sidebar Menu Management page actually calls.
        logger.info(`[Controller:Menu] getMenuPermissions() branch: role_id=${role_id} — calling MenuModel.getRoleMenuTree(role_id)`);
        const tree = await MenuModel.getRoleMenuTree(role_id);
        logger.info(`[Controller:Menu] getMenuPermissions() — role_id=${role_id} tree ready (${Array.isArray(tree) ? tree.length : '?'} top-level nodes), sending ok() response (${Date.now() - controllerStart}ms)`);
        return ok({ data: tree });
      } else {
        logger.info(`[Controller:Menu] getMenuPermissions() — neither role_id nor user_id supplied, returning 400 error`);
        return err('Either role_id or user_id is required', 400);
      }
    } catch (e) {
      logger.error(`[Controller:Menu] getMenuPermissions() FAILED after ${Date.now() - controllerStart}ms — ${e.message}`, e);
      return err(e.message);
    }
  },

  /**
   * PUT /api/admin/menu-permissions
   * Update menu permissions (role based)
   */
  async updateMenuPermissions(req, res) {
    try {
      const { role_id, user_id, permissions } = req.body;

      if (user_id) {
        return err('User-specific menu overrides are not supported', 400);
      } else if (role_id) {
        if (!Array.isArray(permissions)) {
          return err('Permissions must be an array', 400);
        }
        const result = await MenuModel.saveRoleMenuPermissions(role_id, permissions);
        return ok(result);
      } else {
        return err('Either role_id or user_id is required', 400);
      }
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * POST /api/admin/menu-permissions/reseed
   * Reset role menu permissions to defaults
   */
  async reseedRoleMenuPermissions(req, res) {
    try {
      const { role_id } = req.body;
      if (!role_id) return err('role_id is required', 400);

      // Get role name
      const role = await RolesModel.getRoleById(role_id);

      if (!role) {
        return err('Role not found', 404);
      }

      // Get menu items for this role
      const menuItems = await MenuModel.getAllMenuItems(role_id);
      const menuItemIdMap = {};
      for (const item of menuItems) {
        menuItemIdMap[item.menu_key] = item.id;
      }

      // Build permissions array - all items visible by default, restored to
      // their default menu_items hierarchy (clears any per-role parent_id
      // override that was previously set for this role).
      const permissions = menuItems.map(item => ({
        menu_item_id: item.id,
        is_visible: 1,
        sort_order: item.sort_order,
        parent_id: item.parent_id || null
      }));

      // Save permissions
      const result = await MenuModel.saveRoleMenuPermissions(role_id, permissions);

      return ok({ ...result, message: 'Menu reset to defaults' });
    } catch (e) {
      return err(e.message);
    }
  }
};

// FIX: this file used to build every response with res.status(...).json(...)
// directly and return the Express `res` object itself, while
// routes/super_admin/index.js wires all 4 menu-permissions routes through a
// generic `handle(fn)` adapter that expects `fn(req, res)` to resolve to a
// plain { success, ... } object and does the res.status().json() itself
// (exactly like the sibling controllers/menu/menuController.js, which this
// file otherwise mirrors byte-for-byte). Because a returned `res` object is
// circular (res.req, res.socket, ...), `handle()`'s own res.status(...).json(r)
// call on that returned res threw "TypeError: Converting circular structure
// to JSON" as an unhandled promise rejection on every call to POST/PUT
// /api/super_admin/menu-permissions, POST .../resolved, and POST .../reseed -
// after the correct response had already been sent once directly. Rewritten
// to return plain ok()/err() objects like every other handle()-wrapped
// controller in this file, removing the now-unused sendOk/sendErr helpers.
module.exports = menuController;
