/**
 * root/models/rubrics/MasterRubricModel.js
 * 
 * Manages ONLY master rubric categories & indicators (Super Admin CRUD).
 * These are the global rubric definitions stored in:
 *   - rubric_categories
 *   - rubric_indicators
 * 
 * This model does NOT handle admin-specific copies or assignments.
 * For admin-specific operations, see RubricAdminModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class MasterRubricModel {
  // ====================================================================
  // MASTER CATEGORIES
  // ====================================================================

  /**
   * Create a new master rubric category
   */
  static createCategory(category) {
    return new Promise((resolve, reject) => {
      const { category_id, name, weight = 0, status = 'active', company_id = 0 } = category;
      if (!category_id || !name) {
        return reject(new Error('category_id and name are required'));
      }
      const sql = `
        INSERT INTO rubric_categories (category_id, name, weight, status, company_id)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          weight = VALUES(weight),
          status = VALUES(status),
          company_id = VALUES(company_id)
      `;
      db.run(sql, [category_id, name, parseFloat(weight), status, company_id], function(err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * Get all master categories
   */
  static getCategories(company_id = null, include_inactive = false) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM rubric_categories';
      const params = [];
      const conditions = [];
      
      if (company_id !== null) {
        conditions.push('(company_id = ? OR company_id = 0)');
        params.push(company_id);
      }
      
      if (!include_inactive) {
        conditions.push("status = 'active'");
      }
      
      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      
      sql += ' ORDER BY name ASC';
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  /**
   * Get a single master category by ID
   */
  static getCategoryById(category_id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM rubric_categories WHERE category_id = ?', [category_id], (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  }

  /**
   * Update a master category
   */
  static updateCategory(category_id, updates) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const params = [];
      if (updates.name !== undefined) { fields.push('name = ?'); params.push(updates.name); }
      if (updates.weight !== undefined) { fields.push('weight = ?'); params.push(parseFloat(updates.weight)); }
      if (updates.status !== undefined) { fields.push('status = ?'); params.push(updates.status); }
      if (fields.length === 0) return resolve({ updated: false });
      params.push(category_id);
      
      db.run(`UPDATE rubric_categories SET ${fields.join(', ')} WHERE category_id = ?`, params, function(err) {
        if (err) return reject(err);
        resolve({ updated: this.changes > 0 });
      });
    });
  }

  /**
   * Delete a master category and its indicators
   */
  static deleteCategory(category_id) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('DELETE FROM rubric_indicators WHERE category_id = ?', [category_id]);
        db.run('DELETE FROM rubric_categories WHERE category_id = ?', [category_id], function(err) {
          if (err) return reject(err);
          resolve({ deleted: this.changes > 0 });
        });
      });
    });
  }

  // ====================================================================
  // MASTER INDICATORS
  // ====================================================================

  /**
   * Create a new master rubric indicator
   */
  static createIndicator(indicator) {
    return new Promise((resolve, reject) => {
      const { indicator_id, category_id, name, type = 'HUMAN', is_gate = 0, value = 1, status = 'active', company_id = 0 } = indicator;
      if (!indicator_id || !category_id || !name) {
        return reject(new Error('indicator_id, category_id, and name are required'));
      }
      const sql = `
        INSERT INTO rubric_indicators (indicator_id, category_id, name, type, is_gate, value, status, company_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          type = VALUES(type),
          is_gate = VALUES(is_gate),
          value = VALUES(value),
          status = VALUES(status),
          company_id = VALUES(company_id)
      `;
      db.run(sql, [indicator_id, category_id, name, type, is_gate, parseFloat(value), status, company_id], function(err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * Get all master indicators
   */
  static getIndicators(company_id = null, include_inactive = false) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT ri.*, rc.name AS category_name
        FROM rubric_indicators ri
        JOIN rubric_categories rc ON ri.category_id = rc.category_id
      `;
      const params = [];
      const conditions = [];
      
      if (company_id !== null) {
        conditions.push('(ri.company_id = ? OR ri.company_id = 0)');
        params.push(company_id);
      }
      
      if (!include_inactive) {
        conditions.push("ri.status = 'active'");
        conditions.push("rc.status = 'active'");
      }
      
      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      
      sql += ' ORDER BY rc.name ASC, ri.name ASC';
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  /**
   * Get master indicators by category
   */
  static getIndicatorsByCategory(category_id, include_inactive = false) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM rubric_indicators WHERE category_id = ?';
      const params = [category_id];
      
      if (!include_inactive) {
        sql += " AND status = 'active'";
      }
      
      sql += ' ORDER BY name ASC';
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  /**
   * Update a master indicator
   */
  static updateIndicator(indicator_id, updates) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const params = [];
      if (updates.name !== undefined) { fields.push('name = ?'); params.push(updates.name); }
      if (updates.type !== undefined) { fields.push('type = ?'); params.push(updates.type); }
      if (updates.is_gate !== undefined) { fields.push('is_gate = ?'); params.push(updates.is_gate ? 1 : 0); }
      if (updates.category_id !== undefined) { fields.push('category_id = ?'); params.push(updates.category_id); }
      if (updates.value !== undefined) { fields.push('value = ?'); params.push(parseFloat(updates.value)); }
      if (updates.status !== undefined) { fields.push('status = ?'); params.push(updates.status); }
      if (fields.length === 0) return resolve({ updated: false });
      params.push(indicator_id);
      
      db.run(`UPDATE rubric_indicators SET ${fields.join(', ')} WHERE indicator_id = ?`, params, function(err) {
        if (err) return reject(err);
        resolve({ updated: this.changes > 0 });
      });
    });
  }

  /**
   * Delete a master indicator
   */
  static deleteIndicator(indicator_id) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM rubric_indicators WHERE indicator_id = ?', [indicator_id], function(err) {
        if (err) return reject(err);
        resolve({ deleted: this.changes > 0 });
      });
    });
  }

  // ====================================================================
  // FULL MASTER RUBRIC
  // ====================================================================

  /**
   * Get full master rubric structure (categories + indicators)
   */
  static async getFullMasterRubric() {
    const categories = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM rubric_categories ORDER BY name ASC', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    const indicators = await new Promise((resolve, reject) => {
      db.all(
        `SELECT ri.*, rc.name AS category_name
         FROM rubric_indicators ri
         JOIN rubric_categories rc ON ri.category_id = rc.category_id
         ORDER BY rc.name ASC, ri.name ASC`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
    return { categories, indicators };
  }
}

module.exports = MasterRubricModel;