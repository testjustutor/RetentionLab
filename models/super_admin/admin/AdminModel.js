/**
 * models/super_admin/admin/AdminModel.js
 * FIX: was a byte-for-byte copy of models/admin/AdminModel.js (only the
 * require() path depth differed) - one of sixteen such super_admin/
 * duplicate pairs identified in a codebase audit. Three of those pairs
 * (AuthModel.verifyPassword, MasterRubricModel.calculation_config,
 * UsersModel's admin-create-user role check) had already drifted into real
 * behavior bugs before being caught and reconciled by hand. Re-exporting
 * the top-level model directly instead, so there is only one copy of this
 * logic to maintain and no drift risk going forward.
 */
module.exports = require('../../admin/AdminModel');
