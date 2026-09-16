/**
 * controllers/super_admin/settings/settingsController.js
 * FIX: was a near-duplicate of controllers/settings/settingsController.js -
 * differed only in require() path depth plus one real drift ('xai_api_key'
 * was missing from the top-level copy's SENSITIVE_PATTERNS redaction list,
 * a genuine secret-leakage gap, now fixed in the top-level file instead).
 * With that reconciled, re-exporting the top-level controller directly, so
 * there is only one copy of this logic to maintain.
 */
module.exports = require('../../settings/settingsController');
