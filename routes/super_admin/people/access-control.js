/**
 * routes/super_admin/people/access-control/index.js
 * Super Admin "Access Control" routes — only call controllers, no logic.
 * Mounted by routes/super_admin/index.js at /people/access-control (under /api/super_admin).
 */
const express = require('express');
const router = express.Router();
const controller = require('../../../controllers/super_admin/people/access-control/accessControlController');

// Lookup dropdowns
router.get('/roles', controller.listRoles);
router.get('/companies', controller.listCompanies);

// List users  -> POST /api/super_admin/people/access-control/users
router.post('/users', controller.listUsers);

// Update user (edit access / reset password / toggle status)
//   -> PUT /api/super_admin/people/access-control/users/:id
router.put('/users/:id', controller.updateUser);

module.exports = router;
