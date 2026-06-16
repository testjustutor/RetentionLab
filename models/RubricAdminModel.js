/**
 * root/models/RubricAdminModel.js
 * 
 * Manages:
 * 1. Master rubric categories & indicators (Super Admin CRUD)
 * 2. Admin-specific copies in admin_rubric_categories / admin_rubric_indicators
 * 3. Assignment flow: when Super Admin assigns → copies created for that admin
 * 4. Admins can update only their own weight/value without affecting masters
 * 5. All reports/calculations use admin-specific data based on admin_id
 * 6. Audit logging for all operations
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class RubricAdminModel {
  /**
   * Initialize scoped tables (called on startup)
   */
  static async initTables() {
    try {
      // Ensure admin_rubric_categories table exists
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS admin_rubric_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_category_id TEXT NOT NULL,
            admin_user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            weight REAL NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(original_category_id, admin_user_id)
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Ensure admin_rubric_indicators table exists
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS admin_rubric_indicators (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_indicator_id TEXT NOT NULL,
            original_category_id TEXT NOT NULL,
            admin_user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            type TEXT CHECK(type IN ('AI', 'HUMAN')) DEFAULT 'HUMAN',
            is_gate BOOLEAN DEFAULT 0,
            value REAL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(original_indicator_id, admin_user_id)
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Ensure rubric_assignments table exists
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS rubric_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id TEXT NOT NULL,
            admin_user_id INTEGER NOT NULL,
            created_by INTEGER,
            assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES rubric_categories(category_id),
            FOREIGN KEY (admin_user_id) REFERENCES users(id),
            FOREIGN KEY (created_by) REFERENCES users(id),
            UNIQUE(category_id, admin_user_id)
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Ensure rubric_audit_log table exists
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS rubric_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT,
            admin_user_id INTEGER,
            performed_by INTEGER NOT NULL,
            old_values TEXT,
            new_values TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (performed_by) REFERENCES users(id)
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Add 'value' column if missing (migration for existing tables)
      const indTableInfo = await new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(rubric_indicators)", (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      if (!indTableInfo.some(col => col.name === 'value')) {
        await new Promise((resolve, reject) => {
          db.run("ALTER TABLE rubric_indicators ADD COLUMN value REAL DEFAULT 1", (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      const catTableInfo = await new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(rubric_categories)", (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      if (!catTableInfo.some(col => col.name === 'company_id')) {
        await new Promise((resolve, reject) => {
          db.run("ALTER TABLE rubric_categories ADD COLUMN company_id INTEGER DEFAULT 0", (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      if (!indTableInfo.some(col => col.name === 'company_id')) {
        await new Promise((resolve, reject) => {
          db.run("ALTER TABLE rubric_indicators ADD COLUMN company_id INTEGER DEFAULT 0", (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // Add value column to admin_rubric_indicators if exists but missing column
      try {
        const adminIndInfo = await new Promise((resolve, reject) => {
          db.all("PRAGMA table_info(admin_rubric_indicators)", (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
        if (!adminIndInfo.some(col => col.name === 'value')) {
          await new Promise((resolve, reject) => {
            db.run("ALTER TABLE admin_rubric_indicators ADD COLUMN value REAL DEFAULT 1", (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }
      } catch (e) {
        // table might not exist yet
      }

      logger.info('[RubricAdminModel] Tables initialized successfully');
    } catch (err) {
      logger.error('[RubricAdminModel] Init error:', err.message);
    }
  }

  // ====================================================================
  // AUDIT LOGGING
  // ====================================================================

  static async addAuditLog({ action, entity_type, entity_id, admin_user_id = null, performed_by, old_values = null, new_values = null }) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO rubric_audit_log (action, entity_type, entity_id, admin_user_id, performed_by, old_values, new_values)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [action, entity_type, entity_id, admin_user_id, performed_by, old_values ? JSON.stringify(old_values) : null, new_values ? JSON.stringify(new_values) : null],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  }

  // ====================================================================
  // MASTER CATEGORIES (Super Admin CRUD)
  // ====================================================================

  /**
   * Create a new master rubric category
   */
  static createCategory(category) {
    return new Promise((resolve, reject) => {
      const { category_id, name, weight = 0, company_id = 0 } = category;
      if (!category_id || !name) {
        return reject(new Error('category_id and name are required'));
      }
      const sql = `
        INSERT INTO rubric_categories (category_id, name, weight, company_id)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(category_id) DO UPDATE SET
          name = excluded.name,
          weight = excluded.weight,
          company_id = excluded.company_id
      `;
      db.run(sql, [category_id, name, parseFloat(weight), company_id], function(err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * Get all master categories
   */
  static getCategories(company_id = null) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM rubric_categories';
      const params = [];
      if (company_id !== null) {
        sql += ' WHERE company_id = ? OR company_id = 0';
        params.push(company_id);
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
  static updateCategory(category_id, updates, performed_by = null) {
    return new Promise((resolve, reject) => {
      // Get old values for audit
      db.get('SELECT * FROM rubric_categories WHERE category_id = ?', [category_id], (err, oldRow) => {
        if (err) return reject(err);
        
        const fields = [];
        const params = [];
        if (updates.name !== undefined) { fields.push('name = ?'); params.push(updates.name); }
        if (updates.weight !== undefined) { fields.push('weight = ?'); params.push(parseFloat(updates.weight)); }
        if (fields.length === 0) return resolve({ updated: false });
        params.push(category_id);
        
        db.run(`UPDATE rubric_categories SET ${fields.join(', ')} WHERE category_id = ?`, params, async function(err) {
          if (err) return reject(err);
          const updated = this.changes > 0;
          
          // Audit log
          if (updated && performed_by) {
            try {
              const newValues = { ...oldRow };
              if (updates.name !== undefined) newValues.name = updates.name;
              if (updates.weight !== undefined) newValues.weight = parseFloat(updates.weight);
              await RubricAdminModel.addAuditLog({
                action: 'UPDATE',
                entity_type: 'master_category',
                entity_id: category_id,
                performed_by,
                old_values: oldRow,
                new_values: newValues
              });
            } catch (auditErr) {
              logger.warn('[RubricAdminModel] Audit log error:', auditErr.message);
            }
          }
          resolve({ updated });
        });
      });
    });
  }

  /**
   * Delete a master category and its indicators + assignments + admin copies
   */
  static deleteCategory(category_id, performed_by = null) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Get old values for audit
        db.get('SELECT * FROM rubric_categories WHERE category_id = ?', [category_id], (err, oldRow) => {
          if (err) return reject(err);
          
          db.run('DELETE FROM rubric_indicators WHERE category_id = ?', [category_id]);
          db.run('DELETE FROM admin_rubric_indicators WHERE original_category_id = ?', [category_id]);
          db.run('DELETE FROM rubric_assignments WHERE category_id = ?', [category_id]);
          db.run('DELETE FROM admin_rubric_categories WHERE original_category_id = ?', [category_id]);
          db.run('DELETE FROM rubric_categories WHERE category_id = ?', [category_id], async function(err) {
            if (err) return reject(err);
            const deleted = this.changes > 0;
            
            if (deleted && performed_by) {
              try {
                await RubricAdminModel.addAuditLog({
                  action: 'DELETE',
                  entity_type: 'master_category',
                  entity_id: category_id,
                  performed_by,
                  old_values: oldRow
                });
              } catch (auditErr) {
                logger.warn('[RubricAdminModel] Audit log error:', auditErr.message);
              }
            }
            resolve({ deleted });
          });
        });
      });
    });
  }

  // ====================================================================
  // MASTER INDICATORS (Super Admin CRUD)
  // ====================================================================

  /**
   * Create a new master rubric indicator
   */
  static createIndicator(indicator) {
    return new Promise((resolve, reject) => {
      const { indicator_id, category_id, name, type = 'HUMAN', is_gate = 0, value = 1, company_id = 0 } = indicator;
      if (!indicator_id || !category_id || !name) {
        return reject(new Error('indicator_id, category_id, and name are required'));
      }
      const sql = `
        INSERT INTO rubric_indicators (indicator_id, category_id, name, type, is_gate, value, company_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(indicator_id) DO UPDATE SET
          name = excluded.name,
          type = excluded.type,
          is_gate = excluded.is_gate,
          value = excluded.value,
          company_id = excluded.company_id
      `;
      db.run(sql, [indicator_id, category_id, name, type, is_gate, parseFloat(value), company_id], function(err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * Get all master indicators
   */
  static getIndicators(company_id = null) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT ri.*, rc.name AS category_name
        FROM rubric_indicators ri
        JOIN rubric_categories rc ON ri.category_id = rc.category_id
      `;
      const params = [];
      if (company_id !== null) {
        sql += ' WHERE ri.company_id = ? OR ri.company_id = 0';
        params.push(company_id);
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
  static getIndicatorsByCategory(category_id) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM rubric_indicators WHERE category_id = ? ORDER BY name ASC',
        [category_id],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  /**
   * Update a master indicator
   */
  static updateIndicator(indicator_id, updates, performed_by = null) {
    return new Promise((resolve, reject) => {
      // Get old values for audit
      db.get('SELECT * FROM rubric_indicators WHERE indicator_id = ?', [indicator_id], (err, oldRow) => {
        if (err) return reject(err);
        
        const fields = [];
        const params = [];
        if (updates.name !== undefined) { fields.push('name = ?'); params.push(updates.name); }
        if (updates.type !== undefined) { fields.push('type = ?'); params.push(updates.type); }
        if (updates.is_gate !== undefined) { fields.push('is_gate = ?'); params.push(updates.is_gate ? 1 : 0); }
        if (updates.category_id !== undefined) { fields.push('category_id = ?'); params.push(updates.category_id); }
        if (updates.value !== undefined) { fields.push('value = ?'); params.push(parseFloat(updates.value)); }
        if (fields.length === 0) return resolve({ updated: false });
        params.push(indicator_id);
        
        db.run(`UPDATE rubric_indicators SET ${fields.join(', ')} WHERE indicator_id = ?`, params, async function(err) {
          if (err) return reject(err);
          const updated = this.changes > 0;
          
          if (updated && performed_by) {
            try {
              const newValues = { ...oldRow };
              if (updates.name !== undefined) newValues.name = updates.name;
              if (updates.type !== undefined) newValues.type = updates.type;
              if (updates.is_gate !== undefined) newValues.is_gate = updates.is_gate ? 1 : 0;
              if (updates.category_id !== undefined) newValues.category_id = updates.category_id;
              if (updates.value !== undefined) newValues.value = parseFloat(updates.value);
              await RubricAdminModel.addAuditLog({
                action: 'UPDATE',
                entity_type: 'master_indicator',
                entity_id: indicator_id,
                performed_by,
                old_values: oldRow,
                new_values: newValues
              });
            } catch (auditErr) {
              logger.warn('[RubricAdminModel] Audit log error:', auditErr.message);
            }
          }
          resolve({ updated });
        });
      });
    });
  }

  /**
   * Delete a master indicator
   */
  static deleteIndicator(indicator_id, performed_by = null) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM rubric_indicators WHERE indicator_id = ?', [indicator_id], (err, oldRow) => {
        if (err) return reject(err);
        
        db.run('DELETE FROM rubric_indicators WHERE indicator_id = ?', [indicator_id], async function(err) {
          if (err) return reject(err);
          const deleted = this.changes > 0;
          
          // Also delete admin copies of this indicator
          await new Promise((res) => {
            db.run('DELETE FROM admin_rubric_indicators WHERE original_indicator_id = ?', [indicator_id], () => res());
          });
          
          if (deleted && performed_by) {
            try {
              await RubricAdminModel.addAuditLog({
                action: 'DELETE',
                entity_type: 'master_indicator',
                entity_id: indicator_id,
                performed_by,
                old_values: oldRow
              });
            } catch (auditErr) {
              logger.warn('[RubricAdminModel] Audit log error:', auditErr.message);
            }
          }
          resolve({ deleted });
        });
      });
    });
  }

  // ====================================================================
  // ASSIGNMENTS — Creates admin-specific copies of categories + indicators
  // ====================================================================

  /**
   * Assign a rubric category (and its indicators) to an admin user.
   * Creates admin-specific copies in admin_rubric_categories and
   * admin_rubric_indicators so the admin can modify their own weightage/value.
   */
  static async assignCategoryToAdmin(category_id, admin_user_id, created_by = null) {
    try {
      // 1. Get the master category
      const category = await RubricAdminModel.getCategoryById(category_id);
      if (!category) {
        throw new Error(`Category ${category_id} not found`);
      }

      // 2. Get master indicators for this category
      const indicators = await RubricAdminModel.getIndicatorsByCategory(category_id);

      // 3. Insert or ignore assignment record
      const assignResult = await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR IGNORE INTO rubric_assignments (category_id, admin_user_id, created_by)
           VALUES (?, ?, ?)`,
          [category_id, admin_user_id, created_by],
          function(err) {
            if (err) return reject(err);
            resolve({ assigned: this.changes > 0, id: this.lastID });
          }
        );
      });

      // 4. Create admin copy of the category (with master's weight)
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR IGNORE INTO admin_rubric_categories (original_category_id, admin_user_id, name, weight)
           VALUES (?, ?, ?, ?)`,
          [category_id, admin_user_id, category.name, category.weight || 0],
          function(err) {
            if (err) return reject(err);
            resolve();
          }
        );
      });

      // 5. Create admin copies of each indicator (with master's value)
      for (const ind of indicators) {
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT OR IGNORE INTO admin_rubric_indicators 
             (original_indicator_id, original_category_id, admin_user_id, name, type, is_gate, value)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [ind.indicator_id, category_id, admin_user_id, ind.name, ind.type || 'HUMAN', ind.is_gate || 0, ind.value || 1],
            function(err) {
              if (err) return reject(err);
              resolve();
            }
          );
        });
      }

      // 6. Audit log
      if (created_by) {
        try {
          await RubricAdminModel.addAuditLog({
            action: 'ASSIGN',
            entity_type: 'assignment',
            entity_id: category_id,
            admin_user_id,
            performed_by: created_by,
            new_values: { category_id, admin_user_id, indicator_count: indicators.length }
          });
        } catch (auditErr) {
          logger.warn('[RubricAdminModel] Audit log error:', auditErr.message);
        }
      }

      logger.info(`[RubricAdminModel] Assigned category ${category_id} to admin ${admin_user_id} with ${indicators.length} indicators`);
      return { assigned: true, category_id, admin_user_id, indicators_copied: indicators.length };
    } catch (err) {
      logger.error(`[RubricAdminModel] Assignment error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Unassign a rubric category from an admin user.
   * Removes assignment record AND admin-specific copies.
   */
  static unassignCategoryFromAdmin(category_id, admin_user_id, performed_by = null) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('DELETE FROM admin_rubric_indicators WHERE original_category_id = ? AND admin_user_id = ?', [category_id, admin_user_id]);
        db.run('DELETE FROM admin_rubric_categories WHERE original_category_id = ? AND admin_user_id = ?', [category_id, admin_user_id]);
        db.run(
          'DELETE FROM rubric_assignments WHERE category_id = ? AND admin_user_id = ?',
          [category_id, admin_user_id],
          async function(err) {
            if (err) return reject(err);
            const unassigned = this.changes > 0;
            
            if (unassigned && performed_by) {
              try {
                await RubricAdminModel.addAuditLog({
                  action: 'UNASSIGN',
                  entity_type: 'assignment',
                  entity_id: category_id,
                  admin_user_id,
                  performed_by
                });
              } catch (auditErr) {
                logger.warn('[RubricAdminModel] Audit log error:', auditErr.message);
              }
            }
            resolve({ unassigned });
          }
        );
      });
    });
  }

  /**
   * Get assignments for a specific admin user
   */
  static getAssignmentsForAdmin(admin_user_id) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT ra.*, rc.name AS category_name
         FROM rubric_assignments ra
         JOIN rubric_categories rc ON ra.category_id = rc.category_id
         WHERE ra.admin_user_id = ?`,
        [admin_user_id],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get admin users for a specific category
   */
  static getAdminsForCategory(category_id) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT ra.*, u.email, u.first_name, u.last_name
         FROM rubric_assignments ra
         JOIN users u ON ra.admin_user_id = u.id
         WHERE ra.category_id = ?`,
        [category_id],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get all assignments
   */
  static getAllAssignments() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT ra.*, rc.name AS category_name, u.email AS admin_email, u.first_name AS admin_first_name, u.last_name AS admin_last_name
         FROM rubric_assignments ra
         JOIN rubric_categories rc ON ra.category_id = rc.category_id
         JOIN users u ON ra.admin_user_id = u.id
         ORDER BY rc.name ASC`,
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  // ====================================================================
  // ADMIN-SPECIFIC DATA (Queries use these for calculations/reports)
  // ====================================================================

  /**
   * Get admin-specific rubric categories for a given admin.
   * These are copies that the admin can modify independently.
   */
  static getAdminCategories(admin_user_id) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM admin_rubric_categories WHERE admin_user_id = ? ORDER BY name ASC',
        [admin_user_id],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get admin-specific rubric indicators for a given admin.
   */
  static getAdminIndicators(admin_user_id) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT ari.*, arc.name AS category_name
         FROM admin_rubric_indicators ari
         JOIN admin_rubric_categories arc ON ari.original_category_id = arc.original_category_id AND ari.admin_user_id = arc.admin_user_id
         WHERE ari.admin_user_id = ?
         ORDER BY arc.name ASC, ari.name ASC`,
        [admin_user_id],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get admin-specific indicators for a specific category
   */
  static getAdminIndicatorsByCategory(admin_user_id, original_category_id) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM admin_rubric_indicators WHERE admin_user_id = ? AND original_category_id = ? ORDER BY name ASC',
        [admin_user_id, original_category_id],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  /**
   * Update admin-specific category weight (only admin's own copy)
   */
  static updateAdminCategoryWeight(admin_user_id, original_category_id, weight, performed_by = null) {
    return new Promise((resolve, reject) => {
      // Get old values
      db.get(
        'SELECT * FROM admin_rubric_categories WHERE admin_user_id = ? AND original_category_id = ?',
        [admin_user_id, original_category_id],
        (err, oldRow) => {
          if (err) return reject(err);
          if (!oldRow) return resolve({ updated: false, message: 'No admin copy found' });

          db.run(
            `UPDATE admin_rubric_categories SET weight = ?, updated_at = CURRENT_TIMESTAMP
             WHERE admin_user_id = ? AND original_category_id = ?`,
            [parseFloat(weight), admin_user_id, original_category_id],
            async function(err) {
              if (err) return reject(err);
              const updated = this.changes > 0;
              
              if (updated && performed_by) {
                try {
                  await RubricAdminModel.addAuditLog({
                    action: 'UPDATE_ADMIN_WEIGHT',
                    entity_type: 'admin_category',
                    entity_id: original_category_id,
                    admin_user_id,
                    performed_by,
                    old_values: oldRow,
                    new_values: { ...oldRow, weight: parseFloat(weight) }
                  });
                } catch (auditErr) {
                  logger.warn('[RubricAdminModel] Audit log error:', auditErr.message);
                }
              }
              resolve({ updated });
            }
          );
        }
      );
    });
  }

  /**
   * Update admin-specific indicator value (only admin's own copy)
   */
  static updateAdminIndicatorValue(admin_user_id, original_indicator_id, value, performed_by = null) {
    return new Promise((resolve, reject) => {
      // Get old values
      db.get(
        'SELECT * FROM admin_rubric_indicators WHERE admin_user_id = ? AND original_indicator_id = ?',
        [admin_user_id, original_indicator_id],
        (err, oldRow) => {
          if (err) return reject(err);
          if (!oldRow) return resolve({ updated: false, message: 'No admin copy found' });

          db.run(
            `UPDATE admin_rubric_indicators SET value = ?, updated_at = CURRENT_TIMESTAMP
             WHERE admin_user_id = ? AND original_indicator_id = ?`,
            [parseFloat(value), admin_user_id, original_indicator_id],
            async function(err) {
              if (err) return reject(err);
              const updated = this.changes > 0;
              
              if (updated && performed_by) {
                try {
                  await RubricAdminModel.addAuditLog({
                    action: 'UPDATE_ADMIN_VALUE',
                    entity_type: 'admin_indicator',
                    entity_id: original_indicator_id,
                    admin_user_id,
                    performed_by,
                    old_values: oldRow,
                    new_values: { ...oldRow, value: parseFloat(value) }
                  });
                } catch (auditErr) {
                  logger.warn('[RubricAdminModel] Audit log error:', auditErr.message);
                }
              }
              resolve({ updated });
            }
          );
        }
      );
    });
  }

  /**
   * Bulk update admin indicator values
   */
  static async bulkUpdateAdminIndicators(admin_user_id, indicators, performed_by = null) {
    const results = [];
    for (const ind of indicators) {
      const result = await RubricAdminModel.updateAdminIndicatorValue(
        admin_user_id, 
        ind.original_indicator_id || ind.indicator_id, 
        ind.value,
        performed_by
      );
      results.push(result);
    }
    return { updated: results.filter(r => r.updated).length, total: indicators.length };
  }

  /**
   * Bulk update admin category weights
   */
  static async bulkUpdateAdminCategories(admin_user_id, categories, performed_by = null) {
    const results = [];
    for (const cat of categories) {
      const result = await RubricAdminModel.updateAdminCategoryWeight(
        admin_user_id,
        cat.original_category_id || cat.category_id,
        cat.weight,
        performed_by
      );
      results.push(result);
    }
    return { updated: results.filter(r => r.updated).length, total: categories.length };
  }

  /**
   * Sync (refresh) admin copies from master for a specific admin.
   * This is called when Super Admin updates master data and wants
   * to propagate changes to an admin's copies (for name changes only,
   * NOT weight/value changes - those are admin-specific).
   */
  static async syncAdminCopiesFromMaster(admin_user_id) {
    const assignments = await RubricAdminModel.getAssignmentsForAdmin(admin_user_id);
    
    for (const assign of assignments) {
      const masterCat = await RubricAdminModel.getCategoryById(assign.category_id);
      if (masterCat) {
        // Update name in admin copy (but preserve admin's weight)
        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE admin_rubric_categories SET name = ?, updated_at = CURRENT_TIMESTAMP
             WHERE admin_user_id = ? AND original_category_id = ?`,
            [masterCat.name, admin_user_id, assign.category_id],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        // Update indicator names (preserve admin's values)
        const masterInds = await RubricAdminModel.getIndicatorsByCategory(assign.category_id);
        for (const ind of masterInds) {
          await new Promise((resolve, reject) => {
            db.run(
              `UPDATE admin_rubric_indicators SET name = ?, type = ?, is_gate = ?, updated_at = CURRENT_TIMESTAMP
               WHERE admin_user_id = ? AND original_indicator_id = ?`,
              [ind.name, ind.type || 'HUMAN', ind.is_gate || 0, admin_user_id, ind.indicator_id],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }
      }
    }
    return { synced: true, admin_user_id };
  }

  // ====================================================================
  // REPORTING — Uses admin-specific data when admin_id is provided
  // ====================================================================

  /**
   * Get the full rubric structure for a specific admin, returning
   * the admin-specific copies (with admin's custom weightage/values).
   */
  static async getFullRubricForAdmin(admin_user_id) {
    const categories = await RubricAdminModel.getAdminCategories(admin_user_id);
    const indicators = await RubricAdminModel.getAdminIndicators(admin_user_id);
    return { categories, indicators };
  }

  /**
   * Get master rubric structure (fallback for super admin / no admin context)
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

  /**
   * Get meeting report using admin-specific rubric data.
   * Falls back to master data if no admin_id provided.
   */
  static getMeetingReportWithAdmin(meetingId, admin_user_id = null) {
    return new Promise((resolve, reject) => {
      let sql;
      if (admin_user_id) {
        // Use admin-specific rubric data
        sql = `
          SELECT 
            arc.name as category_name,
            arc.weight as category_weight,
            ari.name as indicator_name,
            ari.original_indicator_id as indicator_id,
            ari.value as indicator_value,
            ms.score,
            ms.comment,
            ms.scored_at
          FROM meeting_scores ms
          LEFT JOIN admin_rubric_indicators ari ON ms.indicator_id = ari.original_indicator_id AND ari.admin_user_id = ?
          LEFT JOIN admin_rubric_categories arc ON ari.original_category_id = arc.original_category_id AND arc.admin_user_id = ?
          WHERE ms.meeting_id = ?
        `;
      } else {
        // Use master rubric data
        sql = `
          SELECT 
            rc.name as category_name,
            rc.weight as category_weight,
            ri.name as indicator_name,
            ri.indicator_id,
            ri.value as indicator_value,
            ms.score,
            ms.comment,
            ms.scored_at
          FROM meeting_scores ms
          JOIN rubric_indicators ri ON ms.indicator_id = ri.indicator_id
          JOIN rubric_categories rc ON ri.category_id = rc.category_id
          WHERE ms.meeting_id = ?
        `;
      }

      if (admin_user_id) {
        db.all(sql, [admin_user_id, admin_user_id, meetingId], (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      } else {
        db.all(sql, [meetingId], (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      }
    });
  }

  /**
   * Get admin-specific category summary with weighted calculation
   */
  static getAdminCategorySummary(admin_user_id) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          arc.original_category_id,
          arc.name,
          arc.weight,
          (SELECT COUNT(*) FROM admin_rubric_indicators ari WHERE ari.admin_user_id = ? AND ari.original_category_id = arc.original_category_id) as indicator_count,
          (SELECT SUM(ari.value) FROM admin_rubric_indicators ari WHERE ari.admin_user_id = ? AND ari.original_category_id = arc.original_category_id) as total_value
        FROM admin_rubric_categories arc
        WHERE arc.admin_user_id = ?
        ORDER BY arc.name ASC
      `;
      db.all(sql, [admin_user_id, admin_user_id, admin_user_id], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  // ====================================================================
  // PERMISSION VALIDATION
  // ====================================================================

  /**
   * Calculate weighted score for a meeting using admin-specific data
   * Returns score breakdown by category and overall weighted score
   */
  static async calculateAdminWeightedScore(meetingId, admin_user_id) {
    return new Promise(async (resolve, reject) => {
      try {
        // Get meeting scores
        const scoreRows = await new Promise((res, rej) => {
          db.all(
            `SELECT indicator_id, score FROM meeting_session_scores 
             WHERE meeting_id = ? 
             UNION ALL 
             SELECT indicator_id, score FROM meeting_scores 
             WHERE meeting_id = ?`,
            [meetingId, meetingId],
            (err, rows) => {
              if (err) rej(err);
              else res(rows || []);
            }
          );
        });

        // Get admin's rubric structure
        const categories = await RubricAdminModel.getAdminCategories(admin_user_id);
        const indicators = await RubricAdminModel.getAdminIndicators(admin_user_id);

        // Build score map
        const scoreMap = {};
        scoreRows.forEach(row => {
          scoreMap[row.indicator_id] = row.score || 0;
        });

        // Calculate category scores
        const categoryScores = [];
        let totalWeightedScore = 0;

        for (const cat of categories) {
          const catIndicators = indicators.filter(ind => ind.original_category_id === cat.original_category_id);
          
          // Calculate average indicator score for this category
          let categoryTotalScore = 0;
          let categoryIndicatorCount = 0;
          
          for (const ind of catIndicators) {
            const score = scoreMap[ind.original_indicator_id] || 0;
            categoryTotalScore += score * (ind.value || 1);  // Weight by indicator value
            categoryIndicatorCount += (ind.value || 1);
          }

          const categoryAverageScore = categoryIndicatorCount > 0 
            ? categoryTotalScore / categoryIndicatorCount 
            : 0;

          // Apply category weight to get weighted contribution
          const weightedCategoryScore = categoryAverageScore * (cat.weight || 0) / 100;
          totalWeightedScore += weightedCategoryScore;

          categoryScores.push({
            category_id: cat.original_category_id,
            category_name: cat.name,
            category_weight: cat.weight,
            indicator_count: catIndicators.length,
            average_score: Math.round(categoryAverageScore * 100) / 100,
            weighted_contribution: Math.round(weightedCategoryScore * 100) / 100
          });
        }

        resolve({
          meeting_id: meetingId,
          admin_user_id,
          overall_weighted_score: Math.round(totalWeightedScore * 100) / 100,
          category_breakdown: categoryScores,
          total_categories: categories.length,
          total_indicators: indicators.length
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  // ====================================================================
  // PERMISSION VALIDATION
  // ====================================================================

  /**
   * Verify if an admin has access to a specific rubric category
   * Used to enforce data isolation when retrieving reports
   */
  static async hasAdminAccessToCategory(admin_user_id, original_category_id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM admin_rubric_categories 
         WHERE admin_user_id = ? AND original_category_id = ?`,
        [admin_user_id, original_category_id],
        (err, row) => {
          if (err) return reject(err);
          resolve(row && row.count > 0);
        }
      );
    });
  }

  /**
   * Get all categories an admin has been assigned
   * Used for permission checks
   */
  static async getAdminAssignedCategoryIds(admin_user_id) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT original_category_id FROM admin_rubric_categories 
         WHERE admin_user_id = ? ORDER BY original_category_id ASC`,
        [admin_user_id],
        (err, rows) => {
          if (err) return reject(err);
          resolve((rows || []).map(r => r.original_category_id));
        }
      );
    });
  }

  // ====================================================================
  // AUDIT LOG RETRIEVAL
  // ====================================================================

  /**
   * Get audit logs, optionally filtered
   */
  static getAuditLogs({ entity_type = null, entity_id = null, admin_user_id = null, limit = 100 } = {}) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT ral.*, u.email as performed_by_email 
                 FROM rubric_audit_log ral
                 LEFT JOIN users u ON ral.performed_by = u.id
                 WHERE 1=1`;
      const params = [];
      if (entity_type) { sql += ' AND ral.entity_type = ?'; params.push(entity_type); }
      if (entity_id) { sql += ' AND ral.entity_id = ?'; params.push(entity_id); }
      if (admin_user_id) { sql += ' AND ral.admin_user_id = ?'; params.push(admin_user_id); }
      sql += ' ORDER BY ral.created_at DESC LIMIT ?';
      params.push(limit);
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }
}

module.exports = RubricAdminModel;