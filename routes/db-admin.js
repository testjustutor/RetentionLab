const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { logger } = require('../utils/logger');

const dbPath = path.resolve(__dirname, '..', 'retention_lab.db');
const db = new sqlite3.Database(dbPath);

function isValidIdentifier(name) {
  return /^[a-zA-Z0-9_]+$/.test(name);
}

router.get('/tables', (req, res) => {
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      return res.status(500).json({ status: 'error', message: err.message });
    }

    res.json({
      status: 'success',
      data: {
        tables: tables.map(t => ({ name: t.name })),
        total: tables.length
      }
    });
  });
});

router.get('/table/:tableName', (req, res) => {
  const { tableName } = req.params;

  if (!isValidIdentifier(tableName)) {
    return res.status(400).json({ status: 'error', message: 'Invalid table name' });
  }

  db.all(`PRAGMA table_info("${tableName}")`, (err, columns) => {
    if (err) {
      return res.status(500).json({ status: 'error', message: err.message });
    }

    if (!columns.length) {
      return res.status(404).json({ status: 'error', message: 'Table not found' });
    }

    db.all(`SELECT * FROM "${tableName}" LIMIT 1000`, (err2, rows) => {
      if (err2) {
        return res.status(500).json({ status: 'error', message: err2.message });
      }

      res.json({
        status: 'success',
        data: {
          name: tableName,
          columns: columns.map(c => ({ name: c.name, type: c.type })),
          rows,
          totalRows: rows.length
        }
      });
    });
  });
});

router.post('/clear/:tableName', (req, res) => {
  const { tableName } = req.params;

  if (!isValidIdentifier(tableName)) {
    return res.status(400).json({ status: 'error', message: 'Invalid table name' });
  }

  db.run(`DELETE FROM "${tableName}"`, function (err) {
    if (err) {
      return res.status(500).json({ status: 'error', message: err.message });
    }

    res.json({
      status: 'success',
      message: `Deleted ${this.changes} rows`
    });
  });
});

router.post('/query', (req, res) => {
  const { sql } = req.body;

  if (!sql) {
    return res.status(400).json({ status: 'error', message: 'SQL required' });
  }

  const upper = sql.trim().toUpperCase();

  if (upper.startsWith('DROP') || upper.startsWith('ALTER')) {
    return res.status(403).json({
      status: 'error',
      message: 'Dangerous query blocked'
    });
  }

  if (upper.startsWith('SELECT')) {
    db.all(sql, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ status: 'error', message: err.message });
      }

      res.json({
        status: 'success',
        rows
      });
    });
  } else {
    db.run(sql, [], function (err) {
      if (err) {
        return res.status(500).json({ status: 'error', message: err.message });
      }

      res.json({
        status: 'success',
        changes: this.changes
      });
    });
  }
});

router.get('/export/:tableName', (req, res) => {
  const { tableName } = req.params;

  if (!isValidIdentifier(tableName)) {
    return res.status(400).json({ status: 'error', message: 'Invalid table name' });
  }

  db.all(`SELECT * FROM "${tableName}"`, (err, rows) => {
    if (err) {
      return res.status(500).json({ status: 'error', message: err.message });
    }

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
  });
});

router.delete('/row/:table/:id', (req, res) => {
  const { table, id } = req.params;

  if (!isValidIdentifier(table)) {
    return res.status(400).json({ status: 'error', message: 'Invalid table name' });
  }

  db.run(`DELETE FROM "${table}" WHERE id = ?`, [id], function (err) {
    if (err) {
      return res.status(500).json({ status: 'error', message: err.message });
    }

    res.json({ status: 'success', deleted: this.changes });
  });
});

router.post('/row/:table', (req, res) => {
  const { table } = req.params;
  const data = req.body;

  if (!isValidIdentifier(table)) {
    return res.status(400).json({ status: 'error', message: 'Invalid table name' });
  }

  const cols = Object.keys(data);
  const placeholders = cols.map(() => '?').join(',');

  const sql = `INSERT INTO "${table}" (${cols.join(',')}) VALUES (${placeholders})`;

  db.run(sql, Object.values(data), function (err) {
    if (err) {
      return res.status(500).json({ status: 'error', message: err.message });
    }

    res.json({
      status: 'success',
      id: this.lastID
    });
  });
});

router.get('/stats', (req, res) => {
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) return res.status(500).json({ status: 'error', message: err.message });

    const promises = tables.map(t => {
      return new Promise(resolve => {
        db.get(`SELECT COUNT(*) as count FROM "${t.name}"`, (e, row) => {
          resolve({ name: t.name, count: row?.count || 0 });
        });
      });
    });

    Promise.all(promises).then(data => {
      res.json({
        status: 'success',
        data
      });
    });
  });
});

module.exports = router;