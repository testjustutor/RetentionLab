/**
 * root/routes/header-config.js
 */
const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const headerConfigController = require('../controllers/sidebar/headerConfigController');

router.use(requireAuth);

router.get('/roles', headerConfigController.getRoles);


// ══════════════════════════════════════════════════════════════════════════════
// COMBINED  —  full header config (nav + pages) for one role
// These are the primary endpoints consumed by the front end.
// ══════════════════════════════════════════════════════════════════════════════

router.get('/role/:roleId', headerConfigController.getFullConfigByRoleId);
router.get('/role/name/:roleName', headerConfigController.getFullConfigByRoleName);
router.get('/me', headerConfigController.getMyConfig);


// ══════════════════════════════════════════════════════════════════════════════
// NAV CONFIG  —  header_role_configs (one row per role)
// ══════════════════════════════════════════════════════════════════════════════

router.get('/nav', headerConfigController.getAllNav);
router.get('/nav/role/:roleId', headerConfigController.getNavByRoleId);
router.get('/nav/role/name/:roleName', headerConfigController.getNavByRoleName);
router.post('/nav', headerConfigController.createNav);
router.put('/nav/role/:roleId', headerConfigController.updateNav);
router.put('/nav/role/:roleId/upsert', headerConfigController.upsertNav);
router.delete('/nav/role/:roleId', headerConfigController.deleteNav);


// ══════════════════════════════════════════════════════════════════════════════
// ADMIN CRUD —  management endpoints for the header manager page
// ══════════════════════════════════════════════════════════════════════════════

router.get('/admin/all', headerConfigController.getAllForAdmin);
router.put('/pages/toggle-status', headerConfigController.togglePageStatus);

// ══════════════════════════════════════════════════════════════════════════════
// PAGE CONFIG  —  header_page_configs (one row per role × page)
// ══════════════════════════════════════════════════════════════════════════════

router.get('/pages/all', headerConfigController.getAllPagesGroupedByRole);
router.get('/pages/role/:roleId', headerConfigController.getPagesByRoleId);
router.get('/pages/role/name/:roleName', headerConfigController.getPagesByRoleName);
router.get('/pages/role/:roleId/:pageKey', headerConfigController.getPageByRoleAndKey);
router.post('/pages', headerConfigController.createPage);
router.put('/pages/role/:roleId/:pageKey', headerConfigController.updatePage);
router.put('/pages/role/:roleId/:pageKey/upsert', headerConfigController.upsertPage);
router.delete('/pages/role/:roleId/:pageKey', headerConfigController.deletePage);
router.delete('/pages/role/:roleId', headerConfigController.deleteAllPagesForRole);


// ══════════════════════════════════════════════════════════════════════════════
// SEED  —  admin-only endpoint to re-seed configs for all roles
// ══════════════════════════════════════════════════════════════════════════════

router.post('/seed', headerConfigController.seedForAllRoles);


module.exports = router;