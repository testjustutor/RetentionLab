/**
 * root/routes/db-admini.js
 */
const express = require('express');
const router = express.Router();
const dbAdminController = require('../controllers/db-admin/dbAdminController');

router.get('/tables', dbAdminController.listTables);
router.get('/table/:tableName', dbAdminController.getTable);
router.post('/clear/:tableName', dbAdminController.clearTable);
router.post('/query', dbAdminController.runQuery);
router.get('/export/:tableName', dbAdminController.exportTable);
router.delete('/row/:table/:id', dbAdminController.deleteRow);
router.post('/row/:table', dbAdminController.insertRow);

module.exports = router;
