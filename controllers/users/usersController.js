/**
 * controllers/userController.js
 * Business logic for user CRUD and management.
 */
const crypto = require('crypto');
const UsersModel = require('../../models/users/UsersModel');
const RolesModel = require('../../models/roles/RolesModel');
const AuthModel = require('../../models/auth/AuthModel');

function ok(data, message) {
  return { success: true, message: message || null, ...(data || {}) };
}

function err(message, statusCode) {
  return { success: false, error: message, statusCode: statusCode || 500 };
}

const userController = {
  /**
   * GET /api/users
   * List users scoped to the requesting user's company with pagination and date filtering.
   * Query params: page, per_page, from_date, to_date
   * 
   * POST /api/users
   * List users with filters in request body (for role-based filtering).
   * Body params: role_id, page, per_page, from_date, to_date
   */
  async list(req) {
    try {
      let page, perPage, fromDate, toDate, roleId;

      if (req.method === 'POST' || req.body) {
        // POST request - get params from body
        roleId = req.body.role_id || null;
        page = parseInt(req.body.page) || 1;
        perPage = parseInt(req.body.per_page) || 10;
        fromDate = req.body.from_date || null;
        toDate = req.body.to_date || null;
      } else {
        // GET request - get params from query
        page = parseInt(req.query.page) || 1;
        perPage = parseInt(req.query.per_page) || 10;
        fromDate = req.query.from_date || null;
        toDate = req.query.to_date || null;
      }

      const result = await UsersModel.listUsers(req.user, { 
        limit: 200,
        page,
        perPage,
        fromDate,
        toDate,
        roleId
      });
      return ok({ count: result.count, data: result.rows });
    } catch (e) {
      if (e.message === 'Forbidden') return err('Forbidden', 403);
      return err(e.message);
    }
  },

  /**
   * GET /api/users/:id
   * Get single user by ID.
   */
  async getById(req) {
    try {
      const row = await UsersModel.getUserById(req.user, req.params.id);
      if (!row) return err('User not found', 404);
      return ok({ data: row });
    } catch (e) {
      if (e.message === 'Forbidden') return err('Forbidden', 403);
      return err(e.message);
    }
  },

  /**
   * POST /api/users
   * Create a new user. Admin can create reviewer/instructor only.
   */
  async create(req) {
    try {
      const data = req.body;
      if (!data.email) return err('Email is required', 400);

      // Validate role access
      if (data.role_id) {
        const role = await RolesModel.getRoleById(data.role_id);
        if (!role) return err('Role not found', 400);
        if (req.user.role_name === 'admin' && !['reviewer', 'instructor'].includes(role.role_name)) {
          return err('Admin may only create reviewer and instructor accounts', 403);
        }
      }

      // Set default password if not provided
      if (!data.password && !data.password_hash) {
        data.password = 'Password@123';
      }
      // Set default password if not provided
      if (!data.user_uuid) {
        data.user_uuid = crypto.randomUUID();
      }

      // Hash new password
      const password_hash = AuthModel.hashPassword(data.password);

      // If password is provided (not password_hash), use it
      if (data.password && !data.password_hash) {
        data.password_hash = data.password;
      }
      // Remove plain password from data object
      delete data.password;

      const created = await UsersModel.createUser(req.user, data);
      return ok({ data: created }, 'User created', 201);
    } catch (e) {
      if (e.message === 'Forbidden') return err('Forbidden', 403);
      return err(e.message);
    }
  },

  /**
   * PUT /api/users/:id
   * Update user fields (name, email, role, status, is_active).
   */
  async update(req) {
    try {
      const id = req.params.id;
      const changes = req.body;

      if (!Object.keys(changes).length) return err('No fields to update', 400);

      // Validate role if being changed
      if (changes.role_id) {
        const role = await RolesModel.getRoleById(changes.role_id);
        if (!role) return err('Role not found', 400);
        if (req.user.role_name === 'admin' && !['reviewer', 'instructor'].includes(role.role_name)) {
          return err('Admin may only assign reviewer and instructor roles', 403);
        }
      }

      const result = await UsersModel.updateUser(req.user, id, changes);
      if (!result.updated) return err('User not found or no changes made', 404);
      return ok({ result }, 'User updated');
    } catch (e) {
      if (e.message === 'Forbidden') return err('Forbidden', 403);
      return err(e.message);
    }
  },

  /**
   * DELETE /api/users/:id
   * Soft-delete a user.
   */
  async delete(req) {
    try {
      const result = await UsersModel.softDeleteUser(req.user, req.params.id);
      if (!result.deleted) return err('User not found', 404);
      return ok({ result }, 'User deleted');
    } catch (e) {
      if (e.message === 'Forbidden') return err('Forbidden', 403);
      return err(e.message);
    }
  },
};

module.exports = userController;