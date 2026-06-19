/**
 * root/models/AuthModel.js
 */
const crypto = require('crypto');
const UsersModel = require('./UsersModel');
const RolesModel = require('./RolesModel');
const CompaniesModel = require('./CompaniesModel');
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

    // Determine registration type:
    //   data.role_name === 'solo_instructor' → self-registration, auto-create company
    //   data.role_name === 'instructor'      → join existing company by invitation/signup
    //   otherwise                            → default to 'instructor'
    const role_name = data.role_name === 'solo_instructor' ? 'solo_instructor'
                    : data.role_name === 'instructor'      ? 'instructor'
                    : 'instructor';

    const role = await RolesModel.getRoleByName(role_name);
    if (!role) throw new Error(`Role not found: ${role_name}`);

    let company_id = data.company_id || null;

    // ── Solo instructor: auto-create a personal company ────────
    if (role_name === 'solo_instructor' && !company_id) {
      const company_uuid = crypto.randomUUID();
      const company_code = `solo-${company_uuid.slice(0, 8)}`;
      const company = await CompaniesModel.createCompany({
        company_uuid,
        company_name: data.company_name || `${(data.first_name || 'Instructor')}'s Workspace`,
        company_code,
        company_type: 'solo',
        subscription_plan: 'free',
        subscription_status: 'active',
        status: 'active'
      });
      company_id = company.id;
    }

    // ── Require company_id for company-scoped roles ────────────
    if (['admin', 'reviewer', 'instructor'].includes(role_name) && !company_id) {
      throw new Error('A company association is required for this account type');
    }

    const password_hash = data.password ? hashPassword(data.password) : null;
    const createPayload = {
      ...data,
      role_id: role.id,
      company_id,
      is_company_owner: role_name === 'solo_instructor' ? 1 : 0,
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
