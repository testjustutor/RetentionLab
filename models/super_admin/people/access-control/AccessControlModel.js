/**
 * models/super_admin/people/access-control/AccessControlModel.js
 * Data access for the Super Admin "Access Control" feature.
 * All SQL lives in models — never in controllers or routes.
 *
 * Reuses UsersModel (listUsers/updateUser) and RolesModel/CompaniesModel so
 * pagination/role/company rules and update semantics stay consistent app-wide.
 */
const crypto = require('crypto');
const UsersModel = require('../../../users/UsersModel');
const RolesModel = require('../../../roles/RolesModel');
const CompaniesModel = require('../../../companies/CompaniesModel');

// Mirrors UsersModel.hashPassword (scrypt, "salt:derived") so reset passwords are compatible.
function hashPassword(password, salt = null) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const secretKey = process.env.PASSWORD_SECRET_KEY || '';
  const peppered = secretKey + password;
  const derived = crypto.scryptSync(peppered, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

class AccessControlModel {
  /**
   * All roles for the filter / edit dropdowns.
   * @returns {Promise<Array>}
   */
  static async listRoles() {
    return RolesModel.getAllRoles();
  }

  /**
   * All companies for the company filter / edit dropdown.
   * @returns {Promise<Array>}
   */
  static async listCompanies() {
    return CompaniesModel.getAllCompanies();
  }

  /**
   * List users (super_admin scope) with optional role filter.
   * @returns {Promise<{count:number, rows:Array}>}
   */
  static async listUsers(user, { roleId = null, fromDate = null, toDate = null } = {}) {
    return UsersModel.listUsers(user, { fromDate, toDate, roleId });
  }

  /**
   * Update a user's editable fields (whitelist): name, email, role, company,
   * is_active, password. Returns { updated, changes }.
   */
  static async updateUser(user, id, data) {
    const updates = {};
    if (data.first_name !== undefined) updates.first_name = data.first_name;
    if (data.last_name !== undefined) updates.last_name = data.last_name;
    if (data.email !== undefined) updates.email = data.email;
    if (data.role_id !== undefined) updates.role_id = Number(data.role_id) || null;
    if (data.company_id !== undefined) updates.company_id = Number(data.company_id) || null;
    if (data.is_active !== undefined) updates.is_active = data.is_active ? 1 : 0;
    if (data.password !== undefined && data.password) {
      updates.password_hash = hashPassword(data.password);
    } else if (data.password_hash !== undefined && data.password_hash) {
      updates.password_hash = data.password_hash;
    }
    if (Object.keys(updates).length === 0) return { updated: false, changes: 0 };
    return UsersModel.updateUser(user, id, updates);
  }
}

module.exports = AccessControlModel;
