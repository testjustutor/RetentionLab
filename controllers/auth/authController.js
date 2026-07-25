/**
 * controllers/authController.js
 * Business logic for authentication operations.
 * Handles registration, login, logout, password reset, and email verification.
 */

const crypto = require('crypto');
const AuthModel = require('../../models/auth/AuthModel');
const UsersModel = require('../../models/users/UsersModel');
const { signToken, JWT_EXPIRES_MS } = require('../../middleware/auth');
const { sendMail } = require('../../utils/mailer');
const { logger } = require('../../utils/logger');

// Standardized response helpers
function success(data, message, statusCode = 200) {
  return { success: true, message: message || null, statusCode, ...(data || {}) };
}

function failure(message, statusCode = 500) {
  return { success: false, error: message, statusCode };
}

// Validation helpers
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validatePassword(password) {
  if (!password || password.length < 10) {
    return 'Password must be at least 10 characters';
  }
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
  if (!process.env.SMTP_HOST) {
    logger.warn('SMTP not configured, skipping verification email');
    return;
  }
  
  const link = buildVerificationLink(req, user.email_verification_token);
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
    </head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background-color:#f8fafc;color:#334155;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" max-width="600px" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
              <!-- Header with branding -->
              <tr>
                <td style="background:linear-gradient(135deg,#1f65c2,#1b4f97);padding:32px 24px;text-align:center;">
                  <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:700;">RetentionLab</h1>
                  <p style="margin:8px 0 0;color:#e0f2fe;font-size:14px;">Meeting Intelligence Platform</p>
                </td>
              </tr>
              <!-- Website info top -->
              <tr>
                <td style="padding:20px 24px 0 24px;text-align:center;">
                  <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;">
                    <strong style="color:#1f65c2;">www.retentionlab.com</strong> &nbsp;|&nbsp;
                    <a href="mailto:support@retentionlab.com" style="color:#1f65c2;text-decoration:none;">support@retentionlab.com</a>
                  </p>
                </td>
              </tr>
              <!-- Main content -->
              <tr>
                <td style="padding:32px 24px;">
                  <h2 style="margin:0 0 16px 0;font-size:20px;color:#1f65c2;font-weight:600;">Verify Your Email Address</h2>
                  <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#475569;">
                    Hello ${user.first_name || 'there'},
                  </p>
                  <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#475569;">
                    Thank you for creating an account with RetentionLab. To complete your registration and access all features, please verify your email address by clicking the button below.
                  </p>
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px auto;">
                    <tr>
                      <td style="background:linear-gradient(135deg,#1f65c2,#1b4f97);border-radius:10px;padding:14px 32px;">
                        <a href="${link}" style="display:inline-block;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.3px;">Verify Email Address</a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0 0 16px 0;font-size:13px;color:#64748b;line-height:1.5;">
                    <strong>What happens after verification?</strong>
                  </p>
                  <ul style="margin:0 0 16px 0;padding-left:20px;font-size:13px;color:#64748b;line-height:1.6;">
                    <li>Full access to your dashboard and tools</li>
                    <li>AI-powered meeting insights and summaries</li>
                    <li>Calendar sync and session tracking</li>
                    <li>Team collaboration features</li>
                  </ul>
                  <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                    This link will expire in 24 hours. If you did not create an account, please ignore this email.
                  </p>
                </td>
              </tr>
              <!-- Divider -->
              <tr>
                <td style="padding:0 24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;">
                    <tr><td style="font-size:0;line-height:0;">&nbsp;</td></tr>
                  </table>
                </td>
              </tr>
              <!-- Footer with website details -->
              <tr>
                <td style="padding:24px;text-align:center;background-color:#f8fafc;">
                  <p style="margin:0 0 8px 0;font-size:12px;color:#64748b;line-height:1.5;">
                    <strong style="color:#1f65c2;">RetentionLab</strong> &middot; Meeting Intelligence Platform
                  </p>
                  <p style="margin:0 0 8px 0;font-size:11px;color:#94a3b8;line-height:1.5;">
                    <a href="https://www.retentionlab.com" style="color:#1f65c2;text-decoration:none;">www.retentionlab.com</a> &nbsp;|&nbsp;
                    <a href="mailto:support@retentionlab.com" style="color:#1f65c2;text-decoration:none;">support@retentionlab.com</a>
                  </p>
                  <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">
                    &copy; 2026 RetentionLab. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
  
  await sendMail({
    to: user.email,
    subject: 'Verify your RetentionLab account',
    html,
    purpose: 'email_verification'
  });
}

