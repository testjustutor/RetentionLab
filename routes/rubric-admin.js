/**
 * routes/rubric-admin.js
 * Routes for admin rubric management
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/admin/adminRubricController');

// GET /api/admin/rubrics/master-categories - Get master categories
router.get('/master-categories', requireAuth, (req, res) => ctrl.getMasterCategories(req).then(r => res.status(r.statusCode || 200).json(r)));

// GET /api/admin/rubrics/master-indicators - Get master indicators
router.get('/master-indicators', requireAuth, (req, res) => ctrl.getMasterIndicators(req).then(r => res.status(r.statusCode || 200).json(r)));

// GET /api/admin/rubrics/categories - Get admin's categories
router.get('/categories', requireAuth, (req, res) => ctrl.getAdminCategories(req).then(r => res.status(r.statusCode || 200).json(r)));

// GET /api/admin/rubrics/indicators - Get admin's indicators
router.get('/indicators', requireAuth, (req, res) => ctrl.getAdminIndicators(req).then(r => res.status(r.statusCode || 200).json(r)));

// POST /api/admin/rubrics/copy-from-master - Copy from master
router.post('/copy-from-master', requireAuth, (req, res) => ctrl.copyFromMaster(req).then(r => res.status(r.statusCode || 200).json(r)));

// POST /api/admin/rubrics/categories - Create category
router.post('/categories', requireAuth, (req, res) => ctrl.createCategory(req).then(r => res.status(r.statusCode || 201).json(r)));

// POST /api/admin/rubrics/indicators - Create indicator
router.post('/indicators', requireAuth, (req, res) => ctrl.createIndicator(req).then(r => res.status(r.statusCode || 201).json(r)));

// DELETE /api/admin/rubrics/categories/:id - Delete category
router.delete('/categories/:id', requireAuth, (req, res) => ctrl.deleteCategory(req).then(r => res.status(r.statusCode || 200).json(r)));

// DELETE /api/admin/rubrics/indicators/:id - Delete indicator
router.delete('/indicators/:id', requireAuth, (req, res) => ctrl.deleteIndicator(req).then(r => res.status(r.statusCode || 200).json(r)));

module.exports = router;