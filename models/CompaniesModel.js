/**
 * root/models/CompaniesModel.js
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class CompaniesModel {
  static createCompany(data) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO companies (company_uuid, company_name, company_code, domain, logo_url, status, company_type, subscription_plan, subscription_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
      db.run(sql, [data.company_uuid, data.company_name, data.company_code, data.domain || null, data.logo_url || null, data.status || 'active', data.company_type || 'organization', data.subscription_plan || 'free', data.subscription_status || 'active'], function(err) {
        if (err) {
          logger.error('Model(CompaniesModel): Create error', err);
          return reject(err);
        }
        resolve({ id: this.lastID, ...data });
      });
    });
  }

  static getCompanyById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM companies WHERE id = ?', [id], (err, row) => err ? reject(err) : resolve(row || null));
    });
  }

  static getAllCompanies() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM companies WHERE deleted_at IS NULL ORDER BY company_name', [], (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }

  static updateCompany(id, changes) {
    const keys = Object.keys(changes);
    if (!keys.length) return Promise.resolve({ updated: false });
    const set = keys.map(k => `${k} = ?`).join(', ');
    const params = keys.map(k => changes[k]);
    params.push(id);
    return new Promise((resolve, reject) => {
      db.run(`UPDATE companies SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params, function(err) {
        if (err) return reject(err);
        resolve({ updated: this.changes > 0, changes: this.changes });
      });
    });
  }

  static deleteCompany(id) {
    return new Promise((resolve, reject) => {
      db.run('UPDATE companies SET deleted_at = CURRENT_TIMESTAMP, status = "deleted" WHERE id = ?', [id], function(err) {
        if (err) return reject(err);
        resolve({ deleted: this.changes > 0 });
      });
    });
  }

  static getCompanyByUuid(uuid) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM companies WHERE company_uuid = ? AND deleted_at IS NULL', [uuid], (err, row) => err ? reject(err) : resolve(row || null));
    });
  }

  static getCompanyByCode(code) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM companies WHERE company_code = ? AND deleted_at IS NULL', [code], (err, row) => err ? reject(err) : resolve(row || null));
    });
  }
}

module.exports = CompaniesModel;