async function sendResetEmail(user, req) {
  if (!process.env.SMTP_HOST) {
    logger.warn('SMTP not configured, skipping reset email');
    return;
  }
  
  const link = buildResetLink(req, user.password_reset_token);
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background-color:#f8fafc;color:#334155;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" max-width="600px" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
              <!-- Header with branding -->
              <tr>
                <td style="background:linear-gradient(135deg,#1f65c2,#1b4f97);padding:32px 24px;text-align:center;">
                  <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:700;">RetentionLab</h1>
                  <p style="margin:8px 0 0;color:#e0f2fe;font-size:14px;">Meeting Intelligence Platform</p>
                </td>
              </tr>
              <!-- Website info top -->
              <tr>
                <td style="padding:20px 24px 0 24px;text-align:center;">
                  <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;">
                    <strong style="color:#1f65c2;">www.retentionlab.com</strong> &nbsp;|&nbsp;
                    <a href="mailto:support@retentionlab.com" style="color:#1f65c2;text-decoration:none;">support@retentionlab.com</a>
                  </p>
                </td>
              </tr>
              <!-- Main content -->
              <tr>
                <td style="padding:32px 24px;">
                  <h2 style="margin:0 0 16px 0;font-size:20px;color:#1f65c2;font-weight:600;">Reset Your Password</h2>
                  <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#475569;">
                    Hello ${user.first_name || 'there'},
                  </p>
                  <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#475569;">
                    We received a request to reset your password for your RetentionLab account. Click the button below to create a new password.
                  </p>
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px auto;">
                    <tr>
                      <td style="background:linear-gradient(135deg,#1f65c2,#1b4f97);border-radius:10px;padding:14px 32px;">
                        <a href="${link}" style="display:inline-block;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.3px;">Reset Password</a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0 0 16px 0;font-size:13px;color:#64748b;line-height:1.5;">
                    <strong>Security tips:</strong>
                  </p>
                  <ul style="margin:0 0 16px 0;padding-left:20px;font-size:13px;color:#64748b;line-height:1.6;">
                    <li>Use a strong, unique password</li>
                    <li>Include numbers and special characters</li>
                    <li>Do not share your password with anyone</li>
                  </ul>
                  <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                    This link will expire in 1 hour. If you did not request a password reset, please ignore this email or contact support if you have concerns.
                  </p>
                </td>
              </tr>
              <!-- Divider -->
              <tr>
                <td style="padding:0 24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;">
                    <tr><td style="font-size:0;line-height:0;">&nbsp;</td></tr>
                  </table>
                </td>
              </tr>
              <!-- Footer with website details -->
              <tr>
                <td style="padding:24px;text-align:center;background-color:#f8fafc;">
                  <p style="margin:0 0 8px 0;font-size:12px;color:#64748b;line-height:1.5;">
                    <strong style="color:#1f65c2;">RetentionLab</strong> &middot; Meeting Intelligence Platform
                  </p>
                  <p style="margin:0 0 8px 0;font-size:11px;color:#94a3b8;line-height:1.5;">
                    <a href="https://www.retentionlab.com" style="color:#1f65c2;text-decoration:none;">www.retentionlab.com</a> &nbsp;|&nbsp;
                    <a href="mailto:support@retentionlab.com" style="color:#1f65c2;text-decoration:none;">support@retentionlab.com</a>
                  </p>
                  <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">
                    &copy; 2026 RetentionLab. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
  
  await sendMail({
    to: user.email,
    subject: 'Reset your RetentionLab password',
    html,
    purpose: 'password_reset'
  });
}

