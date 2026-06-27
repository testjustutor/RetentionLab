const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const AuthModel = require('../models/AuthModel');
const UsersModel = require('../models/UsersModel');
const { requireAuth, signToken, JWT_EXPIRES_MS } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');

function sendAuthCookie(res, token) {
  const isSecure = process.env.NODE_ENV === 'production';
  res.cookie('auth_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    maxAge: JWT_EXPIRES_MS
  });
}

function buildEmailVerificationLink(req, token) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers.host;
  return `${protocol}://${host}/verify-email?token=${encodeURIComponent(token)}`;
}

function buildPasswordResetLink(req, token) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers.host;
  return `${protocol}://${host}/reset-password.html?token=${encodeURIComponent(token)}`;
}

async function sendVerificationEmail(user, req) {
  if (!process.env.SMTP_HOST) return;
  const link = buildEmailVerificationLink(req, user.email_verification_token);
  const html = `<p>Hello ${user.first_name || 'Instructor'},</p><p>Please verify your email by clicking the button below:</p><p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#7c3aed;color:#fff;border-radius:10px;text-decoration:none">Verify Email</a></p><p>If you did not request this, ignore this email.</p>`;
  return sendMail({ to: user.email, subject: 'Verify your email address', html });
}

async function sendResetEmail(user, req) {
  if (!process.env.SMTP_HOST) return;
  const link = buildPasswordResetLink(req, user.password_reset_token);
  const html = `<p>Hello ${user.first_name || 'Instructor'},</p><p>Reset your password by clicking the button below:</p><p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#7c3aed;color:#fff;border-radius:10px;text-decoration:none">Reset Password</a></p><p>If you did not request this, ignore this email.</p>`;
  return sendMail({ to: user.email, subject: 'Password reset request', html });
}

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const user = await UsersModel.getUserByEmail(email.toLowerCase());
    if (!user) {
      return res.json({ status: 'success' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await UsersModel.updateUser(user.id, {
      password_reset_token: token,
      password_reset_expires_at: expiresAt
    });
    await sendResetEmail({ ...user, password_reset_token: token }, req);
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
  if (password.length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters' });
  try {
    const user = await new Promise((resolve, reject) => {
      require('../database/db').db.get(
        `SELECT users.*, roles.role_name as role_name FROM users LEFT JOIN roles ON users.role_id = roles.id WHERE password_reset_token = ? AND deleted_at IS NULL`,
        [token],
        (err, row) => err ? reject(err) : resolve(row || null)
      );
    });
    if (!user) return res.status(400).json({ error: 'Invalid password reset token' });
    if (!user.password_reset_expires_at || new Date(user.password_reset_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Password reset token expired' });
    }
    const password_hash = require('../models/AuthModel').hashPassword(password);
    await UsersModel.updateUser(user.id, {
      password_hash,
      password_reset_token: null,
      password_reset_expires_at: null,
      email_verified: 1,
      email_verified_at: new Date().toISOString()
    });
    const updatedUser = await UsersModel.getUserById(user.id);
    const tokenJwt = signToken(updatedUser);
    sendAuthCookie(res, tokenJwt);
    res.json({ user: updatedUser, expiresIn: JWT_EXPIRES_MS });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/verify-email', async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Verification token is required' });
  try {
    const user = await new Promise((resolve, reject) => {
      require('../database/db').db.get(
        `SELECT users.*, roles.role_name as role_name FROM users LEFT JOIN roles ON users.role_id = roles.id WHERE email_verification_token = ? AND deleted_at IS NULL`,
        [token],
        (err, row) => err ? reject(err) : resolve(row || null)
      );
    });
    if (!user) return res.status(400).json({ error: 'Invalid email verification token' });
    if (!user.email_verification_expires_at || new Date(user.email_verification_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Email verification token expired' });
    }
    await UsersModel.updateUser(user.id, {
      email_verified: 1,
      email_verified_at: new Date().toISOString(),
      email_verification_token: null,
      email_verification_expires_at: null
    });
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
