/**
 * routes/super_admin/people/manage-users/index.js
 * Super Admin "User Directory" (manage-users) routes — only call controllers, no logic.
 * Mounted by routes/super_admin/index.js at /people/manage-users (under /api/super_admin).
 */
const express = require('express');
const router = express.Router();
const controller = require('../../../controllers/super_admin/people/manage-users/manageUsersController');

// Lookup dropdowns
router.get('/roles', controller.listRoles);
router.get('/companies', controller.listCompanies);

// List users  -> POST /api/super_admin/people/manage-users/users
router.post('/users', controller.listUsers);

// Update user (edit / reset password / toggle status)
//   -> PUT /api/super_admin/people/manage-users/users/:id
router.put('/users/:id', controller.updateUser);

module.exports = router;
