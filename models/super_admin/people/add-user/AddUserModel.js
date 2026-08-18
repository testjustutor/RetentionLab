/**
 * models/super_admin/people/add-user/AddUserModel.js
 * Data access for the Super Admin "Add Admin" (add-user) feature.
 * All SQL lives in models — never in controllers or routes.
 *
 * Create/update operations reuse UsersModel (createUser/updateUser) so password
 * hashing, user_uuid generation, and role/company rules stay consistent app-wide.
 */
const crypto = require('crypto');
const UsersModel = require('../../../users/UsersModel');

class AddUserModel {
  /**
   * Create a new admin user.
   * @param {object} user - authenticated super admin (req.user)
   * @param {object} data - { email, first_name, last_name, password_hash, role_id, company_id }
   * @returns {Promise<object>} created user row (password_hash removed)
   */
  static async createAdmin(user, data) {
    const payload = {
      user_uuid: data.user_uuid || crypto.randomUUID(),
      company_id: data.company_id || null,
      role_id: data.role_id,
      first_name: data.first_name,
      last_name: data.last_name || null,
      email: data.email,
      password_hash: data.password_hash,
      status: data.status || 'active',
      email_verified: data.email_verified || 0
    };
    return UsersModel.createUser(user, payload);
  }

  /**
   * Update an admin user's editable fields (whitelist only).
   * @param {number} id - user id
   * @param {object} data - fields to update (first_name, last_name, email)
   * @returns {Promise<object>} { updated, changes }
   */
  static async updateAdmin(id, data) {
    const allowedFields = ['first_name', 'last_name', 'email'];
    const updates = {};
    allowedFields.forEach((field) => {
      if (data[field] !== undefined) updates[field] = data[field];
    });
    if (Object.keys(updates).length === 0) return { updated: false, changes: 0 };
    return UsersModel.updateUser(id, updates);
  }
}

module.exports = AddUserModel;
