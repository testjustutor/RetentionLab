/**
 * root/routes/users.js
 * Thin route layer — delegates all logic to userController.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const userController = require('../controllers/users/usersController');


function handle(fn) {
  return (req, res) => {
    fn(req).then(result => {
      const status = result.statusCode || (result.success === false ? 400 : 200);
      res.status(status).json(result);
    });
  };
}

// GET /api/users
router.get('/', requireAuth, handle(userController.list));

// POST /api/users (list with filters)
router.post('/', requireAuth, handle(userController.list));

// GET /api/admin/users/list - Admin list endpoint
router.get('/admin/list', requireAuth, handle(userController.list));

// POST /api/admin/users/list - Admin list with filters
router.post('/admin/list', requireAuth, handle(userController.list));

// POST /api/users/list - Admin panel list endpoint
router.post('/list', requireAuth, handle(userController.list));

// GET /api/users/:id
router.get('/:id', requireAuth, handle(userController.getById));

// POST /api/users (create)
router.post('/create', requireAuth, handle(userController.create));

// POST /api/admin/users/add - Admin add user endpoint
router.post('/add', requireAuth, handle(userController.create));

// POST /api/admin/people/users/addusers - Create user (Admin > People > Users page)
router.post('/addusers', requireAuth, handle(userController.create));

// PUT /api/users/:id
router.put('/:id', requireAuth, handle(userController.update));

// DELETE /api/users/:id
router.delete('/:id', requireAuth, handle(userController.delete));

module.exports = router;