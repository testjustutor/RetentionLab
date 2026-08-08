/**
 * controllers/sidebar/sidebarMenuAdminController.js
 * Sidebar menu admin controller
 */
const MenuModel = require('../../models/menu/MenuModel');
const RolesModel = require('../../models/roles/RolesModel');

const controller = {
  async getRoles(req, res) {
    try {
      const roles = await RolesModel.getAllRoles();
      res.json({ count: roles.length, data: roles });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getItems(req, res) {
    try {
      const roleId = parseInt(req.params.roleId);
      const items = await MenuModel.getAllMenuItems(roleId);
      const tree = await MenuModel.getResolvedMenuForUser(roleId);
      res.json({ count: items.length, flat: items, tree });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = controller;