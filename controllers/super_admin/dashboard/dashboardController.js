/**
 * controllers/super_admin/dashboard/dashboardController.js
 * FIX: was a byte-for-byte copy of controllers/dashboard/dashboardController.js
 * (only the require() path depth differed) - one of sixteen such
 * super_admin/ duplicate pairs identified in a codebase audit. See
 * models/super_admin/admin/AdminModel.js for the full rationale. Re-exporting
 * the top-level controller directly instead, so there is only one copy of
 * this logic to maintain.
 */
module.exports = require('../../dashboard/dashboardController');
