/**
 * routes/super_admin/people/add-user/index.js
 * Super Admin "Add Admin" (add-user) routes — only call controllers, no logic.
 * Mounted by routes/super_admin/index.js at /people/add-user (under /api/super_admin).
 */
const express = require('express');
const router = express.Router();
const controller = require('../../../controllers/super_admin/people/add-user/addUserController');

// Create a new admin user  -> POST   /api/super_admin/people/add-user/add-admin
router.post('/add-admin', controller.createAdmin);

// Update an existing admin  -> PUT    /api/super_admin/people/add-user/add-admin/:id
router.put('/add-admin/:id', controller.updateAdmin);

module.exports = router;
