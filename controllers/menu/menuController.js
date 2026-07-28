/**
 * controllers/menu/menuController.js
 * Handles menu resolution and admin management
 */

const MenuModel = require('../../models/menu/MenuModel');

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
   * Returns nested tree structure with role defaults + user overrides
   */
  async getMyMenu(req, res) {
    try {
      const userId = req.user.id;
      const roleId = req.user.role_id;

      const menuTree = await MenuModel.getResolvedMenuForUser(userId, roleId);
      
      return ok({ data: menuTree });
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * POST /api/admin/menu-permissions/resolved
   * Get resolved menu for a specific user (role defaults merged with personal overrides)
   * Returns the full resolved view with flags indicating which items are overridden
   */
  async getResolvedUserMenu(req, res) {
    try {
      const { user_id } = req.body;
      if (!user_id) return err('user_id is required', 400);

      // User-specific overrides are not currently enabled.
      // Return the role-default menu for this user's role only.
      const { getAsync } = require('../../database/seedHelpers');
      const user = await getAsync('SELECT role_id FROM users WHERE id = ?', [user_id]);
      if (!user) return err('User not found', 404);

      const [menuItems, rolePermissions] = await Promise.all([
        MenuModel.getAllMenuItems(),
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

      return ok({ data: resolvedView, message: 'User-specific menu overrides are not currently enabled.' });
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * POST /api/admin/menu-permissions
   * Get menu permissions (role or user based on body payload)
   */
  async getMenuPermissions(req, res) {
    try {
      const { role_id, user_id } = req.body;
      
      // Get all menu items
      const menuItems = await MenuModel.getAllMenuItems();
      
      if (user_id) {
        // User-specific menu overrides are not currently enabled.
        // Return role defaults for the user's role instead.
        const { getAsync } = require('../../database/seedHelpers');
        const user = await getAsync('SELECT role_id FROM users WHERE id = ?', [user_id]);
        if (!user) return err('User not found', 404);

        const rolePermissions = await MenuModel.getRoleMenuPermissions(user.role_id);
        const permissions = menuItems.map(item => {
          const perm = rolePermissions[item.id];
          const parentId = perm?.parent_id ?? item.parent_id;
          if (!perm) {
            return {
              menu_item_id: item.id,
              menu_key: item.menu_key,
              label: item.label,
              icon: item.icon,
              route_path: item.route_path,
              parent_id: parentId,
              is_visible: 0,
              sort_order: item.sort_order,
              user_overrides_supported: false
            };
          }
          return {
            menu_item_id: item.id,
            menu_key: item.menu_key,
            label: item.label,
            icon: item.icon,
            route_path: item.route_path,
            parent_id: parentId,
            is_visible: perm.is_visible ?? 0,
            sort_order: perm.sort_order ?? item.sort_order,
            user_overrides_supported: false
          };
        });

        return ok({ data: permissions });
      } else if (role_id) {
        // Get role permissions
        const rolePermissions = await MenuModel.getRoleMenuPermissions(role_id);
        
        const permissions = menuItems.map(item => {
          const perm = rolePermissions[item.id];
          const parentId = perm?.parent_id ?? item.parent_id;
          // Only include items that have a permission entry for this role
          // If no entry exists, the item is not configured for this role (hidden)
          if (!perm) {
            return {
              menu_item_id: item.id,
              menu_key: item.menu_key,
              label: item.label,
              icon: item.icon,
              route_path: item.route_path,
              parent_id: parentId,
              is_visible: 0,
              sort_order: item.sort_order
            };
          }
          return {
            menu_item_id: item.id,
            menu_key: item.menu_key,
            label: item.label,
            icon: item.icon,
            route_path: item.route_path,
            parent_id: parentId,
            is_visible: perm.is_visible ?? 0,
            sort_order: perm.sort_order ?? item.sort_order
          };
        });

        return ok({ data: permissions });
      } else {
        return err('Either role_id or user_id is required', 400);
      }
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * PUT /api/admin/menu-permissions
   * Update menu permissions (role or user based on body payload)
   */
  async updateMenuPermissions(req, res) {
    try {
      const { role_id, user_id, permissions, overrides } = req.body;

      if (user_id) {
        return err('User-specific menu overrides are not currently enabled', 400);
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
      const { getAsync } = require('../../database/seedHelpers');
      const role = await getAsync('SELECT role_name FROM roles WHERE id = ?', [role_id]);
      
      if (!role) {
        return err('Role not found', 404);
      }

      // Import default menu config
      const { ROLE_MENU_DEFAULTS } = require('../../database/seeders/018_role_menu_permissions');
      const { MENU_ITEMS } = require('../../database/seeders/017_menu_items');
      
      const defaults = ROLE_MENU_DEFAULTS[role.role_name] || [];
      
      if (defaults.length === 0) {
        return err('No default menu configuration for this role', 400);
      }

      // Get menu item IDs
      const menuItems = await MenuModel.getAllMenuItems();
      const menuItemIdMap = {};
      for (const item of menuItems) {
        menuItemIdMap[item.menu_key] = item.id;
      }

      // Build permissions array
      const permissions = defaults.map(menuDefault => ({
        menu_item_id: menuItemIdMap[menuDefault.menu_key],
        is_visible: menuDefault.is_visible,
        sort_order: menuDefault.sort_order
      })).filter(p => p.menu_item_id);

      // Save permissions
      const result = await MenuModel.saveRoleMenuPermissions(role_id, permissions);
      
      return ok({ ...result, message: 'Menu reset to defaults' });
    } catch (e) {
      return err(e.message);
    }
  }
};

module.exports = menuController;
