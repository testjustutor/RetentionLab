/**
 * root/routes/db-admini.js
 */
const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const AdminModel = require('../models/admin/AdminModel');

router.get('/tables', async (req, res) => {
  try {
    const tables = await AdminModel.listTables();
    res.json({ status: 'success', data: { tables, total: tables.length } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/table/:tableName', async (req, res) => {
  const { tableName } = req.params;
  try {
    const columns = await AdminModel.getTableInfo(tableName);
    if (!columns.length) return res.status(404).json({ status: 'error', message: 'Table not found' });
    const rows = await AdminModel.getTableRows(tableName, 1000);
    res.json({ status: 'success', data: { name: tableName, columns: columns.map(c => ({ name: c.name, type: c.type })), rows, totalRows: rows.length } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/clear/:tableName', async (req, res) => {
  const { tableName } = req.params;
  try {
    const result = await AdminModel.clearTable(tableName);
    res.json({ status: 'success', message: `Deleted ${result.changes} rows` });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/query', async (req, res) => {
  try {
    const { sql } = req.body;
    const result = await AdminModel.runSafeQuery(sql);
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/export/:tableName', async (req, res) => {
  const { tableName } = req.params;
  try {
    const rows = await AdminModel.getTableRows(tableName, 0);
    let csv = '';
    if (rows.length) {
      const headers = Object.keys(rows[0]);
      csv += headers.join(',') + '\n';
      rows.forEach(row => {
        csv += headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(',') + '\n';
      });
    }
    res.header('Content-Type', 'text/csv');
    res.attachment(`${tableName}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.delete('/row/:table/:id', async (req, res) => {
  const { table, id } = req.params;
  try {
    const result = await AdminModel.deleteRow(table, id);
    res.json({ status: 'success', deleted: result.changes });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/row/:table', async (req, res) => {
  const { table } = req.params;
  const data = req.body;
  try {
    const result = await AdminModel.insertRow(table, data);
    res.json({ status: 'success', id: result.lastID || null });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
