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

      // getUserById() strips password_hash from the row before returning it,
      // so fetch the raw row (by email) to verify the current password.
      const user = await UsersModel.getUserByEmail(req.user.email);
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

  /** PUT /api/super_admin/people/profile/:id — update own fields (self only) */
  async update(req) {
    try {
      const id = req.params.id;
      // FIX: this endpoint had no self-only check and forwarded req.body
      // untouched, unlike its 3 siblings (controllers/instructor,
      // controllers/reviewer, controllers/student /profile/profileController.js
      // update()), which all reject id !== req.user.id and strip
      // role_id/company_id/status/password_hash before calling UsersModel so
      // this self-service route can never be used to re-role, re-company,
      // reactivate/deactivate, or overwrite the password hash of the caller's
      // own account. Ported both checks here; the UsersModel.updateUser call
      // keeps its existing 3-arg (actor, id, changes) form — unlike the
      // siblings' 2-arg form — because models/super_admin/users/UsersModel.js's
      // updateUser requires the actor for its internal admin-permission
      // checks (a super_admin actor already has unrestricted permission
      // there, so this is a no-op for a legitimate self-update and only
      // matters as defense in depth).
      if (String(id) !== String(req.user.id)) return err('You may only update your own profile', 403);

      const changes = { ...(req.body || {}) };
      // Self-service can never change role, company, status or password this way.
      delete changes.role_id;
      delete changes.company_id;
      delete changes.status;
      delete changes.password_hash;

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