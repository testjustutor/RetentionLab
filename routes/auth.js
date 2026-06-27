/**
 * root/routes/auth.js
 */
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
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
  if (!process.env.SMTP_HOST) return;
  const link = buildVerificationLink(req, user.email_verification_token);
  const html = `<p>Hello ${user.first_name || 'Instructor'},</p><p>Verify your email address by clicking here:</p><p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#7c3aed;color:#fff;border-radius:10px;text-decoration:none">Verify Email</a></p><p>If you did not create this account, ignore this message.</p>`;
  await sendMail({ to: user.email, subject: 'Verify your RetentionLab account', html });
}

async function sendResetEmail(user, req) {
  if (!process.env.SMTP_HOST) return;
  const link = buildResetLink(req, user.password_reset_token);
  const html = `<p>Hello ${user.first_name || 'Instructor'},</p><p>Reset your password using the secure link below:</p><p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#7c3aed;color:#fff;border-radius:10px;text-decoration:none">Reset Password</a></p><p>If you did not request this, ignore this email.</p>`;
  await sendMail({ to: user.email, subject: 'Reset your RetentionLab password', html });
}

router.post('/register', async (req, res) => {
  try {
    const created = await AuthModel.register(req.body);
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await UsersModel.updateUser(created.id, {
      email_verification_token: process.env.SMTP_HOST ? token : null,
      email_verification_expires_at: process.env.SMTP_HOST ? expiresAt : null,
      email_verified: process.env.SMTP_HOST ? 0 : 1,
      email_verified_at: process.env.SMTP_HOST ? null : new Date().toISOString()
    });
    const user = await UsersModel.getUserById(created.id);
    if (user && process.env.SMTP_HOST) {
      await sendVerificationEmail(user, req);
      return res.status(201).json({ status: 'pending_verification', message: 'Account created. Please verify your email to continue.' });
    }
    return res.status(201).json({ status: 'verified', message: 'Account created. Email verification is disabled for local setup; you can sign in now.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await AuthModel.authenticate(email, password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken(user);
    sendAuthCookie(res, token);
    res.json({ user, expiresIn: JWT_EXPIRES_MS });
  } catch (err) {
    if (err.message.includes('Email not verified') || err.message.includes('not active')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', requireAuth, (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const user = await UsersModel.getUserByEmail(String(email).trim().toLowerCase());
    if (!user) return res.json({ status: 'success' });
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
    const password_hash = AuthModel.hashPassword(password);
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

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await UsersModel.getUserById(req.user, req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    delete user.password_hash;
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
