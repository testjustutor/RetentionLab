/**
 * root/models/AuthModel.js
 */
const crypto = require('crypto');
const UsersModel = require('../users/UsersModel');
const RolesModel = require('../roles/RolesModel');
const CompaniesModel = require('../companies/CompaniesModel');
const { logger } = require('../../../utils/logger');

function hashPassword(password, salt = null) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const secretKey = process.env.PASSWORD_SECRET_KEY || '';
  const pepperedPassword = secretKey + password;
  const derived = crypto.scryptSync(pepperedPassword, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const secretKey = process.env.PASSWORD_SECRET_KEY || '';
  const pepperedPassword = secretKey + password;
  const derived = crypto.scryptSync(pepperedPassword, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

class AuthModel {
  static async register(data) {
    const email = String(data.email || '').trim().toLowerCase();
    if (!email) throw new Error('Email is required');
    const existing = await UsersModel.getUserByEmail(email);
    if (existing) throw new Error('Email already registered');

    const role_name = 'solo_instructor';

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
      email,
      role_id: role.id,
      company_id,
      is_company_owner: role_name === 'solo_instructor' ? 1 : 0,
      role_name: undefined,
      password_hash,
      status: data.status || 'active',
      email_verified: 0
    };

    const created = await UsersModel.createUser(createPayload);
    delete created.password_hash;
    return created;
  }

  static async authenticate(email, password) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await UsersModel.getUserByEmail(normalizedEmail);
    if (!user) return null;
    if (user.status !== 'active' || user.is_deleted) {
      throw new Error('This account is not active. Contact support.');
    }
    if (!user.email_verified) {
      throw new Error('Email not verified. Please check your inbox.');
    }
    const valid = verifyPassword(password, user.password_hash);
    if (!valid) return null;
    try { await UsersModel.updateUser(user.id, { last_login_at: new Date().toISOString() }); } catch (e) { logger.warn('Failed to update last_login_at', e); }
    delete user.password_hash;
    return user;
  }
}

AuthModel.hashPassword = hashPassword;
module.exports = AuthModel;
