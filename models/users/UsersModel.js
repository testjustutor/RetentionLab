/**
 * root/models/UserModel.js
 */
const crypto = require('crypto');
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

function hashPassword(password, salt = null) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function isHashedPassword(value) {
  return typeof value === 'string' && value.includes(':') && value.split(':').length === 2;
}

class UsersModel {
  /**
   * Strip sensitive/internal fields from a user row before returning it in API responses.
   */
  static _sanitizeUser(row) {
    if (!row) return row;
    const clean = { ...row };
    delete clean.password_hash;
    delete clean.email_verified_at;
    delete clean.email_verification_token;
    delete clean.email_verification_expires_at;
    delete clean.password_reset_token;
    delete clean.password_reset_expires_at;
    delete clean.is_deleted;
    delete clean.deleted_by;
    delete clean.deleted_at;
    delete clean.created_by;
    delete clean.updated_by;
    return clean;
  }

  static _ensureAdminOrSuper(user) {
    if (!user || (user.role_name !== 'super_admin' && user.role_name !== 'admin')) {
      throw new Error('Forbidden');
    }
  }

  static async createUser(userOrData, maybeData) {
    const isAuthContext = userOrData && userOrData.id;
    const user = isAuthContext ? userOrData : null;
    const data = isAuthContext ? maybeData : userOrData;

    if (user) {
      UsersModel._ensureAdminOrSuper(user);
    }

    const insertData = {
      user_uuid: data.user_uuid || data.email || `user-${Date.now()}`,
      company_id: user ? (user.role_name === 'admin' ? user.company_id : data.company_id || null) : data.company_id || null,
      role_id: data.role_id || null,
      first_name: data.first_name || null,
      last_name: data.last_name || null,
      email: data.email,
      password_hash: data.password_hash || null,
      phone: data.phone || null,
      profile_image: data.profile_image || null,
      status: data.status || 'active',
      email_verified: data.email_verified || 0,
      email_verified_at: data.email_verified_at || null,
      email_verification_token: data.email_verification_token || null,
      email_verification_expires_at: data.email_verification_expires_at || null,
      password_reset_token: data.password_reset_token || null,
      password_reset_expires_at: data.password_reset_expires_at || null,
      is_company_owner: data.is_company_owner ? 1 : 0,
      created_by: user ? user.id : null
    };

    if (user && user.role_name === 'admin') {
      insertData.company_id = user.company_id;
    }

    // If attempting to create an 'admin' or 'reviewer' role, enforce creator restrictions.
    if (insertData.role_id) {
      const roleRow = await new Promise((resolve, reject) => {
        db.get(`SELECT role_name FROM roles WHERE id = ?`, [insertData.role_id], (err, row) => err ? reject(err) : resolve(row || null));
      });
      if (roleRow) {
        // Self-registration path (no authenticated user): allow solo_instructor only
        if (!user && !['solo_instructor', 'instructor'].includes(roleRow.role_name)) {
          throw new Error('Self-registration is only available for instructor roles');
        }
        // Super admin can create any role
        if (user?.role_name === 'super_admin') {
          // Super admin can create any role — no restriction
        }
        // Admin can only create reviewer and instructor accounts
        else if (user?.role_name === 'admin' && !['reviewer', 'instructor'].includes(roleRow.role_name)) {
          throw new Error('Admin may only create reviewer and instructor accounts');
        }
        // Require company_id for roles that need it
        if (['admin', 'reviewer', 'instructor'].includes(roleRow.role_name) && !insertData.company_id) {
          throw new Error(`${roleRow.role_name} users must be associated with a company (company_id required)`);
        }
      }
    }

    if (insertData.password_hash && !isHashedPassword(insertData.password_hash)) {
      insertData.password_hash = hashPassword(insertData.password_hash);
    }

    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO users (user_uuid, company_id, role_id, first_name, last_name, email, password_hash, phone, profile_image, status, email_verified, email_verified_at, email_verification_token, email_verification_expires_at, password_reset_token, password_reset_expires_at, is_company_owner, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
      db.run(sql, [
        insertData.user_uuid,
        insertData.company_id,
        insertData.role_id,
        insertData.first_name,
        insertData.last_name,
        insertData.email,
        insertData.password_hash,
        insertData.phone,
        insertData.profile_image,
        insertData.status,
        insertData.email_verified,
        insertData.email_verified_at,
        insertData.email_verification_token,
        insertData.email_verification_expires_at,
        insertData.password_reset_token,
        insertData.password_reset_expires_at,
        insertData.is_company_owner,
        insertData.created_by
      ], function(err) {
        if (err) {
          logger.error('Model(UsersModel): Create error', err);
          return reject(err);
        }
        const response = { id: this.lastID, ...insertData };
        delete response.password_hash;
        resolve(response);
      });
    });
  }

  static getUserByEmail(email) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT users.*, roles.role_name as role_name
         FROM users
         LEFT JOIN roles ON users.role_id = roles.id
         WHERE users.email = ? AND users.deleted_at IS NULL`,
        [email],
        (err, row) => err ? reject(err) : resolve(row || null)
      );
    });
  }

  static async getUserById(user, id) {
    if (typeof id === 'undefined' && user != null && typeof user !== 'object') {
      id = user;
      user = null;
    }

    const targetId = Number(id);
    if (!Number.isInteger(targetId)) return null;

    const isSelf = user && user.id === targetId;
    if (!isSelf && user) {
      UsersModel._ensureAdminOrSuper(user);
    }

    const row = await new Promise((resolve, reject) => {
      db.get(
        `SELECT users.*, roles.role_name as role_name
         FROM users
         LEFT JOIN roles ON users.role_id = roles.id
         WHERE users.id = ? AND users.deleted_at IS NULL`,
        [targetId],
        (err, rowData) => err ? reject(err) : resolve(rowData || null)
      );
    });
    if (!row) return null;
    if (user && !isSelf && user.role_name !== 'super_admin' && row.company_id !== user.company_id) {
      throw new Error('Forbidden');
    }
    return UsersModel._sanitizeUser(row);
  }

  static async listUsers(user, { limit = 200 } = {}) {
    UsersModel._ensureAdminOrSuper(user);
    if (user.role_name === 'admin') {
      return new Promise((resolve, reject) => {
        db.all(
          `SELECT users.*, roles.role_name as role_name
           FROM users
           LEFT JOIN roles ON users.role_id = roles.id
           WHERE users.deleted_at IS NULL AND users.company_id = ? AND users.id != ?
           ORDER BY users.created_at DESC LIMIT ?`,
          [user.company_id, user.id, limit],
          (err, rows) => {
            if (err) return reject(err);
            resolve((rows || []).map(r => UsersModel._sanitizeUser(r)));
          }
        );
      });
    }
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT users.*, roles.role_name as role_name
         FROM users
         LEFT JOIN roles ON users.role_id = roles.id
         WHERE users.deleted_at IS NULL AND users.id != ?
         ORDER BY users.created_at DESC LIMIT ?`,
        [user.id, limit],
        (err, rows) => {
          if (err) return reject(err);
          resolve((rows || []).map(r => UsersModel._sanitizeUser(r)));
        }
      );
    });
  }

  static async updateUser(userOrId, maybeId, changes) {
    let user = null;
    let id = null;

    if (typeof changes === 'undefined') {
      id = userOrId;
      changes = maybeId;
    } else {
      user = userOrId;
      id = maybeId;
      UsersModel._ensureAdminOrSuper(user);
    }

    const existing = user ? await UsersModel.getUserById(user, id) : await UsersModel.getUserById(id);
    if (!existing) return { updated: false };
    const keys = Object.keys(changes);
    if (!keys.length) return Promise.resolve({ updated: false });
    // Track who updated this record
    if (user && !changes.updated_by) {
      keys.push('updated_by');
      changes.updated_by = user.id;
    }
    const set = keys.map(k => `${k} = ?`).join(', ');
    const params = keys.map(k => changes[k]);
    params.push(id);
    return new Promise((resolve, reject) => {
      db.run(`UPDATE users SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params, function(err) {
        if (err) return reject(err);
        resolve({ updated: this.changes > 0, changes: this.changes });
      });
    });
  }

  static async softDeleteUser(user, id) {
    UsersModel._ensureAdminOrSuper(user);
    const existing = await UsersModel.getUserById(user, id);
    if (!existing) return { deleted: false };
    const ts = Date.now();
    const anonEmail = 'deleted_' + ts + '_' + (existing.email || 'user');
    const anonUuid  = 'deleted_' + ts + '_' + (existing.user_uuid || 'user');
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE users SET deleted_at = CURRENT_TIMESTAMP, status = "deleted",
         is_active = 0, is_deleted = 1, deleted_by = ?,
         email = ?, user_uuid = ? WHERE id = ?`,
        [user.id, anonEmail, anonUuid, id],
        function(err) {
          if (err) return reject(err);
          resolve({ deleted: this.changes > 0 });
        }
      );
    });
  }
}

module.exports = UsersModel;
