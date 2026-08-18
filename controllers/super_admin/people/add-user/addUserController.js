/**
 * controllers/super_admin/people/add-user/addUserController.js
 * Create / update admin users for the Super Admin add-user page.
 * No SQL or model logic here — all data access goes through AddUserModel.
 */
const AddUserModel = require('../../../../models/super_admin/people/add-user/AddUserModel');

const controller = {
  /**
   * POST /api/super_admin/people/add-user/add-admin
   * Create a new admin user.
   */
  async createAdmin(req, res) {
    try {
      const { email, first_name, last_name, password_hash, role_id, company_id } = req.body || {};
      if (!email || !first_name || !password_hash || !role_id || !company_id) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields (email, first_name, password, role_id, company_id)'
        });
      }

      const created = await AddUserModel.createAdmin(req.user, {
        email,
        first_name,
        last_name: last_name || null,
        password_hash,
        role_id,
        company_id: Number(company_id)
      });

      return res.status(201).json({ success: true, data: created, message: 'Admin user created' });
    } catch (err) {
      console.error('[AddUser] createAdmin error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * PUT /api/super_admin/people/add-user/add-admin/:id
   * Update an existing admin user's editable fields.
   */
  async updateAdmin(req, res) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ success: false, error: 'Invalid admin id' });
      }

      const { first_name, last_name, email } = req.body || {};
      const result = await AddUserModel.updateAdmin(id, { first_name, last_name, email });

      return res.json({ success: true, data: result, message: 'Admin user updated' });
    } catch (err) {
      console.error('[AddUser] updateAdmin error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
};

module.exports = controller;
