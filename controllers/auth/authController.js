/**
 * controllers/authController.js
 * Business logic for authentication operations.
 */

const crypto = require('crypto');
const AuthModel = require('../../models/auth/AuthModel');
const UsersModel = require('../../models/users/UsersModel');
const { signToken, JWT_EXPIRES_MS, verifyToken } = require('../../middleware/auth');
const { sendMail } = require('../../utils/mailer');
const { logger } = require('../../utils/logger');

// Response helpers
function sendResponse(res, result) {
  const statusCode = result.statusCode || (result.success ? 200 : 500);
  const { statusCode: _sc, success: _s, message: _m, error: _e, ...extraFields } = result;
  const body = {
    success: result.success,
    ...(result.message ? { message: result.message } : {}),
    ...(result.error ? { error: result.error } : {}),
    ...(result.data || {}),
    ...extraFields
  };
  res.status(statusCode).json(body);
}

function success(data, message, statusCode = 200) {
  return { success: true, message: message || null, statusCode, ...(data || {}) };
}

function failure(message, statusCode = 500) {
  return { success: false, error: message, statusCode };
}

// Validation helpers
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  if (!password || password.length < 10) return 'Password must be at least 10 characters';
  return null;
}

// Email helpers
function buildVerificationLink(req, token) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers.host;
  return `${protocol}://${host}/verify-email?token=${encodeURIComponent(token)}`;
}

function buildResetLink(req, token) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers.host;
  return `${protocol}://${host}/reset-password.html?token=${encodeURIComponent(token)}`;
}

async function sendVerificationEmail(user, req) {
  if (!process.env.SMTP_HOST) { logger.warn('SMTP not configured, skipping verification email'); return; }
  const link = buildVerificationLink(req, user.email_verification_token);
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Verify Your Email</title></head><body style="margin:0;padding:0;font-family:Segoe UI,Arial,sans-serif;background-color:#f8fafc;color:#334155;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;"><tr><td align="center"><table role="presentation" width="100%" max-width="600px" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);"><tr><td style="background:linear-gradient(135deg,#1f65c2,#1b4f97);padding:32px 24px;text-align:center;"><h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:700;">RetentionLab</h1><p style="margin:8px 0 0;color:#e0f2fe;font-size:14px;">Meeting Intelligence Platform</p></td></tr><tr><td style="padding:20px 24px 0 24px;text-align:center;"><p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;"><strong style="color:#1f65c2;">www.retentionlab.com</strong> &nbsp;|&nbsp;<a href="mailto:support@retentionlab.com" style="color:#1f65c2;text-decoration:none;">support@retentionlab.com</a></p></td></tr><tr><td style="padding:32px 24px;"><h2 style="margin:0 0 16px 0;font-size:20px;color:#1f65c2;font-weight:600;">Verify Your Email Address</h2><p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#475569;">Hello ${user.first_name || 'there'},</p><p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#475569;">Thank you for creating an account with RetentionLab. To complete your registration and access all features, please verify your email address by clicking the button below.</p><table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px auto;"><tr><td style="background:linear-gradient(135deg,#1f65c2,#1b4f97);border-radius:10px;padding:14px 32px;"><a href="${link}" style="display:inline-block;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.3px;">Verify Email Address</a></td></tr></table><p style="margin:0 0 16px 0;font-size:13px;color:#64748b;line-height:1.5;"><strong>What happens after verification?</strong></p><ul style="margin:0 0 16px 0;padding-left:20px;font-size:13px;color:#64748b;line-height:1.6;"><li>Full access to your dashboard and tools</li><li>AI-powered meeting insights and summaries</li><li>Calendar sync and session tracking</li><li>Team collaboration features</li></ul><p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">This link will expire in 24 hours. If you did not create an account, please ignore this email.</p></td></tr><tr><td style="padding:0 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;"><tr><td style="font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr><tr><td style="padding:24px;text-align:center;background-color:#f8fafc;"><p style="margin:0 0 8px 0;font-size:12px;color:#64748b;line-height:1.5;"><strong style="color:#1f65c2;">RetentionLab</strong> &middot; Meeting Intelligence Platform</p><p style="margin:0 0 8px 0;font-size:11px;color:#94a3b8;line-height:1.5;"><a href="https://www.retentionlab.com" style="color:#1f65c2;text-decoration:none;">www.retentionlab.com</a> &nbsp;|&nbsp;<a href="mailto:support@retentionlab.com" style="color:#1f65c2;text-decoration:none;">support@retentionlab.com</a></p><p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">&copy; 2026 RetentionLab. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`;
  await sendMail({ to: user.email, subject: 'Verify your RetentionLab account', html, purpose: 'email_verification' });
}

