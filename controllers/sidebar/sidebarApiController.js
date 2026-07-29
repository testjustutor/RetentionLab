/**
 * controllers/sidebar/sidebarApiController.js
 * Sidebar API controller
 */
const MenuModel = require('../../models/menu/MenuModel');

const controller = {
  async getMenu(req, res) {
    try {
      const userId = req.user?.id;
      const roleId = req.user?.role_id;
      const userRole = req.user?.role_name || 'instructor';

      let menuTree = [];
      if (roleId) {
        try {
          menuTree = await MenuModel.getResolvedMenuForUser(userId, roleId);
        } catch (err) {
          console.error('sidebar-api: failed to load menu from DB:', err);
        }
      }

      function fixRoutePaths(items, role) {
        if (!items || !Array.isArray(items)) return items;
        return items.map(item => {
          const fixed = { ...item };
          if (fixed.route_path && role !== 'super_admin') {
            fixed.route_path = fixRoutePath(fixed.route_path, role);
          }
          if (fixed.children && Array.isArray(fixed.children)) {
            fixed.children = fixRoutePaths(fixed.children, role);
          }
          return fixed;
        });
      }

      function fixRoutePath(path, role) {
        if (!path.startsWith('/super_admin/')) return path;

        if (role === 'admin') {
          if (path === '/super_admin/dashboard/index') return '/admin';
          if (path === '/super_admin/people/profile') return '/admin/profile';
          if (path === '/super_admin/storage/archives') return '/admin/archives';
          return path.replace(/^\/super_admin\//, '/admin/');
        }

        if (role === 'reviewer') {
          return path.replace(/^\/super_admin\//, '/reviewer/');
        }

        if (role === 'instructor' || role === 'solo_instructor') {
          return path.replace(/^\/super_admin\//, '/instructor/');
        }

        return path;
      }

      const fixedMenuTree = fixRoutePaths(menuTree, userRole);

      const response = {
        success: true,
        role: userRole,
        menu: { menuItems: fixedMenuTree }
      };

      const debug = req.query.debug === '1' || req.query.debug === 'true';
      if (debug) {
        const allowedDebugRoles = ['super_admin', 'admin'];
        if (!allowedDebugRoles.includes(userRole)) {
          return res.status(403).json({ success: false, error: 'Debug access denied' });
        }
        response.debug = { rawMenuTree: menuTree, fixedMenuTree };
      }

      res.json(response);
    } catch (error) {
      console.error('Error fetching sidebar menu:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch menu' });
    }
  }
};

module.exports = controller;