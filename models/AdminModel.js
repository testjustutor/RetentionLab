/**
 * root/models/AdminModel.js
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

function isValidIdentifier(name) {
  return /^[a-zA-Z0-9_]+$/.test(name);
}

class AdminModel {
  static listTables() {
    return new Promise((resolve, reject) => {
      db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) return reject(err);
        resolve(tables
          .map(t => ({ name: t.name }))
          .filter(t => !t.name.startsWith('sqlite_'))
        );
      });
    });
  }

  static getTableInfo(tableName) {
    return new Promise((resolve, reject) => {
      if (!isValidIdentifier(tableName)) return reject(new Error('Invalid table name'));
      db.all(`PRAGMA table_info("${tableName}")`, (err, columns) => {
        if (err) return reject(err);
        resolve(columns || []);
      });
    });
  }

  static getTableRows(tableName, limit = 1000) {
    return new Promise((resolve, reject) => {
      if (!isValidIdentifier(tableName)) return reject(new Error('Invalid table name'));
      if (limit && Number(limit) > 0) {
        db.all(`SELECT * FROM "${tableName}" LIMIT ?`, [limit], (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      } else {
        db.all(`SELECT * FROM "${tableName}"`, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      }
    });
  }

  static clearTable(tableName) {
    return new Promise((resolve, reject) => {
      if (!isValidIdentifier(tableName)) return reject(new Error('Invalid table name'));
      db.run(`DELETE FROM "${tableName}"`, function(err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });
  }

  static countTable(tableName) {
    return new Promise((resolve, reject) => {
      if (!isValidIdentifier(tableName)) return reject(new Error('Invalid table name'));
      db.get(`SELECT COUNT(*) as count FROM "${tableName}"`, [], (err, row) => {
        if (err) return reject(err);
        resolve(row?.count ?? 0);
      });
    });
  }

  static deleteRow(tableName, id) {
    return new Promise((resolve, reject) => {
      if (!isValidIdentifier(tableName)) return reject(new Error('Invalid table name'));
      db.run(`DELETE FROM "${tableName}" WHERE id = ?`, [Number(id)], function(err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });
  }

  static insertRow(tableName, data) {
    return new Promise((resolve, reject) => {
      if (!isValidIdentifier(tableName)) return reject(new Error('Invalid table name'));
      const cols = Object.keys(data || {});
      if (!cols.length) return reject(new Error('No data provided'));
      const placeholders = cols.map(() => '?').join(',');
      const params = cols.map(key => data[key]);
      const sql = `INSERT INTO "${tableName}" (${cols.join(',')}) VALUES (${placeholders})`;
      db.run(sql, params, function(err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  static getAllTableCounts() {
    return AdminModel.listTables().then(tables => {
      const promises = tables.map(t => AdminModel.countTable(t.name).then(count => ({ name: t.name, count })));
      return Promise.all(promises);
    });
  }

  static getDashboardCounts() {
    return AdminModel.listTables().then(tables => {
      const promises = tables.map(t => AdminModel.countTable(t.name).then(count => ({ table: t.name, count })));
      return Promise.all(promises);
    });
  }

  static runSafeQuery(sql) {
    return new Promise((resolve, reject) => {
      if (!sql) return reject(new Error('SQL required'));
      const upper = sql.trim().toUpperCase();
      if (upper.startsWith('DROP') || upper.startsWith('ALTER')) return reject(new Error('Dangerous query blocked'));
      if (upper.startsWith('SELECT')) {
        db.all(sql, [], (err, rows) => err ? reject(err) : resolve({ rows }));
      } else {
        db.run(sql, [], function(err) {
          if (err) return reject(err);
          resolve({ changes: this.changes, lastID: this.lastID });
        });
      }
    });
  }

  static exportTable(tableName) {
    return AdminModel.getTableRows(tableName, 0).then(rows => rows);
  }
}

module.exports = AdminModel;
