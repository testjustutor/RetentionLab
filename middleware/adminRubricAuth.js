/**
 * root/middleware/adminRubricAuth.js
 * 
 * Middleware to enforce admin-specific rubric data isolation.
 * Ensures admins can only access/modify their own assigned rubric data.
 * Super admins have full access.
 */

const RubricAdminModel = require('../models/rubrics/RubricAdminModel');
const { logger } = require('../utils/logger');

/**
 * Middleware: Verify admin can only access their own rubric data
 * Used in routes like /admin-indicators/:admin_user_id
 */
function requireAdminRubricOwnership(req, res, next) {
  const requestedAdminId = parseInt(req.params.admin_user_id);
  const currentUserId = req.user?.id;
  const currentUserRole = req.user?.role_name;

  // Super admin can access any admin's data
  if (currentUserRole === 'super_admin') {
    return next();
  }

  // Regular admin can only access their own data
  if (currentUserRole === 'admin' && currentUserId === requestedAdminId) {
    return next();
  }

  logger.warn(
    `[AdminRubricAuth] Unauthorized access attempt: user ${currentUserId} (${currentUserRole}) tried to access admin ${requestedAdminId}'s rubric data`
  );

  return res.status(403).json({
    error: 'Forbidden: You can only access your own rubric data'
  });
}

/**
 * Middleware: Verify admin-specific category ownership
 * Extract admin_id from route and verify current user matches
 */
function requireAdminCategoryOwnership(req, res, next) {
  const requestedAdminId = parseInt(req.params.admin_user_id);
  const currentUserId = req.user?.id;
  const currentUserRole = req.user?.role_name;

  // Super admin can modify any admin's data
  if (currentUserRole === 'super_admin') {
    return next();
  }

  // Regular admin can only modify their own data
  if (currentUserRole === 'admin' && currentUserId === requestedAdminId) {
    return next();
  }

  logger.warn(
    `[AdminRubricAuth] Unauthorized category modification attempt: user ${currentUserId} (${currentUserRole}) tried to modify admin ${requestedAdminId}'s category`
  );

  return res.status(403).json({
    error: 'Forbidden: You can only modify your own rubric categories'
  });
}

/**
 * Middleware: Verify admin-specific indicator ownership
 * Extract admin_id from route and verify current user matches
 */
function requireAdminIndicatorOwnership(req, res, next) {
  const requestedAdminId = parseInt(req.params.admin_user_id);
  const currentUserId = req.user?.id;
  const currentUserRole = req.user?.role_name;

  // Super admin can modify any admin's data
  if (currentUserRole === 'super_admin') {
    return next();
  }

  // Regular admin can only modify their own data
  if (currentUserRole === 'admin' && currentUserId === requestedAdminId) {
    return next();
  }

  logger.warn(
    `[AdminRubricAuth] Unauthorized indicator modification attempt: user ${currentUserId} (${currentUserRole}) tried to modify admin ${requestedAdminId}'s indicator`
  );

  return res.status(403).json({
    error: 'Forbidden: You can only modify your own rubric indicators'
  });
}

/**
 * Middleware: Verify assignment modification (Super Admin only)
 */
function requireRubricAssignmentPrivilege(req, res, next) {
  const currentUserRole = req.user?.role_name;

  if (currentUserRole === 'super_admin') {
    return next();
  }

  logger.warn(
    `[AdminRubricAuth] Unauthorized assignment attempt: user ${req.user?.id} (${currentUserRole}) tried to assign/unassign rubric`
  );

  return res.status(403).json({
    error: 'Forbidden: Only Super Admins can assign/unassign rubrics'
  });
}

module.exports = {
  requireAdminRubricOwnership,
  requireAdminCategoryOwnership,
  requireAdminIndicatorOwnership,
  requireRubricAssignmentPrivilege
};
