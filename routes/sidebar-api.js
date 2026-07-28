/**
 * root/routes/sidebar-api.js
 * API route for dynamic sidebar navigation
 * GET /api/sidebar/menu - Returns menu structure based on user role + user overrides
 *
 * This module exports both:
 *  - An Express Router for use with router.use('/api/sidebar', ...)
 *  - A getMenu action for use with the centralized route registry (routes/registry.js)
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const sidebarApiController = require('../controllers/sidebar/sidebarApiController');

// GET /menu - Get sidebar menu for current user (used when mounted at /api/sidebar)
router.get('/menu', requireAuth, (req, res) => sidebarApiController.getMenu(req, res));

// Export router for direct mounting
module.exports = router;

// Also export the getMenu action for the route registry (routes/registry.js)
// which does: GET /api/sidebar/menu => require('./sidebar-api').getMenu
module.exports.getMenu = sidebarApiController.getMenu;
