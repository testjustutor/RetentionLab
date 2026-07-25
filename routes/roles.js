/**
 * root/routes/roles.js
 * Thin route layer — delegates all logic to roleController.
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const roleController = require('../controllers/roles/roleController');

function handle(fn) {
  return (req, res) => {
    fn(req).then(result => {
      const status = result.statusCode || (result.success === false ? 400 : 200);
      res.status(status).json(result);
    });
  };
}

// GET /api/roles
router.get('/', requireAuth, requireRole('super_admin', 'admin'), handle(roleController.list));

// GET /api/roles/:id/pages — must be before /:name
router.get('/:id/pages', requireAuth, requireRole('admin', 'super_admin'), handle(roleController.getPages));

// GET /api/roles/:name
router.get('/:name', requireAuth, requireRole('super_admin', 'admin'), handle(roleController.getByName));

// POST /api/roles
router.post('/', requireAuth, requireRole('super_admin'), handle(roleController.create));

module.exports = router;