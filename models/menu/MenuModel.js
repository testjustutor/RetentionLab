/**
 * models/menu/MenuModel.js
 * Handles menu items and role permissions
 * Each role has its own set of menu items (role_id in menu_items table)
 * No direct user-menu assignment exists
 */

class MenuModel {
  /**
   * Use seedHelpers which wraps db with proper promise-based async/await helpers
   */
  static getHelpers() {
    return require('../../database/seedHelpers');
  }

  /**
   * Get all active menu items for a specific role
   * @param {number} roleId - Role ID to filter menu items
   */
  static async getAllMenuItems(roleId = null) {
    const { allAsync } = this.getHelpers();
    let sql = `SELECT * FROM menu_items WHERE is_active = 1`;
    const params = [];
    
    if (roleId !== null) {
      sql += ` AND role_id = ?`;
      params.push(roleId);
    }
    
    sql += ` ORDER BY sort_order ASC, id ASC`;
    
    return allAsync(sql, params);
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
    
    // Convert to map for efficient lookup
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
   * Build nested tree structure from flat menu items
   * Only includes items that have an explicit permission entry for the role.
   * Uses the parent_id from the permissionsMap (role-level hierarchy).
   * @param {Array} menuItems - All menu items for this role
   * @param {Object} permissionsMap - Role permissions (visibility + sort_order + parent_id)
   * @param {number} [roleId] - Optional, used only for clearer warning logs
   * @returns {Array} Nested tree structure
   */
  static buildMenuTree(menuItems, permissionsMap, roleId = null) {
    const itemMap = {};
    const tree = [];

    // First pass: create map and apply permissions
    for (const item of menuItems) {
      const permission = permissionsMap[item.id];
      
      // Skip items that have no permission entry at all
      if (!permission) {
        console.warn(
          `[MenuModel] menu item id=${item.id} (menu_key="${item.menu_key}") has no ` +
          `role_menu_permissions entry${roleId ? ` for role_id=${roleId}` : ''} — skipping. ` +
          `This usually means the seeder failed partway through; check for duplicate ` +
          `menu_key values or a crashed seed run.`
        );
        continue;
      }
      
      // Skip hidden items
      if (!permission.is_visible) continue;

      itemMap[item.id] = {
        ...item,
        sort_order: permission.sort_order !== null ? permission.sort_order : item.sort_order,
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
   * Cache for resolved menus: key = "role_{roleId}", value = tree array
   * Cleared when role defaults change, or entirely on demand via clearAllCache()
   */
  static menuCache = {};

  /**
   * Invalidate cache entries for a given role
   */
  static invalidateCache(roleId) {
    if (roleId) {
      delete this.menuCache[`role_${roleId}`];
    }
  }

  /**
   * Clear the entire in-memory menu cache for every role.
   * IMPORTANT: call this after any full DB reset/reseed (e.g. `node database/reset-db.js --force`)
   * run while the server process stays alive — otherwise the sidebar API will keep serving
   * stale menu data from before the reset until the process restarts.
   */
  static clearAllCache() {
    const clearedRoles = Object.keys(this.menuCache).length;
    this.menuCache = {};
    console.log(`[MenuModel] Cleared menu cache for ${clearedRoles} role(s).`);
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

    // Invalidate cache for this role
    this.invalidateCache(roleId);

    return { success: true, message: 'Role menu permissions saved' };
  }

  /**
   * Get resolved menu for a user's role with caching
   * Returns the menu from cache if available, otherwise computes and caches it
   * @param {number} roleId - User's role ID
   * @returns {Array} Nested menu tree
   */
  static async getResolvedMenuForUser(roleId) {
    const cacheKey = `role_${roleId}`;
    
    // Check cache first
    if (this.menuCache[cacheKey]) {
      return this.menuCache[cacheKey].tree;
    }

    // Fetch menu items for this role and role permissions in parallel
    const [menuItems, rolePermissions] = await Promise.all([
      this.getAllMenuItems(roleId),
      this.getRoleMenuPermissions(roleId)
    ]);

    // Build and cache tree from role defaults
    const tree = this.buildMenuTree(menuItems, rolePermissions, roleId);
    this.menuCache[cacheKey] = { tree, roleId };
    
    return tree;
  }
}

module.exports = MenuModel;