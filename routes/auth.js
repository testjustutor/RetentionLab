/**
 * root/routes/auth.js
 */
const express = require('express');
const router = express.Router();
const AuthModel = require('../models/AuthModel');
const UsersModel = require('../models/UsersModel');
const { requireAuth, signToken, JWT_EXPIRES_MS } = require('../middleware/auth');

function sendAuthCookie(res, token) {
  const isSecure = process.env.NODE_ENV === 'production';
  res.cookie('auth_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    maxAge: JWT_EXPIRES_MS
  });
}

router.post('/register', async (req, res) => {
  try {
    const created = await AuthModel.register(req.body);
    const token = signToken(created);
    sendAuthCookie(res, token);
    res.status(201).json({ user: created, expiresIn: JWT_EXPIRES_MS });
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
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', requireAuth, (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
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
