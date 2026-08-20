/**
 * routes/super_admin/index.js
 * MAIN Super Admin route file — consolidates every Super Admin API route,
 * organized by URL structure, and only CALLS controllers.
 * No business logic, no model/db usage, no inline responses here — all work
 * (including deprecated-endpoint stubs) lives in controllers.
 * Mounted in routes/registry.js at /api/super_admin (handler 'super_admin').
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const requireSuperAdmin = requireRole('super_admin');

// Controllers — the only place logic/data access lives.
const archives = require('../../controllers/super_admin/archives/archivesController');
const sa = require('../../controllers/super_admin/superAdminController');

const companies = require('../../controllers/super_admin/companies/companiesController');
const dashboard = require('../../controllers/super_admin/dashboard/dashboardController');
const google = require('../../controllers/super_admin/google/googleCredentialsController');
const roles = require('../../controllers/super_admin/roles/roleController');
const users = require('../../controllers/super_admin/users/usersController');
const masterCtrl = require('../../controllers/super_admin/rubrics/masterRubricController');
const settings = require('../../controllers/super_admin/settings/settingsController');
const menu = require('../../controllers/super_admin/menu/menuController');
const tableControls = require('../../controllers/super_admin/settings/tableControlsController');
const sidebarMenu = require('../../controllers/super_admin/sidebar/sidebarMenuAdminController');

const addUser = require('./people/add-user');
const manageUsers = require('./people/manage-users');
const accessControl = require('./people/access-control');
const manageRubrics = require('./people/manage-rubrics');
const contentArchives = require('./content/archives');
const contentAssets = require('./content/assets');
const botConfig = require('./settings/bot-configuration');
const platformsConfig = require('./settings/platforms');
const aiproviders = require('./settings/ai-providers');
const userdefaults = require('./settings/user-defaults');
const videoprocessing = require('./settings/video-processing');
const tablecontrols = require('./settings/table-controls');
const monitoringserver = require('./monitoring/server');
const monitoringaudit = require('./monitoring/audit');
const menumanagement = require('./sidebar-menu-management');
const profile = require('./profile');
const meetingAiEvaluation = require('./reports/meeting-ai-evaluation');

// Thin adapter for controllers that resolve to a result object (no logic here).
function handle(fn) {
  return (req, res) => fn(req, res).then(r => {
    const status = r.statusCode || (r.success === false ? 400 : 200);
    res.status(status).json(r);
  });
}

// ── Scaffold / Super Admin core ─────────────────────────────────────────
router.get('/ping', requireAuth, handle(sa.ping));
router.get('/users-by-company', requireAuth, handle(sa.usersByCompany));

// ── Companies ───────────────────────────────────────────────────────────
router.get('/companies', requireAuth, requireSuperAdmin, companies.list);

// ── Dashboard ───────────────────────────────────────────────────────────
router.get('/dashboard/stats', requireAuth, requireSuperAdmin, dashboard.getSuperAdminStats);

// ── Roles & Access ──────────────────────────────────────────────────────
router.post('/roles', requireAuth, requireSuperAdmin, handle(roles.create));

// ── People (add-user page) ──────────────────────────────────────────────
router.get('/people/roles/:name', requireAuth, requireSuperAdmin, handle(roles.getByName));
router.get('/people/companies', requireAuth, requireSuperAdmin, companies.list);
router.get('/people/roles', requireAuth, requireSuperAdmin, handle(roles.list));
router.post('/people/users', requireAuth, requireSuperAdmin, handle(users.list));

// ── People (add-user page) - Add Admin (create/update) ─────────────────
// POST /add-admin -> create admin  |  PUT /add-admin/:id -> update admin
router.use('/people/add-user', requireAuth, requireSuperAdmin, addUser);

// ── People (manage-users page) - User Directory (list/update) ──────────
// GET /roles, GET /companies, POST /users (list), PUT /users/:id (update)
router.use('/people/manage-users', requireAuth, requireSuperAdmin, manageUsers);

// ── People (access-control page) - User Access (list/update) ───────────
// GET /roles, GET /companies, POST /users (list), PUT /users/:id (update)
router.use('/people/access-control', requireAuth, requireSuperAdmin, accessControl);

// ── People (manage-rubrics page) - Permission Rubrics (CRUD) ───────────
// GET/POST /categories(:id), GET/POST/PUT/DELETE /indicators(:id)
router.use('/people/manage-rubrics', requireAuth, requireSuperAdmin, manageRubrics);

// ── Google OAuth Credentials ────────────────────────────────────────────
router.get('/google-credentials', requireAuth, requireSuperAdmin, google.list);
router.post('/google-credentials', requireAuth, requireSuperAdmin, google.save);
router.put('/google-credentials/:id', requireAuth, requireSuperAdmin, google.update);
router.delete('/google-credentials/:id', requireAuth, requireSuperAdmin, google.delete);

// ── Menu Permissions ────────────────────────────────────────────────────
router.post('/menu-permissions', requireAuth, requireSuperAdmin, handle(menu.getMenuPermissions));
router.post('/menu-permissions/resolved', requireAuth, requireSuperAdmin, handle(menu.getResolvedUserMenu));
router.put('/menu-permissions', requireAuth, requireSuperAdmin, handle(menu.updateMenuPermissions));
router.post('/menu-permissions/reseed', requireAuth, requireSuperAdmin, handle(menu.reseedRoleMenuPermissions));

// ── System / User Settings ──────────────────────────────────────────────
router.get('/settings/system', requireAuth, requireSuperAdmin, handle(settings.getSystemSettings));
router.post('/settings/system/filter', requireAuth, requireSuperAdmin, handle(settings.getSystemSettingsByFilter));
router.get('/settings/system/categories', requireAuth, requireSuperAdmin, handle(settings.getCategories));
router.get('/settings/system/:key', requireAuth, requireSuperAdmin, handle(settings.getSystemSetting));
router.post('/settings/system', requireAuth, requireSuperAdmin, handle(settings.upsertSystemSetting));
router.post('/settings/system/bulk', requireAuth, requireSuperAdmin, handle(settings.bulkUpdateSystemSettings));
router.delete('/settings/system/:key', requireAuth, requireSuperAdmin, handle(settings.deleteSystemSetting));
router.post('/settings/user/bulk', requireAuth, requireSuperAdmin, handle(settings.bulkUpdateUserSettings));
router.get('/settings/export', requireAuth, requireSuperAdmin, handle(settings.exportSettings));
router.post('/settings/import', requireAuth, requireSuperAdmin, handle(settings.importSettings));

// ── Sidebar Menu Admin (deprecated writes go through the controller) ────
router.get('/sidebar-menu-admin/roles', requireAuth, requireSuperAdmin, sidebarMenu.getRoles);
router.get('/sidebar-menu-admin/items/:roleId', requireAuth, requireSuperAdmin, sidebarMenu.getItems);
router.post('/sidebar-menu-admin/items/:roleId', requireAuth, requireSuperAdmin, handle(sa.deprecatedMenu));
router.put('/sidebar-menu-admin/items/:id', requireAuth, requireSuperAdmin, handle(sa.deprecatedMenu));
router.delete('/sidebar-menu-admin/items/:id', requireAuth, requireSuperAdmin, handle(sa.deprecatedMenu));
router.post('/sidebar-menu-admin/reseed/:roleId', requireAuth, requireSuperAdmin, handle(sa.deprecatedMenu));

// ── Table Controls ──────────────────────────────────────────────────────
router.put('/table-controls/controls/:tableId', requireAuth, requireSuperAdmin, handle(tableControls.update));
router.post('/table-controls/controls/:tableId', requireAuth, requireSuperAdmin, handle(tableControls.update));

// ── Content (archives page) - Archives & Transcripts (list + instructors) ─────
// POST /meetings, GET /instructors
router.use('/content/archives', requireAuth, requireSuperAdmin, contentArchives);

// ── Content (assets page) - Media Assets (folder list + file) ────────────────
// GET /folder/:folderName, GET /folder/:folderName/file/:fileName
router.use('/content/assets', requireAuth, requireSuperAdmin, contentAssets);

// ── Settings (bot-configuration page) - Bot Config (get + save) ───────────────
// GET /settings, POST /settings/bulk
router.use('/settings/bot-configuration', requireAuth, requireSuperAdmin, botConfig);

// ── Settings (platforms page) - Platform settings (get + save) ────────────────
// GET /settings, POST /settings/bulk
router.use('/settings/platforms', requireAuth, requireSuperAdmin, platformsConfig);

// ── Settings (ai-providers page) - AI Providers (get + save) ──────────────────
// GET /settings, POST /settings/bulk
router.use('/settings/ai-providers', requireAuth, requireSuperAdmin, aiproviders);

// ── Settings (user-defaults page) - User Defaults (get + save) ────────────────
// POST /system/filter, POST /system/bulk
router.use('/settings/user-defaults', requireAuth, requireSuperAdmin, userdefaults);

// ── Settings (video-processing page) - Video to audio processing ─────────────
// GET /, POST /process, GET /history
router.use('/settings/video-processing', requireAuth, requireSuperAdmin, videoprocessing);

// ── Settings (table-controls page) - Table Controls (list + update) ───────────
// GET /, GET /:tableId, PUT/POST /:tableId
router.use('/settings/table-controls', requireAuth, requireSuperAdmin, tablecontrols);

// ── Monitoring (server page) - Server performance ─────────────────────────────
// GET /
router.use('/monitoring/server', requireAuth, requireSuperAdmin, monitoringserver);

// ── Monitoring (audit page) - Audit log viewer ────────────────────────────────
// GET /
router.use('/monitoring/audit', requireAuth, requireSuperAdmin, monitoringaudit);

// ── Sidebar / Menu Management ─────────────────────────────────────────────────
// POST /resolved, POST/GET /permissions, POST /reseed
router.use('/sidebar-menu-management', requireAuth, requireSuperAdmin, menumanagement);

// ── Profile ───────────────────────────────────────────────────────────────────
// GET /me, POST /change-password, PUT /:id
router.use('/people/profile', requireAuth, requireSuperAdmin, profile);

// ── Reports (Meeting AI Evaluation) ───────────────────────────────────────────
// GET /instructors, GET /summary, GET /session/:sessionId
router.use('/reports/meeting-ai-evaluation', requireAuth, requireSuperAdmin, meetingAiEvaluation);

module.exports = router;