async function sendResetEmail(user, req) {
  if (!process.env.SMTP_HOST) { logger.warn('SMTP not configured, skipping reset email'); return; }
  const link = buildResetLink(req, user.password_reset_token);
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Reset Your Password</title></head><body style="margin:0;padding:0;font-family:Segoe UI,Arial,sans-serif;background-color:#f8fafc;color:#334155;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;"><tr><td align="center"><table role="presentation" width="100%" max-width="600px" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);"><tr><td style="background:linear-gradient(135deg,#1f65c2,#1b4f97);padding:32px 24px;text-align:center;"><h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:700;">RetentionLab</h1><p style="margin:8px 0 0;color:#e0f2fe;font-size:14px;">Meeting Intelligence Platform</p></td></tr><tr><td style="padding:20px 24px 0 24px;text-align:center;"><p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;"><strong style="color:#1f65c2;">www.retentionlab.com</strong> &nbsp;|&nbsp;<a href="mailto:support@retentionlab.com" style="color:#1f65c2;text-decoration:none;">support@retentionlab.com</a></p></td></tr><tr><td style="padding:32px 24px;"><h2 style="margin:0 0 16px 0;font-size:20px;color:#1f65c2;font-weight:600;">Reset Your Password</h2><p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#475569;">Hello ${user.first_name || 'there'},</p><p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#475569;">We received a request to reset your password for your RetentionLab account. Click the button below to create a new password.</p><table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px auto;"><tr><td style="background:linear-gradient(135deg,#1f65c2,#1b4f97);border-radius:10px;padding:14px 32px;"><a href="${link}" style="display:inline-block;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.3px;">Reset Password</a></td></tr></table><p style="margin:0 0 16px 0;font-size:13px;color:#64748b;line-height:1.5;"><strong>Security tips:</strong></p><ul style="margin:0 0 16px 0;padding-left:20px;font-size:13px;color:#64748b;line-height:1.6;"><li>Use a strong, unique password</li><li>Include numbers and special characters</li><li>Do not share your password with anyone</li></ul><p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">This link will expire in 1 hour. If you did not request a password reset, please ignore this email or contact support if you have concerns.</p></td></tr><tr><td style="padding:0 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;"><tr><td style="font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr><tr><td style="padding:24px;text-align:center;background-color:#f8fafc;"><p style="margin:0 0 8px 0;font-size:12px;color:#64748b;line-height:1.5;"><strong style="color:#1f65c2;">RetentionLab</strong> &middot; Meeting Intelligence Platform</p><p style="margin:0 0 8px 0;font-size:11px;color:#94a3b8;line-height:1.5;"><a href="https://www.retentionlab.com" style="color:#1f65c2;text-decoration:none;">www.retentionlab.com</a> &nbsp;|&nbsp;<a href="mailto:support@retentionlab.com" style="color:#1f65c2;text-decoration:none;">support@retentionlab.com</a></p><p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">&copy; 2026 RetentionLab. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`;
  await sendMail({ to: user.email, subject: 'Reset your RetentionLab password', html, purpose: 'password_reset' });
}

