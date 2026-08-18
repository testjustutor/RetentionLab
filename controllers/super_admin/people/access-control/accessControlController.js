/**
 * controllers/super_admin/people/access-control/accessControlController.js
 * Access Control controllers — no business logic/SQL here, all data access
 * goes through AccessControlModel.
 */
const AccessControlModel = require('../../../../models/super_admin/people/access-control/AccessControlModel');

const controller = {
  /**
   * GET /api/super_admin/people/access-control/roles
   */
  async listRoles(req, res) {
    try {
      const roles = await AccessControlModel.listRoles();
      return res.json({ success: true, count: roles.length, data: roles });
    } catch (err) {
      console.error('[AccessControl] listRoles error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * GET /api/super_admin/people/access-control/companies
   */
  async listCompanies(req, res) {
    try {
      const companies = await AccessControlModel.listCompanies();
      return res.json({ success: true, count: companies.length, data: companies });
    } catch (err) {
      console.error('[AccessControl] listCompanies error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * POST /api/super_admin/people/access-control/users
   * List users (client-side pagination/search/filter happens in the frontend).
   */
  async listUsers(req, res) {
    try {
      const { role_id, from_date, to_date } = req.body || {};
      const result = await AccessControlModel.listUsers(req.user, {
        roleId: role_id || null,
        fromDate: from_date || null,
        toDate: to_date || null
      });
      return res.json({ success: true, count: result.count, data: result.rows });
    } catch (err) {
      console.error('[AccessControl] listUsers error:', err);
      return res.status(err.message === 'Forbidden' ? 403 : 500).json({ success: false, error: err.message });
    }
  },

  /**
   * PUT /api/super_admin/people/access-control/users/:id
   * Update a user: edit access (name/role/company), reset password, toggle status.
   */
  async updateUser(req, res) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ success: false, error: 'Invalid user id' });
      }
      const result = await AccessControlModel.updateUser(req.user, id, req.body || {});
      return res.json({ success: true, data: result, message: 'User updated' });
    } catch (err) {
      console.error('[AccessControl] updateUser error:', err);
      return res.status(err.message === 'Forbidden' ? 403 : 500).json({ success: false, error: err.message });
    }
  }
};

module.exports = controller;
