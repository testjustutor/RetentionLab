/**
 * models/menu/MenuModel.js
 * Handles menu items, role permissions, and user overrides
 */

class MenuModel {
  /**
   * Use seedHelpers which wraps db with proper promise-based async/await helpers
   */
  static getHelpers() {
    return require('../../database/seedHelpers');
  }

  /**
   * Get all active menu items
   */
  static async getAllMenuItems() {
    const { allAsync } = this.getHelpers();
    return allAsync(`
      SELECT * FROM menu_items 
      WHERE is_active = 1 
      ORDER BY sort_order ASC, id ASC
    `);
  }

  /**
   * Get menu item by ID
   */
  static async getMenuItemById(id) {
    const { getAsync } = this.getHelpers();
    return getAsync(
      `SELECT * FROM menu_items WHERE id = ? LIMIT 1`,
      [id]
    );
  }

  /**
   * Get role menu permissions for a specific role
   * Returns map: menu_item_id -> { is_visible, sort_order }
   */
  static async getRoleMenuPermissions(roleId) {
    const { allAsync } = this.getHelpers();
    const rows = await allAsync(
      `SELECT id, menu_item_id, is_visible, sort_order, parent_id
       FROM role_menu_permissions 
       WHERE role_id = ?`,
      [roleId]
    );
    
    // Convert to map for efficient lookup.
    // The parent_id column may contain either:
    // 1) a parent menu_item_id (new seeding format), or
    // 2) another role_menu_permissions row id (legacy/older seed format).
    const permissionRowIdToMenuItemId = {};
    for (const row of rows) {
      permissionRowIdToMenuItemId[row.id] = row.menu_item_id;
    }

    const permissionsMap = {};
    for (const row of rows) {
      let parentMenuItemId = row.parent_id;
      if (parentMenuItemId && permissionRowIdToMenuItemId[parentMenuItemId]) {
        parentMenuItemId = permissionRowIdToMenuItemId[parentMenuItemId];
      }

      permissionsMap[row.menu_item_id] = {
        is_visible: row.is_visible,
        sort_order: row.sort_order,
        parent_id: parentMenuItemId
      };
    }
    return permissionsMap;
  }

  /**
   * Get user menu overrides for a specific user
   * Returns map: menu_item_id -> { is_visible, sort_order, parent_id }
   */
  static async getUserMenuOverrides(userId) {
    const { allAsync } = this.getHelpers();
    const rows = await allAsync(
      `SELECT menu_item_id, is_visible, sort_order, parent_id
       FROM user_menu_permissions 
       WHERE user_id = ?`,
      [userId]
    );

    const overridesMap = {};
    for (const row of rows) {
      overridesMap[row.menu_item_id] = {
        is_visible: row.is_visible,
        sort_order: row.sort_order,
        parent_id: row.parent_id
      };
    }
    return overridesMap;
  }

  /**
   * Merge role defaults with user overrides
   * User overrides win if present
   * @param {Object} rolePermissions - Map from getRoleMenuPermissions()
   * @param {Object} userOverrides - Map from getUserMenuOverrides()
   * @returns {Object} Merged permissions map
   */
  static mergePermissions(rolePermissions, userOverrides) {
    const merged = { ...rolePermissions };
    
    // Apply user overrides on top of role defaults
    for (const [menuItemId, override] of Object.entries(userOverrides)) {
      if (merged[menuItemId]) {
        merged[menuItemId] = {
          is_visible: override.is_visible !== null ? override.is_visible : merged[menuItemId].is_visible,
          sort_order: override.sort_order !== null ? override.sort_order : merged[menuItemId].sort_order,
          parent_id: merged[menuItemId].parent_id
        };
      } else {
        merged[menuItemId] = override;
      }
    }
    
    return merged;
  }

  /**
   * Build nested tree structure from flat menu items
   * Only includes items that have an explicit permission entry (role or user).
   * Items without any permission entry are excluded — they belong to other roles.
   * Uses the parent_id from the permissionsMap (role-level hierarchy) rather than
   * the menu_items table (which only stores super_admin's hierarchy).
   * @param {Array} menuItems - All menu items
   * @param {Object} permissionsMap - Merged permissions (visibility + sort_order + parent_id)
   * @returns {Array} Nested tree structure
   */
  static buildMenuTree(menuItems, permissionsMap) {
    const itemMap = {};
    const tree = [];

    // First pass: create map and apply permissions
    for (const item of menuItems) {
      const permission = permissionsMap[item.id];
      
      // Skip items that have no permission entry at all (they belong to other roles)
      if (!permission) continue;
      
      // Skip hidden items
      if (!permission.is_visible) continue;

      itemMap[item.id] = {
        ...item,
        sort_order: permission.sort_order !== null ? permission.sort_order : item.sort_order,
        // Use parent_id from permissions map (role-level), fall back to menu_items parent
        parent_id: permission.parent_id !== null ? permission.parent_id : item.parent_id,
        children: []
      };
    }

    // Second pass: build tree
    for (const item of Object.values(itemMap)) {
      if (item.parent_id && itemMap[item.parent_id]) {
        // Add as child
        itemMap[item.parent_id].children.push(item);
      } else {
        // Top-level item
        tree.push(item);
      }
    }

    // Sort each level by sort_order
    const sortByOrder = (nodes) => {
      nodes.sort((a, b) => a.sort_order - b.sort_order);
      nodes.forEach(node => sortByOrder(node.children));
    };
    sortByOrder(tree);

    return tree;
  }

