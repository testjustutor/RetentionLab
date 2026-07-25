/**
 * root/routes/sidebar-api.js
 */
/**
 * API route for dynamic sidebar navigation
 * GET /api/sidebar/menu - Returns menu structure based on user role + user overrides
 */
const MenuModel = require('../models/menu/MenuModel');

module.exports = async (req, res) => {
  try {
    const userId = req.user?.id;
    const roleId = req.user?.role_id;
    const userRole = req.user?.role_name || 'instructor';

    // Fetch menu from new system (role defaults + user overrides + caching)
    let menuTree = [];
    if (roleId) {
      try {
        menuTree = await MenuModel.getResolvedMenuForUser(userId, roleId);
      } catch (err) {
        console.error('sidebar-api: failed to load menu from DB:', err);
      }
    }

    res.json({
      success: true,
      role: userRole,
      menu: { menuItems: menuTree }
    });
  } catch (error) {
    console.error('Error fetching sidebar menu:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch menu'
    });
  }
};
