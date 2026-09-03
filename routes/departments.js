/**
 * routes/departments.js
 * Thin route layer for department CRUD.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/departments/departmentController');

function handle(fn) {
  return (req, res) => fn(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r));
}

router.get('/', requireAuth, handle(ctrl.list));
router.get('/:id', requireAuth, handle(ctrl.getById));
router.post('/', requireAuth, handle(ctrl.create));
router.put('/:id', requireAuth, handle(ctrl.update));
router.delete('/:id', requireAuth, handle(ctrl.delete));
router.get('/:id/members', requireAuth, handle(ctrl.listMembers));
router.post('/:id/members', requireAuth, handle(ctrl.addMember));
router.put('/:id/members/:userId', requireAuth, handle(ctrl.updateMember));
router.delete('/:id/members/:userId', requireAuth, handle(ctrl.removeMember));

module.exports = router;