  /**
   * Cache for resolved menus: key = "user_{userId}", value = tree array
   * Cleared when role defaults or any user override changes
   */
  static menuCache = {};

  /**
   * Invalidate cache entries that depend on the given role or user
   */
  static invalidateCache(roleId, userId) {
    if (userId) {
      delete this.menuCache[`user_${userId}`];
    }
    // When role defaults change, invalidate all users in that role
    if (roleId) {
      for (const key of Object.keys(this.menuCache)) {
        if (this.menuCache[key]?.roleId === roleId) {
          delete this.menuCache[key];
        }
      }
    }
  }

  /**
   * Save role menu permissions (bulk)
   * @param {number} roleId 
   * @param {Array} permissions - Array of { menu_item_id, is_visible, sort_order, parent_id }
   */
  static async saveRoleMenuPermissions(roleId, permissions) {
    const { runAsync } = this.getHelpers();
    
    // Delete existing permissions for this role
    await runAsync(
      `DELETE FROM role_menu_permissions WHERE role_id = ?`,
      [roleId]
    );

    // Insert new permissions
    for (const perm of permissions) {
      await runAsync(
        `INSERT INTO role_menu_permissions (role_id, menu_item_id, is_visible, sort_order, parent_id)
         VALUES (?, ?, ?, ?, ?)`,
        [roleId, perm.menu_item_id, perm.is_visible ? 1 : 0, perm.sort_order || 0, perm.parent_id || null]
      );
    }

    // Invalidate cache for all users in this role since role defaults changed
    this.invalidateCache(roleId, null);

    return { success: true, message: 'Role menu permissions saved' };
  }

  /**
   * Save user menu overrides (thin/exception-only layer)
   * 
   * Instead of storing all menu items for a user, this stores ONLY the items
   * where the user's visibility differs from their role default.
   * 
   * If an override matches the role default, it is REMOVED (not stored as redundant data).
   * If the user has no overrides, nothing exists in the user_menu_permissions table.
   * 
   * @param {number} userId - User ID
   * @param {number} roleId - User's role ID (to compare against role defaults)
   * @param {Array} desiredPermissions - Array of { menu_item_id, is_visible, sort_order }
   *                                      representing what the admin wants the user to see
   */
  static async saveUserMenuOverrides(userId, overrides) {
    const { runAsync, getAsync } = this.getHelpers();

    // Get the user's role to compare against role defaults
    const user = await getAsync(
      `SELECT role_id FROM users WHERE id = ?`,
      [userId]
    );
    if (!user) {
      throw new Error('User not found');
    }

    // Get role defaults for comparison
    const rolePermissions = await this.getRoleMenuPermissions(user.role_id);
    
    // Get all menu items to know sort_order defaults
    const menuItems = await this.getAllMenuItems();
    const menuItemDefaults = {};
    for (const item of menuItems) {
      menuItemDefaults[item.id] = item.sort_order;
    }

    // Filter: only keep overrides that actually differ from role defaults
    // This keeps the user_menu_permissions table minimal
    const realExceptions = overrides.filter(override => {
      const roleDefault = rolePermissions[override.menu_item_id];
      const roleVisible = roleDefault?.is_visible ?? 1;
      const roleSort = roleDefault?.sort_order ?? menuItemDefaults[override.menu_item_id] ?? 0;
      
      const overrideVisible = override.is_visible !== undefined ? (override.is_visible ? 1 : 0) : null;
      const overrideSort = override.sort_order !== undefined ? override.sort_order : null;

      // If both match the role default, it's not a real exception
      if (overrideVisible === roleVisible && (overrideSort === null || overrideSort === roleSort)) {
        return false; // Skip - matches role default
      }
      return true; // Keep - real exception
    });

    // Delete all existing overrides for this user (clean slate)
    await runAsync(
      `DELETE FROM user_menu_permissions WHERE user_id = ?`,
      [userId]
    );

    // Insert only the real exceptions
    for (const override of realExceptions) {
      await runAsync(
        `INSERT INTO user_menu_permissions (user_id, menu_item_id, is_visible, sort_order)
         VALUES (?, ?, ?, ?)`,
        [userId, override.menu_item_id, override.is_visible ? 1 : 0, override.sort_order ?? null]
      );
    }

    // Invalidate cache for this user
    this.invalidateCache(null, userId);

    return { 
      success: true, 
      message: `User menu overrides saved (${realExceptions.length} exceptions out of ${overrides.length} items)`,
      exceptions_created: realExceptions.length,
      exceptions_removed: overrides.length - realExceptions.length
    };
  }

  /**
   * Get resolved menu for a user with caching
   * Returns the menu from cache if available, otherwise computes and caches it
   * @param {number} userId - User ID
   * @param {number} roleId - User's role ID
   * @returns {Array} Nested menu tree
   */
  static async getResolvedMenuForUser(userId, roleId) {
    const cacheKey = `user_${userId}`;
    
    // Check cache first
    if (this.menuCache[cacheKey]) {
      return this.menuCache[cacheKey].tree;
    }

    // Fetch all menu items and role permissions in parallel
    const [menuItems, rolePermissions] = await Promise.all([
      this.getAllMenuItems(),
      this.getRoleMenuPermissions(roleId)
    ]);

    // Build and cache tree from role defaults only
    const tree = this.buildMenuTree(menuItems, rolePermissions);
    this.menuCache[cacheKey] = { tree, roleId };
    
    return tree;
  }
}

module.exports = MenuModel;