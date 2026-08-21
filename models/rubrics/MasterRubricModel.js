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

  static _categoryByIdentifier(idOrCode) {
    return new Promise((resolve, reject) => {
      const isNum = /^\d+$/.test(String(idOrCode));
      const col = isNum ? 'id' : 'category_code';
      db.get(`SELECT * FROM rubric_categories WHERE ${col} = ? LIMIT 1`, [String(idOrCode)], (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  }

  /**
   * Create a new master rubric category
   */
  static createCategory(category) {
    return new Promise((resolve, reject) => {
      const { category_code, name, weight = 0, status = 'active' } = category;
      if (!category_code || !name) {
        return reject(new Error('category_code and name are required'));
      }
      const sql = `
        INSERT INTO rubric_categories (category_code, name, weight, status)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          weight = VALUES(weight),
          status = VALUES(status)
      `;
      db.run(sql, [category_code, name, parseFloat(weight), status], function(err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * Get all master categories. Master rubric is global (no company scoping),
   * so company_id is ignored (kept for signature compatibility).
   */
  static getCategories(company_id = null, include_inactive = false) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM rubric_categories';
      const conditions = [];

      if (!include_inactive) {
        conditions.push("status = 'active'");
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' ORDER BY category_code ASC';
      db.all(sql, [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  /**
   * Get a single master category by id or category_code
   */
  static getCategoryById(idOrCode) {
    return this._categoryByIdentifier(idOrCode);
  }

  /**
   * Update a master category
   */
  static updateCategory(idOrCode, updates) {
    return new Promise((resolve, reject) => {
      this._categoryByIdentifier(idOrCode).then((row) => {
        if (!row) return resolve({ updated: false });
        const fields = [];
        const params = [];
        if (updates.category_code !== undefined) { fields.push('category_code = ?'); params.push(updates.category_code); }
        if (updates.name !== undefined) { fields.push('name = ?'); params.push(updates.name); }
        if (updates.weight !== undefined) { fields.push('weight = ?'); params.push(parseFloat(updates.weight)); }
        if (updates.status !== undefined) { fields.push('status = ?'); params.push(updates.status); }
        if (fields.length === 0) return resolve({ updated: false });
        params.push(row.id);

        db.run(`UPDATE rubric_categories SET ${fields.join(', ')} WHERE id = ?`, params, function(err) {
          if (err) return reject(err);
          resolve({ updated: this.changes > 0, changes: this.changes });
        });
      }).catch(reject);
    });
  }

  /**
   * Delete a master category and its indicators
   */
  static deleteCategory(idOrCode) {
    return new Promise((resolve, reject) => {
      this._categoryByIdentifier(idOrCode).then((row) => {
        if (!row) return resolve({ deleted: false });
        db.serialize(() => {
          db.run('DELETE FROM rubric_indicators WHERE category_id = ?', [row.id]);
          db.run('DELETE FROM rubric_categories WHERE id = ?', [row.id], function(err) {
            if (err) return reject(err);
            resolve({ deleted: this.changes > 0, changes: this.changes });
          });
        });
      }).catch(reject);
    });
  }

  // ====================================================================
  // MASTER INDICATORS
  // ====================================================================

  static _indicatorByIdentifier(idOrCode) {
    return new Promise((resolve, reject) => {
      const isNum = /^\d+$/.test(String(idOrCode));
      const col = isNum ? 'id' : 'indicator_code';
      db.get(`SELECT * FROM rubric_indicators WHERE ${col} = ? LIMIT 1`, [String(idOrCode)], (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  }

  /**
   * Create a new master rubric indicator
   */
  static createIndicator(indicator) {
    return new Promise((resolve, reject) => {
      const { indicator_code, category_id, name, type = 'HUMAN', is_gate = 0, value = 1, status = 'active', subgroup_name, benchmark, requires_video, company_id = 0 } = indicator;
      if (!indicator_code || !category_id || !name) {
        return reject(new Error('indicator_code, category_id, and name are required'));
      }
      this._categoryByIdentifier(category_id).then((catRow) => {
        if (!catRow) return reject(new Error(`Category not found: ${category_id}`));
        const sql = `
          INSERT INTO rubric_indicators
            (category_id, indicator_code, subgroup_name, name, type, is_gate, value, benchmark, requires_video, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            category_id = VALUES(category_id),
            subgroup_name = VALUES(subgroup_name),
            name = VALUES(name),
            type = VALUES(type),
            is_gate = VALUES(is_gate),
            value = VALUES(value),
            benchmark = VALUES(benchmark),
            requires_video = VALUES(requires_video),
            status = VALUES(status)
        `;
        db.run(sql,
          [catRow.id, indicator_code, subgroup_name || null, name, type, is_gate ? 1 : 0, parseFloat(value), benchmark || null, requires_video ? 1 : 0, status],
          function(err) {
            if (err) return reject(err);
            resolve({ id: this.lastID, changes: this.changes });
          });
      }).catch(reject);
    });
  }

  /**
   * Get all master indicators (grouped by category via rubric_categories.id)
   */
  static getIndicators(company_id = null, include_inactive = false) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT ri.*, rc.name AS category_name, rc.category_code
        FROM rubric_indicators ri
        JOIN rubric_categories rc ON ri.category_id = rc.id
      `;
      const conditions = [];

      if (!include_inactive) {
        conditions.push("ri.status = 'active'");
        conditions.push("rc.status = 'active'");
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' ORDER BY rc.category_code ASC, ri.indicator_code ASC';
      db.all(sql, [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  /**
   * Get master indicators by category (id or category_code)
   */
  static getIndicatorsByCategory(idOrCode, include_inactive = false) {
    return new Promise((resolve, reject) => {
      this._categoryByIdentifier(idOrCode).then((catRow) => {
        if (!catRow) return resolve([]);
        let sql = 'SELECT * FROM rubric_indicators WHERE category_id = ?';
        const params = [catRow.id];
        if (!include_inactive) {
          sql += " AND status = 'active'";
        }
        sql += ' ORDER BY indicator_code ASC';
        db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      }).catch(reject);
    });
  }

  /**
   * Update a master indicator
   */
  static updateIndicator(idOrCode, updates) {
    return new Promise((resolve, reject) => {
      if (updates.category_id !== undefined) {
        this._categoryByIdentifier(updates.category_id).then((catRow) => {
          if (!catRow) return reject(new Error(`Category not found: ${updates.category_id}`));
          this._applyIndicatorUpdate(idOrCode, { ...updates, category_id: catRow.id }, resolve, reject);
        }).catch(reject);
        return;
      }
      this._applyIndicatorUpdate(idOrCode, updates, resolve, reject);
    });
  }

  static _applyIndicatorUpdate(idOrCode, updates, resolve, reject) {
    this._indicatorByIdentifier(idOrCode).then((row) => {
      if (!row) return resolve({ updated: false });
      const fields = [];
      const params = [];
      if (updates.category_id !== undefined) { fields.push('category_id = ?'); params.push(updates.category_id); }
      if (updates.indicator_code !== undefined) { fields.push('indicator_code = ?'); params.push(updates.indicator_code); }
      if (updates.subgroup_name !== undefined) { fields.push('subgroup_name = ?'); params.push(updates.subgroup_name || null); }
      if (updates.name !== undefined) { fields.push('name = ?'); params.push(updates.name); }
      if (updates.type !== undefined) { fields.push('type = ?'); params.push(updates.type); }
      if (updates.is_gate !== undefined) { fields.push('is_gate = ?'); params.push(updates.is_gate ? 1 : 0); }
      if (updates.value !== undefined) { fields.push('value = ?'); params.push(parseFloat(updates.value)); }
      if (updates.benchmark !== undefined) { fields.push('benchmark = ?'); params.push(updates.benchmark || null); }
      if (updates.requires_video !== undefined) { fields.push('requires_video = ?'); params.push(updates.requires_video ? 1 : 0); }
      if (updates.status !== undefined) { fields.push('status = ?'); params.push(updates.status); }
      if (fields.length === 0) return resolve({ updated: false });
      params.push(row.id);

      db.run(`UPDATE rubric_indicators SET ${fields.join(', ')} WHERE id = ?`, params, function(err) {
        if (err) return reject(err);
        resolve({ updated: this.changes > 0, changes: this.changes });
      });
    }).catch(reject);
  }

  /**
   * Delete a master indicator
   */
  static deleteIndicator(idOrCode) {
    return new Promise((resolve, reject) => {
      this._indicatorByIdentifier(idOrCode).then((row) => {
        if (!row) return resolve({ deleted: false });
        db.run('DELETE FROM rubric_indicators WHERE id = ?', [row.id], function(err) {
          if (err) return reject(err);
          resolve({ deleted: this.changes > 0, changes: this.changes });
        });
      }).catch(reject);
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
      db.all('SELECT * FROM rubric_categories ORDER BY category_code ASC', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    const indicators = await new Promise((resolve, reject) => {
      db.all(
        `SELECT ri.*, rc.name AS category_name, rc.category_code
         FROM rubric_indicators ri
         JOIN rubric_categories rc ON ri.category_id = rc.id
         ORDER BY rc.category_code ASC, ri.indicator_code ASC`,
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