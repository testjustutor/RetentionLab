/**
 * controllers/reviewer/profile/profileController.js
 * Reviewer profile logic — only calls models. Self-service only (a reviewer
 * may view/update their own profile; there is no admin-on-behalf-of path here).
 * Mirrors controllers/student/profile/profileController.js.
 */
const UsersModel = require('../../../models/users/UsersModel');
const AuthModel = require('../../../models/auth/AuthModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /** GET /api/reviewer/profile/me — current logged-in user */
  async me(req) {
    try {
      const row = await UsersModel.getUserById(req.user, req.user.id);
      if (!row) return err('User not found', 404);
      return ok({ data: row });
    } catch (e) {
      return err(e.message);
    }
  },

  /** POST /api/reviewer/profile/change-password — change own password */
  async changePassword(req) {
    try {
      const { current_password, new_password } = req.body;
      if (!current_password || !new_password) return err('Current and new password required', 400);
      if (String(new_password).length < 6) return err('New password must be at least 6 characters', 400);

      // getUserById() strips password_hash from the row before returning it,
      // so fetch the raw row (by email) to verify the current password.
      const rawUser = await UsersModel.getUserByEmail(req.user.email);
      if (!rawUser) return err('User not found', 404);

      const valid = AuthModel.verifyPassword(current_password, rawUser.password_hash);
      if (!valid) return err('Current password is incorrect', 401);

      const newHash = AuthModel.hashPassword(new_password);
      // 2-arg form: self-service, no admin gate (this endpoint is already scoped to req.user.id).
      await UsersModel.updateUser(req.user.id, { password_hash: newHash });
      return ok({}, 'Password changed successfully');
    } catch (e) {
      return err(e.message);
    }
  },

  /** PUT /api/reviewer/profile/:id — update own fields (self only) */
  async update(req) {
    try {
      const id = req.params.id;
      if (String(id) !== String(req.user.id)) return err('You may only update your own profile', 403);

      const changes = { ...(req.body || {}) };
      // Self-service can never change role, company, status or password this way.
      delete changes.role_id;
      delete changes.company_id;
      delete changes.status;
      delete changes.password_hash;

      if (!Object.keys(changes).length) return err('No fields to update', 400);

      const result = await UsersModel.updateUser(id, changes); // 2-arg form: no admin gate
      if (!result.updated) return err('User not found or no changes', 404);
      return ok({ result }, 'Profile updated');
    } catch (e) {
      return err(e.message);
    }
  }
};

module.exports = controller;