const authController = {
  /**
   * POST /api/auth/register
   * Register a new user account
   */
  async register(req) {
    try {
      const { email, password, first_name, last_name, company_name } = req.body;

      // Validation
      if (!email) {
        return failure('Email is required', 400);
      }
      
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!validateEmail(normalizedEmail)) {
        return failure('Invalid email format', 400);
      }

      const passwordError = validatePassword(password);
      if (passwordError) {
        return failure(passwordError, 400);
      }

      // Register user
      const created = await AuthModel.register({
        email: normalizedEmail,
        password,
        first_name,
        last_name,
        company_name
      });

      // Generate verification token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Update user with verification data
      const verificationData = process.env.SMTP_HOST
        ? {
            email_verification_token: token,
            email_verification_expires_at: expiresAt,
            email_verified: 0,
            email_verified_at: null
          }
        : {
            email_verified: 1,
            email_verified_at: new Date().toISOString()
          };

      await UsersModel.updateUser(created.id, verificationData);
      const user = await UsersModel.getUserById(created.id);

      // Send verification email if SMTP is configured
      if (user && process.env.SMTP_HOST) {
        await sendVerificationEmail(user, req);
        return success(
          { status: 'pending_verification' },
          'Account created. Please verify your email to continue.',
          201
        );
      }

      return success(
        { status: 'verified' },
        'Account created. Email verification is disabled for local setup; you can sign in now.',
        201
      );

    } catch (err) {
      logger.error('Registration error:', err);
      
      // Handle specific errors
      if (err.message.includes('Email already registered')) {
        return failure('Email already registered', 409);
      }
      
      return failure(err.message || 'Registration failed', 400);
    }
  },

  /**
   * POST /api/auth/login
   * Authenticate user and create session
   */
  async login(req) {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        return failure('Email and password are required', 400);
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      // Authenticate
      const user = await AuthModel.authenticate(normalizedEmail, password);
      
      if (!user) {
        logger.warn(`Failed login attempt for email: ${normalizedEmail}`);
        return failure('Invalid credentials', 401);
      }

      // Generate JWT token
      const token = signToken(user);

      // Set HTTP-only cookie
      const isSecure = process.env.NODE_ENV === 'production';
      req.res.cookie('auth_token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecure,
        maxAge: JWT_EXPIRES_MS
      });

      logger.info(`User logged in: ${user.email} (ID: ${user.id})`);

      return success(
        { user, expiresIn: JWT_EXPIRES_MS },
        'Login successful',
        200
      );

    } catch (err) {
      logger.error('Login error:', err);
      
      // Handle specific auth errors
      if (err.message.includes('Email not verified')) {
        return failure(err.message, 403);
      }
      
      if (err.message.includes('not active')) {
        return failure(err.message, 403);
      }
      
      return failure('Authentication failed', 401);
    }
  },

  /**
   * POST /api/auth/logout
   * Clear user session
   */
  logout(req) {
    try {
      const userId = req.user?.id;
      
      // Clear cookie
      req.res.clearCookie('auth_token', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      });

      if (userId) {
        logger.info(`User logged out: ${userId}`);
      }

      return success({}, 'Logout successful', 200);

    } catch (err) {
      logger.error('Logout error:', err);
      return failure('Logout failed', 500);
    }
  },

  /**
   * POST /api/auth/forgot-password
   * Initiate password reset flow
   */
  async forgotPassword(req) {
    try {
      const { email } = req.body || {};

      if (!email) {
        return failure('Email is required', 400);
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const user = await UsersModel.getUserByEmail(normalizedEmail);

      // Always return success to prevent email enumeration
      if (!user) {
        logger.info(`Password reset requested for non-existent email: ${normalizedEmail}`);
        return success({}, 'If an account exists, a reset email will be sent', 200);
      }

      // Generate reset token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await UsersModel.updateUser(user.id, {
        password_reset_token: token,
        password_reset_expires_at: expiresAt
      });

      // Send reset email
      const userWithToken = { ...user, password_reset_token: token };
      await sendResetEmail(userWithToken, req);

      logger.info(`Password reset email sent to: ${normalizedEmail}`);

      return success({}, 'If an account exists, a reset email will be sent', 200);

    } catch (err) {
      logger.error('Forgot password error:', err);
      return failure('Failed to process password reset request', 500);
    }
  },

  /**
   * POST /api/auth/reset-password
   * Reset password using token
   */
  async resetPassword(req) {
    try {
      const { token, password } = req.body || {};

      // Validation
      if (!token || !password) {
        return failure('Token and password are required', 400);
      }

      const passwordError = validatePassword(password);
      if (passwordError) {
        return failure(passwordError, 400);
      }

      // Find user by token
      const user = await new Promise((resolve, reject) => {
        require('../../database/db').db.get(
          `SELECT users.*, roles.role_name as role_name 
           FROM users 
           LEFT JOIN roles ON users.role_id = roles.id 
           WHERE password_reset_token = ? AND deleted_at IS NULL`,
          [token],
          (err, row) => err ? reject(err) : resolve(row || null)
        );
      });

      if (!user) {
        return failure('Invalid password reset token', 400);
      }

      // Check token expiration
      if (!user.password_reset_expires_at || new Date(user.password_reset_expires_at).getTime() < Date.now()) {
        return failure('Password reset token expired', 400);
      }

      // Hash new password
      const password_hash = AuthModel.hashPassword(password);

      // Update user
      await UsersModel.updateUser(user.id, {
        password_hash,
        password_reset_token: null,
        password_reset_expires_at: null,
        email_verified: 1,
        email_verified_at: new Date().toISOString()
      });

      // Auto-login after password reset
      const updatedUser = await UsersModel.getUserById(user.id);
      const jwtToken = signToken(updatedUser);

      // Set cookie
      const isSecure = process.env.NODE_ENV === 'production';
      req.res.cookie('auth_token', jwtToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecure,
        maxAge: JWT_EXPIRES_MS
      });

      logger.info(`Password reset successful for user: ${user.email}`);

      return success(
        { user: updatedUser, expiresIn: JWT_EXPIRES_MS },
        'Password reset successful',
        200
      );

    } catch (err) {
      logger.error('Reset password error:', err);
      return failure('Failed to reset password', 500);
    }
  },

  /**
   * POST /api/auth/verify-email
   * Verify email address using token
   */
  async verifyEmail(req) {
    try {
      const { token } = req.body || {};

      if (!token) {
        return failure('Verification token is required', 400);
      }

      // Find user by token
      const user = await new Promise((resolve, reject) => {
        require('../../database/db').db.get(
          `SELECT users.*, roles.role_name as role_name 
           FROM users 
           LEFT JOIN roles ON users.role_id = roles.id 
           WHERE email_verification_token = ? AND deleted_at IS NULL`,
          [token],
          (err, row) => err ? reject(err) : resolve(row || null)
        );
      });

      if (!user) {
        return failure('Invalid email verification token', 400);
      }

      // Check token expiration
      if (!user.email_verification_expires_at || new Date(user.email_verification_expires_at).getTime() < Date.now()) {
        return failure('Email verification token expired', 400);
      }

      // Update user
      await UsersModel.updateUser(user.id, {
        email_verified: 1,
        email_verified_at: new Date().toISOString(),
        email_verification_token: null,
        email_verification_expires_at: null
      });

      logger.info(`Email verified for user: ${user.email}`);

      return success({}, 'Email verified successfully', 200);

    } catch (err) {
      logger.error('Email verification error:', err);
      return failure('Failed to verify email', 500);
    }
  },

  /**
   * GET /api/auth/me
   * Get current authenticated user profile
   */
  async getCurrentUser(req) {
    try {
      const user = await UsersModel.getUserById(req.user, req.user.id);
      
      if (!user) {
        return failure('User not found', 404);
      }

      // Remove sensitive data
      delete user.password_hash;

      return success({ user }, 'User profile retrieved', 200);

    } catch (err) {
      logger.error('Get current user error:', err);
      return failure('Failed to retrieve user profile', 500);
    }
  }
};

module.exports = authController;