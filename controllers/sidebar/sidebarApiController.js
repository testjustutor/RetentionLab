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
          menuTree = await MenuModel.getResolvedMenuForUser(roleId);
        } catch (err) {
          console.error('sidebar-api: failed to load menu from DB:', err);
        }
      }

      // Remove href from logout menu items to prevent navigation
      // The frontend will handle logout via button click + API call
      menuTree = menuTree.map(item => {
        if (item.id === 'logout') {
          return { ...item, href: null, route_path: null };
        }
        return item;
      });

      const response = {
        success: true,
        role: userRole,
        menu: { menuItems: menuTree }
      };

      const debug = req.query.debug === '1' || req.query.debug === 'true';
      if (debug) {
        const allowedDebugRoles = ['super_admin', 'admin'];
        if (!allowedDebugRoles.includes(userRole)) {
          return res.status(403).json({ success: false, error: 'Debug access denied' });
        }
        response.debug = { rawMenuTree: menuTree };
      }

      res.json(response);
    } catch (error) {
      console.error('Error fetching sidebar menu:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch menu' });
    }
  }
};

module.exports = controller;