/**
 * models/super_admin/header/HeaderConfigModel.js
 * FIX: was a byte-for-byte copy of models/header/HeaderConfigModel.js
 * (only require() path depth differed, including the internal db_ref and
 * seeder requires) - one of sixteen such super_admin/ duplicate pairs
 * identified in a codebase audit. See models/super_admin/admin/AdminModel.js
 * for the full rationale. Re-exporting the top-level module directly
 * instead (it exports { HeaderConfigModel, ... }), so there is only one
 * copy of this logic to maintain.
 */
module.exports = require('../../header/HeaderConfigModel');
