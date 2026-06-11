/**
 * root/routes/users.js
 */
const express = require('express');
const router = express.Router();
const UsersModel = require('../models/UsersModel');
const { requireAuth } = require('../middleware/auth');

function handleModelError(res, err) {
  if (err.message === 'Forbidden') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return res.status(500).json({ error: err.message });
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await UsersModel.listUsers(req.user, { limit: 200 });
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    handleModelError(res, err);
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const row = await UsersModel.getUserById(req.user, req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    handleModelError(res, err);
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const created = await UsersModel.createUser(req.user, req.body);
    res.status(201).json(created);
  } catch (err) {
    handleModelError(res, err);
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const result = await UsersModel.updateUser(req.user, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    handleModelError(res, err);
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await UsersModel.softDeleteUser(req.user, req.params.id);
    res.json(result);
  } catch (err) {
    handleModelError(res, err);
  }
});

module.exports = router;
