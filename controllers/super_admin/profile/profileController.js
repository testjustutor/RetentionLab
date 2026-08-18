/**
 * controllers/super_admin/profile/profileController.js
 * Super Admin profile logic — only calls models.
 */
const UsersModel = require('../../../models/super_admin/users/UsersModel');
const AuthModel = require('../../../models/auth/AuthModel'); // for hashPassword/verifyPassword utils

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /** GET /api/super_admin/people/profile/me — current logged-in user */
  async me(req) {
    try {
      const id = req.user.id;
      const row = await UsersModel.getUserById(req.user, id);
      if (!row) return err('User not found', 404);
      return ok({ data: row });
    } catch (e) {
      return err(e.message);
    }
  },

  /** POST /api/super_admin/people/profile/change-password — change own password */
  async changePassword(req) {
    try {
      const { current_password, new_password } = req.body;
      if (!current_password || !new_password) return err('Current and new password required', 400);
      if (String(new_password).length < 6) return err('New password must be at least 6 characters', 400);

      const user = await UsersModel.getUserById(req.user, req.user.id);
      if (!user) return err('User not found', 404);

      const valid = AuthModel.verifyPassword(current_password, user.password_hash);
      if (!valid) return err('Current password is incorrect', 401);

      const newHash = AuthModel.hashPassword(new_password);
      await UsersModel.updateUser(req.user, req.user.id, { password_hash: newHash });
      return ok({}, 'Password changed successfully');
    } catch (e) {
      return err(e.message);
    }
  },

  /** PUT /api/super_admin/people/profile/:id — update own fields */
  async update(req) {
    try {
      const id = req.params.id;
      const changes = req.body;
      if (!Object.keys(changes).length) return err('No fields to update', 400);
      const result = await UsersModel.updateUser(req.user, id, changes);
      if (!result.updated) return err('User not found or no changes', 404);
      return ok({ result }, 'Profile updated');
    } catch (e) {
      return err(e.message);
    }
  }
};

module.exports = controller;