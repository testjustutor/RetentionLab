/**
 * root/routes/auth.js
 * Authentication routes - thin HTTP layer
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth/authController');
const { requireAuth } = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', requireAuth, authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/verify-email', authController.verifyEmail);
router.get('/me', authController.getCurrentUser);

module.exports = router;