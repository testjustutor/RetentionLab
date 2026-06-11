/**
 * root/models/AuthModel.js
 */
const crypto = require('crypto');
const UsersModel = require('./UsersModel');
const RolesModel = require('./RolesModel');
const { logger } = require('../utils/logger');

function hashPassword(password, salt = null) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

class AuthModel {
  static async register(data) {
    const existing = await UsersModel.getUserByEmail(data.email);
    if (existing) throw new Error('Email already registered');
    // Force public registrations to be 'employee' regardless of client-sent role_name
    const role_name = 'employee';
    const role = await RolesModel.getRoleByName(role_name);
    if (!role) throw new Error(`Role not found: ${role_name}`);

    const password_hash = data.password ? hashPassword(data.password) : null;
    const createPayload = {
      ...data,
      role_id: role.id,
      role_name: undefined,
      password_hash
    };

    const created = await UsersModel.createUser(createPayload);
    delete created.password_hash;
    return created;
  }

  static async authenticate(email, password) {
    const user = await UsersModel.getUserByEmail(email);
    if (!user) return null;
    const valid = verifyPassword(password, user.password_hash);
    if (!valid) return null;
    // update last_login_at
    try { await UsersModel.updateUser(user.id, { last_login_at: new Date().toISOString() }); } catch (e) { logger.warn('Failed to update last_login_at', e); }
    // strip sensitive
    delete user.password_hash;
    return user;
  }
}

module.exports = AuthModel;
