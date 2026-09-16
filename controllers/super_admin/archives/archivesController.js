/**
 * controllers/super_admin/archives/archivesController.js
 * FIX: was a byte-for-byte copy of controllers/archives/archivesController.js
 * (only the require() path depth differed) - one of sixteen such
 * super_admin/ duplicate pairs identified in a codebase audit. See
 * models/super_admin/admin/AdminModel.js for the full rationale. Re-exporting
 * the top-level controller directly instead (which itself now resolves to
 * the shared top-level model), so there is only one copy of this logic to
 * maintain.
 */
module.exports = require('../../archives/archivesController');
