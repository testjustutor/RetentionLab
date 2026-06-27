/**
 * root/routes/users.js
 * Thin route layer — delegates all logic to userController.
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const userController = require('../controllers/userController');

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

// GET /api/users/:id
router.get('/:id', requireAuth, handle(userController.getById));

// POST /api/users
router.post('/', requireAuth, handle(userController.create));

// PUT /api/users/:id
router.put('/:id', requireAuth, handle(userController.update));

// DELETE /api/users/:id
router.delete('/:id', requireAuth, handle(userController.delete));

module.exports = router;