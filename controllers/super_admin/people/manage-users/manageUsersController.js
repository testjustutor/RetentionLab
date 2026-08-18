/**
 * controllers/super_admin/people/manage-users/manageUsersController.js
 * User Directory (manage-users) controllers — no business logic/SQL here,
 * all data access goes through ManageUsersModel (or roles/companies controllers
 * for the lookup dropdowns).
 */
const ManageUsersModel = require('../../../../models/super_admin/people/manage-users/ManageUsersModel');

const controller = {
  /**
   * GET /api/super_admin/people/manage-users/roles
   */
  async listRoles(req, res) {
    try {
      const roles = await ManageUsersModel.listRoles();
      return res.json({ success: true, count: roles.length, data: roles });
    } catch (err) {
      console.error('[ManageUsers] listRoles error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * GET /api/super_admin/people/manage-users/companies
   */
  async listCompanies(req, res) {
    try {
      const companies = await ManageUsersModel.listCompanies();
      return res.json({ success: true, count: companies.length, data: companies });
    } catch (err) {
      console.error('[ManageUsers] listCompanies error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * POST /api/super_admin/people/manage-users/users
   * List users (client-side pagination/search/filter happens in the frontend).
   */
  async listUsers(req, res) {
    try {
      const { role_id, from_date, to_date } = req.body || {};
      const result = await ManageUsersModel.listUsers(req.user, {
        roleId: role_id || null,
        fromDate: from_date || null,
        toDate: to_date || null
      });
      return res.json({ success: true, count: result.count, data: result.rows });
    } catch (err) {
      console.error('[ManageUsers] listUsers error:', err);
      return res.status(err.message === 'Forbidden' ? 403 : 500).json({ success: false, error: err.message });
    }
  },

  /**
   * PUT /api/super_admin/people/manage-users/users/:id
   * Update a user: edit (name/role/company), reset password, or toggle status.
   */
  async updateUser(req, res) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ success: false, error: 'Invalid user id' });
      }
      const result = await ManageUsersModel.updateUser(req.user, id, req.body || {});
      return res.json({ success: true, data: result, message: 'User updated' });
    } catch (err) {
      console.error('[ManageUsers] updateUser error:', err);
      return res.status(err.message === 'Forbidden' ? 403 : 500).json({ success: false, error: err.message });
    }
  }
};

module.exports = controller;
