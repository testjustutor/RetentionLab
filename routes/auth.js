/**
 * root/routes/auth.js
 * Authentication routes - thin HTTP layer
 * All business logic is handled by authController
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth/authController');

const { requireAuth } = require('../middleware/auth');

/**
 * Helper to send a standardized response from controller result.
 * Spreads all controller return fields (user, expiresIn, etc.) into the response body,
 * while keeping success, message, and error as top-level fields.
 */
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

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register', async (req, res) => {
  try {
    const result = await authController.register(req);
    sendResponse(res, result);
  } catch (err) {
    console.error('Route error - register:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
router.post('/login', async (req, res) => {
  try {
    const result = await authController.login(req);
    sendResponse(res, result);
  } catch (err) {
    console.error('Route error - login:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout
 * Clear user session
 */
router.post('/logout', requireAuth, (req, res) => {
  try {
    const result = authController.logout(req);
    sendResponse(res, result);
  } catch (err) {
    console.error('Route error - logout:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Initiate password reset flow
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const result = await authController.forgotPassword(req);
    sendResponse(res, result);
  } catch (err) {
    console.error('Route error - forgot-password:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const result = await authController.resetPassword(req);
    sendResponse(res, result);
  } catch (err) {
    console.error('Route error - reset-password:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/verify-email
 * Verify email address using token
 */
router.post('/verify-email', async (req, res) => {
  try {
    const result = await authController.verifyEmail(req);
    sendResponse(res, result);
  } catch (err) {
    console.error('Route error - verify-email:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user profile.
 * Does NOT use requireAuth middleware — gracefully returns null user if not authenticated.
 * This prevents 401 console errors when the login page checks for an existing session.
 */
router.get('/me', async (req, res) => {
  try {
    // Check if user is authenticated via middleware (may have set req.user)
    // If not authenticated, return null user gracefully instead of 401
    if (!req.user || !req.user.id) {
      // The requireAuth middleware ran before this if it was in the stack,
      // but we don't use it. Try to parse the token manually.
      const authHeader = req.get('authorization');
      const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const token = bearerToken || req.cookies?.auth_token;
      
      if (!token) {
        return res.status(200).json({ success: true, user: null });
      }
      
      const { verifyToken } = require('../middleware/auth');
      const payload = verifyToken(token);
      
      if (!payload) {
        return res.status(200).json({ success: true, user: null });
      }
      
      req.user = {
        id: payload.id,
        role_id: payload.role_id || null,
        role_name: payload.role_name,
        company_id: payload.company_id,
        email: payload.email
      };
    }
    
    const result = await authController.getCurrentUser(req);
    
    // If user not found in DB, return null gracefully
    // Controller returns user at top level (not inside data)
    if (!result.success || !result.user) {
      return res.status(200).json({ success: true, user: null });
    }
    
    sendResponse(res, result);
  } catch (err) {
    console.error('Route error - me:', err);
    // Always return 200 with null user on error to avoid console errors
    res.status(200).json({ success: true, user: null });
  }
});

module.exports = router;
