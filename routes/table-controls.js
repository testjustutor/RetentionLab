/**
 * routes/table-controls.js
 * Endpoints for per-table table-control visibility (search / entries / info / pagination).
 * Reading is allowed for any authenticated user so tables can apply restrictions.
 * Writing is restricted to super admins.
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const requireSuperAdmin = requireRole('super_admin');
const ctrl = require('../controllers/settings/tableControlsController');

function handle(fn) {
  return (req, res) => {
    fn(req).then(result => {
      const status = result.statusCode || (result.success === false ? 400 : 200);
      res.status(status).json(result);
    });
  };
}

// Read (any authenticated user)
router.get('/controls', requireAuth, handle(ctrl.list));
router.get('/controls/:tableId', requireAuth, handle(ctrl.get));

// Write (super admin only)
router.put('/controls/:tableId', requireAuth, requireSuperAdmin, handle(ctrl.update));
router.post('/controls/:tableId', requireAuth, requireSuperAdmin, handle(ctrl.update));

module.exports = router;