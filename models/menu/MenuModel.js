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
   * Get all active menu items for a role together with that role's saved
   * permission (is_visible / sort_order / parent_id override) in a SINGLE
   * query, instead of two separate queries (getAllMenuItems +
   * getRoleMenuPermissions) merged together in JS. Used by the read/list
   * side of the Sidebar Menu Management page
   * (POST /api/super_admin/sidebar-menu-management/permissions) to cut
   * that endpoint down to one DB round trip.
   *
   * Preserves the same parent_id resolution rule as getRoleMenuPermissions:
   * role_menu_permissions.parent_id can reference either a menu_item_id or
   * another role_menu_permissions.id, so a row-id -> menu_item_id map is
   * still built (from this same result set) before resolving it.
   *
   * @param {number} roleId
   * @returns {Array} One row per menu item: { id, menu_key, label, icon,
   *   route_path, parent_id, is_visible, sort_order, has_permission }
   */
  static async getMenuItemsWithPermissions(roleId) {
    const { allAsync } = this.getHelpers();
    const rows = await allAsync(
      `SELECT
         mi.id AS menu_item_id, mi.menu_key, mi.label, mi.icon, mi.route_path,
         mi.parent_id AS default_parent_id, mi.sort_order AS default_sort_order,
         rmp.id AS permission_id,
         rmp.is_visible AS permission_is_visible,
         rmp.sort_order AS permission_sort_order,
         rmp.parent_id AS permission_parent_id
       FROM menu_items mi
       LEFT JOIN role_menu_permissions rmp
         ON rmp.menu_item_id = mi.id AND rmp.role_id = ?
       WHERE mi.is_active = 1 AND mi.role_id = ?
       ORDER BY mi.sort_order ASC, mi.id ASC`,
      [roleId, roleId]
    );

    const permissionRowIdToMenuItemId = {};
    for (const row of rows) {
      if (row.permission_id != null) {
        permissionRowIdToMenuItemId[row.permission_id] = row.menu_item_id;
      }
    }

    return rows.map(row => {
      const hasPermission = row.permission_id != null;

      let parentId = hasPermission ? row.permission_parent_id : null;
      if (parentId && permissionRowIdToMenuItemId[parentId]) {
        parentId = permissionRowIdToMenuItemId[parentId];
      }
      if (parentId === null || parentId === undefined) {
        parentId = row.default_parent_id;
      }

      return {
        id: row.menu_item_id,
        menu_key: row.menu_key,
        label: row.label,
        icon: row.icon,
        route_path: row.route_path,
        parent_id: parentId,
        is_visible: hasPermission ? row.permission_is_visible : 0,
        sort_order: hasPermission ? row.permission_sort_order : row.default_sort_order,
        has_permission: hasPermission
      };
    });
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

    return this._nestByParentId(Object.values(itemMap));
  }

  /**
   * Shared second pass used by every "flat list -> nested tree" builder in
   * this model: group nodes under their parent_id (already-resolved to a
   * menu_item_id) and sort every level by sort_order. Nodes must already
   * have a `children: []` array. Extracted out of buildMenuTree so
   * getRoleMenuTree() below can reuse the exact same nesting/sorting rule
   * instead of re-implementing it.
   * @param {Array} nodes - flat nodes, each with id, parent_id, sort_order, children
   * @returns {Array} top-level nodes, each with nested `children`
   */
  static _nestByParentId(nodes) {
    const nodeById = {};
    for (const node of nodes) {
      nodeById[node.id] = node;
    }

    const tree = [];
    for (const node of nodes) {
      if (node.parent_id && nodeById[node.parent_id]) {
        nodeById[node.parent_id].children.push(node);
      } else {
        tree.push(node);
      }
    }

    const sortByOrder = (list) => {
      list.sort((a, b) => a.sort_order - b.sort_order);
      list.forEach(node => sortByOrder(node.children));
    };
    sortByOrder(tree);

    return tree;
  }

  /**
   * Get a role's FULL menu as a nested tree — including hidden items,
   * unlike buildMenuTree()/getResolvedMenuForUser() which only build the
   * tree the sidebar actually renders (visible items only). This is what
   * the Sidebar Menu Management admin page needs: every item, in its real
   * hierarchy, each carrying its own is_visible flag so the page can offer
   * a single show/hide toggle per row without the frontend re-deriving the
   * parent/child structure itself.
   *
   * Data-fetching approach: ONE joined DB query
   * (getMenuItemsWithPermissions), then the tree is nested/sorted in
   * application code via the same _nestByParentId() helper buildMenuTree
   * uses — no second query, no route/route-scanning per node.
   *
   * @param {number} roleId
   * @returns {Array} nested tree; each node has
   *   { id, menu_key, label, icon, route_path, parent_id, sort_order, is_visible, children }
   */
  static async getRoleMenuTree(roleId) {
    const items = await this.getMenuItemsWithPermissions(roleId);

    const nodes = items.map(item => ({
      id: item.id,
      menu_key: item.menu_key,
      label: item.label,
      icon: item.icon,
      route_path: item.route_path,
      parent_id: item.parent_id,
      sort_order: item.sort_order,
      is_visible: !!item.is_visible,
      children: []
    }));

    return this._nestByParentId(nodes);
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

    // Bulk insert new permissions in a single round trip instead of
    // one INSERT per row (was N sequential awaited queries — the cause
    // of this endpoint being slow for roles with many menu items).
    if (Array.isArray(permissions) && permissions.length > 0) {
      const valuesSql = permissions.map(() => '(?, ?, ?, ?, ?)').join(', ');
      const params = [];
      for (const perm of permissions) {
        params.push(
          roleId,
          perm.menu_item_id,
          perm.is_visible ? 1 : 0,
          perm.sort_order || 0,
          perm.parent_id || null
        );
      }

      await runAsync(
        `INSERT INTO role_menu_permissions (role_id, menu_item_id, is_visible, sort_order, parent_id)
         VALUES ${valuesSql}`,
        params
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