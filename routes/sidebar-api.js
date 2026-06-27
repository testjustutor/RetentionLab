/**
 * root/routes/sidebar-api.js
 */
/**
 * API route for dynamic sidebar navigation
 * GET /api/sidebar/menu - Returns menu structure based on user role
 */
const { HeaderConfigModel } = require('../models/HeaderConfigModel');

module.exports = async (req, res) => {
  try {
    const roleId = req.user?.role_id;
    const userRole = req.user?.role_name || 'instructor';

    // Fetch menu from database
    let menuItems = null;
    if (roleId) {
      try {
        menuItems = await HeaderConfigModel.getMenuItemsByRoleId(roleId);
      } catch (err) {
        console.error('sidebar-api: failed to load menu from DB:', err);
      }
    }

    res.json({
      success: true,
      role: userRole,
      menu: { menuItems: menuItems || [] }
    });
  } catch (error) {
    console.error('Error fetching sidebar menu:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch menu'
    });
  }
};