const authController = {
  async register(req, res) {
    try {
      const { email, password, first_name, last_name, company_name } = req.body;
      if (!email) return sendResponse(res, failure('Email is required', 400));
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!validateEmail(normalizedEmail)) return sendResponse(res, failure('Invalid email format', 400));
      const passwordError = validatePassword(password);
      if (passwordError) return sendResponse(res, failure(passwordError, 400));

      const created = await AuthModel.register({ email: normalizedEmail, password, first_name, last_name, company_name });
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const verificationData = process.env.SMTP_HOST
        ? { email_verification_token: token, email_verification_expires_at: expiresAt, email_verified: 0, email_verified_at: null }
        : { email_verified: 1, email_verified_at: new Date().toISOString() };

      await UsersModel.updateUser(created.id, verificationData);
      const user = await UsersModel.getUserById(created.id);

      if (user && process.env.SMTP_HOST) {
        await sendVerificationEmail(user, req);
        return sendResponse(res, success({ status: 'pending_verification' }, 'Account created. Please verify your email to continue.', 201));
      }
      return sendResponse(res, success({ status: 'verified' }, 'Account created. Email verification is disabled for local setup; you can sign in now.', 201));
    } catch (err) {
      logger.error('Registration error:', err);
      if (err.message.includes('Email already registered')) return sendResponse(res, failure('Email already registered', 409));
      return sendResponse(res, failure(err.message || 'Registration failed', 400));
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) return sendResponse(res, failure('Email and password are required', 400));
      const normalizedEmail = String(email).trim().toLowerCase();
      const user = await AuthModel.authenticate(normalizedEmail, password);
      if (!user) { logger.warn(`Failed login attempt for email: ${normalizedEmail}`); return sendResponse(res, failure('Invalid credentials', 401)); }

      const token = signToken(user);
      const isSecure = process.env.NODE_ENV === 'production';
      res.cookie('auth_token', token, { httpOnly: true, sameSite: 'lax', secure: isSecure, maxAge: JWT_EXPIRES_MS });
      logger.info(`User logged in: ${user.email} (ID: ${user.id})`);
      return sendResponse(res, success({ user, expiresIn: JWT_EXPIRES_MS }, 'Login successful', 200));
    } catch (err) {
      logger.error('Login error:', err);
      if (err.message.includes('Email not verified')) return sendResponse(res, failure(err.message, 403));
      if (err.message.includes('not active')) return sendResponse(res, failure(err.message, 403));
      return sendResponse(res, failure('Authentication failed', 401));
    }
  },

  async logout(req, res) {
    try {
      const userId = req.user?.id;
      res.clearCookie('auth_token', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
      if (userId) logger.info(`User logged out: ${userId}`);
      return sendResponse(res, success({}, 'Logout successful', 200));
    } catch (err) {
      logger.error('Logout error:', err);
      return sendResponse(res, failure('Logout failed', 500));
    }
  },

  async forgotPassword(req, res) {
    try {
      const { email } = req.body || {};
      if (!email) return sendResponse(res, failure('Email is required', 400));
      const normalizedEmail = String(email).trim().toLowerCase();
      const user = await UsersModel.getUserByEmail(normalizedEmail);
      if (!user) { logger.info(`Password reset requested for non-existent email: ${normalizedEmail}`); return sendResponse(res, success({}, 'If an account exists, a reset email will be sent', 200)); }
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await UsersModel.updateUser(user.id, { password_reset_token: token, password_reset_expires_at: expiresAt });
      await sendResetEmail({ ...user, password_reset_token: token }, req);
      logger.info(`Password reset email sent to: ${normalizedEmail}`);
      return sendResponse(res, success({}, 'If an account exists, a reset email will be sent', 200));
    } catch (err) {
      logger.error('Forgot password error:', err);
      return sendResponse(res, failure('Failed to process password reset request', 500));
    }
  },

  async resetPassword(req, res) {
    try {
      const { token, password } = req.body || {};
      if (!token || !password) return sendResponse(res, failure('Token and password are required', 400));
      const passwordError = validatePassword(password);
      if (passwordError) return sendResponse(res, failure(passwordError, 400));

      const { db } = require('../../database/db');
      const user = await new Promise((resolve, reject) => {
        db.get(`SELECT users.*, roles.role_name as role_name FROM users LEFT JOIN roles ON users.role_id = roles.id WHERE password_reset_token = ? AND deleted_at IS NULL`, [token], (err, row) => err ? reject(err) : resolve(row || null));
      });
      if (!user) return sendResponse(res, failure('Invalid password reset token', 400));
      if (!user.password_reset_expires_at || new Date(user.password_reset_expires_at).getTime() < Date.now()) return sendResponse(res, failure('Password reset token expired', 400));

      const password_hash = AuthModel.hashPassword(password);
      await UsersModel.updateUser(user.id, { password_hash, password_reset_token: null, password_reset_expires_at: null, email_verified: 1, email_verified_at: new Date().toISOString() });
      const updatedUser = await UsersModel.getUserById(user.id);
      const jwtToken = signToken(updatedUser);
      const isSecure = process.env.NODE_ENV === 'production';
      res.cookie('auth_token', jwtToken, { httpOnly: true, sameSite: 'lax', secure: isSecure, maxAge: JWT_EXPIRES_MS });
      logger.info(`Password reset successful for user: ${user.email}`);
      return sendResponse(res, success({ user: updatedUser, expiresIn: JWT_EXPIRES_MS }, 'Password reset successful', 200));
    } catch (err) {
      logger.error('Reset password error:', err);
      return sendResponse(res, failure('Failed to reset password', 500));
    }
  },

  async verifyEmail(req, res) {
    try {
      const { token } = req.body || {};
      if (!token) return sendResponse(res, failure('Verification token is required', 400));
      const { db } = require('../../database/db');
      const user = await new Promise((resolve, reject) => {
        db.get(`SELECT users.*, roles.role_name as role_name FROM users LEFT JOIN roles ON users.role_id = roles.id WHERE email_verification_token = ? AND deleted_at IS NULL`, [token], (err, row) => err ? reject(err) : resolve(row || null));
      });
      if (!user) return sendResponse(res, failure('Invalid email verification token', 400));
      if (!user.email_verification_expires_at || new Date(user.email_verification_expires_at).getTime() < Date.now()) return sendResponse(res, failure('Email verification token expired', 400));
      await UsersModel.updateUser(user.id, { email_verified: 1, email_verified_at: new Date().toISOString(), email_verification_token: null, email_verification_expires_at: null });
      logger.info(`Email verified for user: ${user.email}`);
      return sendResponse(res, success({}, 'Email verified successfully', 200));
    } catch (err) {
      logger.error('Email verification error:', err);
      return sendResponse(res, failure('Failed to verify email', 500));
    }
  },

  async getCurrentUser(req, res) {
    try {
      // If not authenticated, try to parse token manually
      if (!req.user || !req.user.id) {
        const authHeader = req.get('authorization');
        const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        const token = bearerToken || req.cookies?.auth_token;
        if (!token) return res.status(200).json({ success: true, user: null });
        const payload = verifyToken(token);
        if (!payload) return res.status(200).json({ success: true, user: null });
        req.user = { id: payload.id, role_id: payload.role_id || null, role_name: payload.role_name, company_id: payload.company_id, email: payload.email };
      }

      const user = await UsersModel.getUserById(req.user.id);
      if (!user) return res.status(200).json({ success: true, user: null });
      delete user.password_hash;
      return sendResponse(res, success({ user }, 'User profile retrieved', 200));
    } catch (err) {
      logger.error('Get current user error:', err);
      return res.status(200).json({ success: true, user: null });
    }
  }
};

module.exports = authController;