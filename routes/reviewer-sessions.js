/**
 * DEPRECATED: was mounted at /api/reviewer-sessions; moved to routes/reviewer/sessions.js (now /api/reviewer/sessions).
 * This functionality was migrated to the dedicated per-role MVC folder structure
 * (see routes/registry.js). The old URL for this file is no longer mounted anywhere,
 * so this file is unreachable from any request. It is kept only as a thin re-export
 * shim (rather than deleted) pointing at its new location, so nothing breaks if
 * something still requires this old path directly.
 */
module.exports = require('./reviewer/sessions');
