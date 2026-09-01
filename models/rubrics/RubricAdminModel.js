/**
 * root/models/rubrics/RubricAdminModel.js
 * 
 * Manages ONLY admin-specific rubric operations:
 * 1. Admin-specific copies in admin_rubric_categories / admin_rubric_indicators
 * 2. Assignment flow: when admin copies from master → copies created for that admin
 * 3. Admins can update only their own weight/value without affecting masters
 * 4. All reports/calculations use admin-specific data based on admin_id
 * 5. Audit logging for all operations
 * 
 * For master rubric operations (rubric_categories / rubric_indicators), see MasterRubricModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');
const MasterRubricModel = require('./MasterRubricModel');

class RubricAdminModel {
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
  // ASSIGNMENTS — Creates admin-specific copies of categories + indicators
  // ====================================================================

  /**
   * Assign a rubric category (and its indicators) to an admin user.
   * Creates admin-specific copies in admin_rubric_categories and
   * admin_rubric_indicators so the admin can modify their own weightage/value.
   */
  static async assignCategoryToAdmin(category_id, admin_user_id, created_by = null) {
    try {
      // 1. Get the master category (using MasterRubricModel)
      const category = await MasterRubricModel.getCategoryById(category_id);
      if (!category) {
        throw new Error(`Category ${category_id} not found`);
      }

      // 2. Get master indicators for this category (using MasterRubricModel)
      const indicators = await MasterRubricModel.getIndicatorsByCategory(category_id);

      // 3. Create admin copy of the category (with master's weight) — admin tables only
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT IGNORE INTO admin_rubric_categories
            (master_category_id, category_code, admin_user_id, name, weight, source)
           VALUES (?, ?, ?, ?, ?, 'master')`,
          [category.id, category.category_code, admin_user_id, category.name, parseFloat(category.weight) || 0],
          function(err) {
            if (err) return reject(err);
            resolve();
          }
        );
      });

      // 4. Resolve the admin category's own PK (admin_category_id) — required by
      //    admin_rubric_indicators.admin_category_id (NOT NULL FK). Look it up
      //    because INSERT IGNORE may no-op if the admin already had this category.
      const adminCat = await new Promise((resolve, reject) => {
        db.get(
          `SELECT id FROM admin_rubric_categories
           WHERE master_category_id = ? AND admin_user_id = ? LIMIT 1`,
          [category.id, admin_user_id],
          (err, row) => err ? reject(err) : resolve(row || null)
        );
      });
      if (!adminCat) {
        throw new Error(`Admin category copy not found for master category ${category_id}`);
      }

      // 5. Create admin copies of each indicator (with master's value and benchmark)
      for (const ind of indicators) {
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT IGNORE INTO admin_rubric_indicators
             (admin_category_id, master_indicator_id, indicator_code, master_category_id,
              category_code, admin_user_id, name, type, is_gate, value, benchmark, source)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'master')`,
            [adminCat.id, ind.id, ind.indicator_code, category.id, category.category_code, admin_user_id,
             ind.name, ind.type || 'HUMAN', ind.is_gate || 0, parseFloat(ind.value) || 1, ind.benchmark || null],
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
   * Removes admin-specific copies only (admin tables only).
   */
  static unassignCategoryFromAdmin(category_id, admin_user_id, performed_by = null) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('DELETE FROM admin_rubric_indicators WHERE master_category_id = ? AND admin_user_id = ?', [category_id, admin_user_id]);
        db.run('DELETE FROM admin_rubric_categories WHERE master_category_id = ? AND admin_user_id = ?', [category_id, admin_user_id], async function(err) {
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
        });
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

  /**
   * Get assigned category IDs for an admin
   */
  static getAdminAssignedCategoryIds(admin_user_id) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT master_category_id FROM admin_rubric_categories WHERE admin_user_id = ?',
        [admin_user_id],
        (err, rows) => {
          if (err) return reject(err);
          resolve((rows || []).map(r => r.master_category_id));
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
        'SELECT * FROM admin_rubric_categories WHERE admin_user_id = ? ORDER BY category_code ASC',
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
         JOIN admin_rubric_categories arc ON ari.admin_category_id = arc.id 
         AND ari.admin_user_id = arc.admin_user_id
         WHERE ari.admin_user_id = ?
         ORDER BY arc.category_code ASC, ari.category_code ASC`,
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
  static getAdminIndicatorsByCategory(admin_user_id, master_category_id) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM admin_rubric_indicators WHERE admin_user_id = ? AND master_category_id = ? ORDER BY name ASC',
        [admin_user_id, master_category_id],
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
  static updateAdminCategoryWeight(admin_user_id, master_category_id, weight, performed_by = null) {
    return new Promise((resolve, reject) => {
      // Get old values
      db.get(
        'SELECT * FROM admin_rubric_categories WHERE admin_user_id = ? AND master_category_id = ?',
        [admin_user_id, master_category_id],
        (err, oldRow) => {
          if (err) return reject(err);
          if (!oldRow) return resolve({ updated: false, message: 'No admin copy found' });

          db.run(
            `UPDATE admin_rubric_categories SET weight = ?, updated_at = CURRENT_TIMESTAMP
             WHERE admin_user_id = ? AND master_category_id = ?`,
            [parseFloat(weight), admin_user_id, master_category_id],
            async function(err) {
              if (err) return reject(err);
              const updated = this.changes > 0;
              
              if (updated && performed_by) {
                try {
                  await RubricAdminModel.addAuditLog({
                    action: 'UPDATE_ADMIN_WEIGHT',
                    entity_type: 'admin_category',
                    entity_id: master_category_id,
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
  static updateAdminIndicatorValue(admin_user_id, master_indicator_id, value, performed_by = null) {
    return new Promise((resolve, reject) => {
      // Get old values
      db.get(
        'SELECT * FROM admin_rubric_indicators WHERE admin_user_id = ? AND master_indicator_id = ?',
        [admin_user_id, master_indicator_id],
        (err, oldRow) => {
          if (err) return reject(err);
          if (!oldRow) return resolve({ updated: false, message: 'No admin copy found' });

          db.run(
            `UPDATE admin_rubric_indicators SET value = ?, updated_at = CURRENT_TIMESTAMP
             WHERE admin_user_id = ? AND master_indicator_id = ?`,
            [parseFloat(value), admin_user_id, master_indicator_id],
            async function(err) {
              if (err) return reject(err);
              const updated = this.changes > 0;
              
              if (updated && performed_by) {
                try {
                  await RubricAdminModel.addAuditLog({
                    action: 'UPDATE_ADMIN_VALUE',
                    entity_type: 'admin_indicator',
                    entity_id: master_indicator_id,
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
        ind.master_indicator_id || ind.indicator_id, 
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
        cat.master_category_id || cat.category_id,
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
   * Uses admin_rubric_categories to determine which categories to sync.
   */
  static async syncAdminCopiesFromMaster(admin_user_id) {
    const adminCategories = await RubricAdminModel.getAdminCategories(admin_user_id);
    
    for (const adminCat of adminCategories) {
      const masterCat = await MasterRubricModel.getCategoryById(adminCat.master_category_id);
      if (masterCat) {
        // Update name in admin copy (but preserve admin's weight)
        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE admin_rubric_categories SET name = ?, updated_at = CURRENT_TIMESTAMP
             WHERE admin_user_id = ? AND master_category_id = ?`,
            [masterCat.name, admin_user_id, adminCat.master_category_id],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        // Update indicator names (preserve admin's values)
        const masterInds = await MasterRubricModel.getIndicatorsByCategory(adminCat.master_category_id);
        for (const ind of masterInds) {
          await new Promise((resolve, reject) => {
            db.run(
              `UPDATE admin_rubric_indicators SET name = ?, type = ?, is_gate = ?, updated_at = CURRENT_TIMESTAMP
               WHERE admin_user_id = ? AND master_indicator_id = ?`,
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
            ari.master_indicator_id as indicator_id,
            ari.value as indicator_value,
            ms.score,
            ms.comment,
            ms.scored_at
          FROM meeting_scores ms
          LEFT JOIN admin_rubric_indicators ari ON ms.indicator_id = ari.master_indicator_id AND ari.admin_user_id = ?
          LEFT JOIN admin_rubric_categories arc ON ari.master_category_id = arc.master_category_id AND arc.admin_user_id = ?
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
          JOIN admin_rubric_indicators ri ON ms.indicator_id = ri.indicator_id
          JOIN admin_rubric_categories rc ON ri.category_id = rc.category_id
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
          arc.master_category_id,
          arc.name,
          arc.weight,
          (SELECT COUNT(*) FROM admin_rubric_indicators ari WHERE ari.admin_user_id = ? AND ari.master_category_id = arc.master_category_id) as indicator_count,
          (SELECT SUM(ari.value) FROM admin_rubric_indicators ari WHERE ari.admin_user_id = ? AND ari.master_category_id = arc.master_category_id) as total_value
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
  // WEIGHTED SCORE CALCULATION
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
          const catIndicators = indicators.filter(ind => ind.master_category_id === cat.master_category_id);
          
          // Calculate average indicator score for this category
          let categoryTotalScore = 0;
          let categoryIndicatorCount = 0;
          
          for (const ind of catIndicators) {
            const score = scoreMap[ind.master_indicator_id] || 0;
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
            category_id: cat.master_category_id,
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
   */
  static async hasAdminAccessToCategory(admin_user_id, master_category_id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM admin_rubric_categories 
         WHERE admin_user_id = ? AND master_category_id = ?`,
        [admin_user_id, master_category_id],
        (err, row) => {
          if (err) return reject(err);
          resolve(row && row.count > 0);
        }
      );
    });
  }

  /**
   * Get all categories an admin has been assigned
   */
  static async getAdminAssignedCategoryIds(admin_user_id) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT master_category_id FROM admin_rubric_categories WHERE admin_user_id = ?',
        [admin_user_id],
        (err, rows) => {
          if (err) return reject(err);
          resolve((rows || []).map(r => r.master_category_id));
        }
      );
    });
  }

  // ====================================================================
  // CUSTOM CATEGORY & INDICATOR CREATION
  // ====================================================================

  /**
   * Create a custom category for an admin
   */
  static async _nextCategoryCode() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT category_code
         FROM admin_rubric_categories
         WHERE category_code IS NOT NULL
         ORDER BY id DESC`,
        [],
        (err, rows) => {
          if (err) return reject(err);

          if (!rows || rows.length === 0) {
            return resolve('A');
          }

          // Find the longest/relevant existing repeated-letter code.
          // Expected format: A, B, ..., Z, AA, BB, ..., ZZ, AAA, BBB, ...
          let maxLength = 1;
          let maxLetter = 'A';

          for (const row of rows) {
            const code = String(row.category_code || '').trim().toUpperCase();

            if (!/^[A-Z]+$/.test(code)) continue;

            // Valid only when all characters are the same:
            // A, B, ..., AA, BB, ..., AAA, BBB, ...
            const firstChar = code[0];

            if (![...code].every(char => char === firstChar)) {
              continue;
            }

            const length = code.length;

            // Compare by length first, then alphabetically.
            if (
              length > maxLength ||
              (length === maxLength && firstChar > maxLetter)
            ) {
              maxLength = length;
              maxLetter = firstChar;
            }
          }

          // Move to the next letter.
          let nextCharCode = maxLetter.charCodeAt(0) + 1;
          let nextLength = maxLength;

          // Z -> AA
          // ZZ -> AAA
          // ZZZ -> AAAA
          if (nextCharCode > 'Z'.charCodeAt(0)) {
            nextCharCode = 'A'.charCodeAt(0);
            nextLength++;
          }

          const nextChar = String.fromCharCode(nextCharCode);

          resolve(nextChar.repeat(nextLength));
        }
      );
    });
  }

  /**
   * Create a custom category for an admin.
   * fk_arc_category_code requires an existing rubric_categories.category_code, so the
   * first master code is stamped as a carrier while master_category_id stays NULL —
   * (admin_user_id, NULL) bypasses uq_arc_admin_category so customs stay unrestricted.
   */
  static async createCustomCategory(admin_user_id, name, weight) {
    const carrierCode = await RubricAdminModel._nextCategoryCode();
    if (!carrierCode) throw new Error('No master categories available yet');
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO admin_rubric_categories
           (category_code, admin_user_id, name, weight, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'custom', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [carrierCode, admin_user_id, name, parseFloat(weight) || 0],
        function(err) {
          if (err) return reject(err);
          resolve({ categoryId: String(this.lastID) });
        }
      );
    });
  }


  static async _nextIndicatorCode() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT indicator_code
         FROM admin_rubric_indicators
         WHERE indicator_code IS NOT NULL
         ORDER BY id DESC`,
        [],
        (err, rows) => {
          if (err) return reject(err);

          if (!rows || rows.length === 0) {
            return resolve('A1.1');
          }

          let maxLength = 1;
          let maxLetter = 'A';

          for (const row of rows) {
            const code = String(row.indicator_code || '').trim().toUpperCase();

            const match = code.match(/^([A-Z]+)1\.1$/);

            if (!match) continue;

            const letterPart = match[1];
            const firstChar = letterPart[0];

            if (![...letterPart].every(char => char === firstChar)) {
              continue;
            }

            const length = letterPart.length;

            if (
              length > maxLength ||
              (length === maxLength && firstChar > maxLetter)
            ) {
              maxLength = length;
              maxLetter = firstChar;
            }
          }

          let nextCharCode = maxLetter.charCodeAt(0) + 1;
          let nextLength = maxLength;

          if (nextCharCode > 'Z'.charCodeAt(0)) {
            nextCharCode = 'A'.charCodeAt(0);
            nextLength++;
          }

          const nextChar = String.fromCharCode(nextCharCode);

          resolve(`${nextChar.repeat(nextLength)}1.1`);
        }
      );
    });
  }

  /**
   * Create a custom indicator for an admin
   */
  static async createCustomIndicator(admin_user_id, { category_id, name, type, is_gate, value, benchmark }) {
    const parentRef = String(category_id == null ? '' : category_id).trim();
    if (!parentRef) throw new Error('Category is required');

    // Resolve parent ref: admin-categories PK first (covers custom parents whose
    // dropdown values are row PKs), then fall back to the master table.
    let childMasterCatId = null; // master_category_id parity for FE grouping
    let catCarrier = null;       // must exist in rubric_categories.category_code (FK)
    let adminCatId = null;       // admin_rubric_categories PK (NOT NULL FK on indicators)
    const arcRow = /^\d+$/.test(parentRef)
      ? await new Promise((resolve, reject) => {
          db.get(
            'SELECT id, master_category_id, category_code FROM admin_rubric_categories WHERE id = ? AND admin_user_id = ? LIMIT 1',
            [parseInt(parentRef, 10), admin_user_id],
            (err, row) => err ? reject(err) : resolve(row || null)
          );
        })
      : null;
    if (arcRow) {
      childMasterCatId = arcRow.master_category_id;
      catCarrier = arcRow.category_code;
      adminCatId = arcRow.id;
    } else {
      const pc = await MasterRubricModel.getCategoryById(parentRef);
      if (!pc) throw new Error(`Parent category ${parentRef} not found`);
      childMasterCatId = pc.id;
      catCarrier = pc.category_code;
      // Parent is a master category — find this admin's copy so we can stamp
      // the NOT NULL admin_category_id on the new indicator.
      const adminCat = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM admin_rubric_categories WHERE master_category_id = ? AND admin_user_id = ? LIMIT 1',
          [pc.id, admin_user_id],
          (err, row) => err ? reject(err) : resolve(row || null)
        );
      });
      if (!adminCat) throw new Error(`Admin does not have category ${parentRef}; copy the category first`);
      adminCatId = adminCat.id;
    }

    const indCarrier = await RubricAdminModel._nextIndicatorCode();
    if (!indCarrier) throw new Error('No master indicators available yet');

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO admin_rubric_indicators
           (admin_category_id, master_indicator_id, indicator_code, master_category_id,
            category_code, admin_user_id, name, type, is_gate, value, benchmark, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'custom', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [adminCatId, null, indCarrier, childMasterCatId, catCarrier, admin_user_id,
         name, type || 'HUMAN', is_gate ? 1 : 0, parseFloat(value) || 1, benchmark || null],
        function(err) {
          if (err) return reject(err);
          resolve({ indicatorId: String(this.lastID) });
        }
      );
    });
  }

  /**
   * Delete an admin indicator
   */
  static async deleteAdminIndicator(admin_user_id, indicator_id) {
    return new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM admin_rubric_indicators WHERE id = ? AND admin_user_id = ?`,
        [indicator_id, admin_user_id],
        function(err) {
          if (err) return reject(err);
          resolve({ deleted: this.changes > 0 });
        }
      );
    });
  }

  // ====================================================================
  // STATUS MANAGEMENT
  // ====================================================================

  /**
   * Update indicator status for an admin
   */
  static async updateIndicatorStatus(admin_user_id, indicator_id, status) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE admin_rubric_indicators SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE master_indicator_id = ? AND admin_user_id = ?`,
        [status, indicator_id, admin_user_id],
        function(err) {
          if (err) return reject(err);
          if (this.changes === 0) return reject(new Error('Indicator not found'));
          resolve({ changes: this.changes });
        }
      );
    });
  }

  /**
   * Get the category ID for an indicator
   */
  static async getCategoryIdForIndicator(admin_user_id, indicator_id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT master_category_id FROM admin_rubric_indicators WHERE master_indicator_id = ? AND admin_user_id = ?`,
        [indicator_id, admin_user_id],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });
  }

  /**
   * Get all indicators in a category for an admin
   */
  static async getIndicatorsByCategoryForAdmin(admin_user_id, master_category_id) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, status FROM admin_rubric_indicators WHERE master_category_id = ? AND admin_user_id = ?`,
        [master_category_id, admin_user_id],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      );
    });
  }

  /**
   * Update category status for an admin
   */
  static async updateCategoryStatus(admin_user_id, master_category_id, status) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE admin_rubric_categories SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE master_category_id = ? AND admin_user_id = ?`,
        [status, master_category_id, admin_user_id],
        function(err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    });
  }
  // ==================================================================
  // BULK COPY FROM MASTER (POST /api/admin/rubric-admin/copy-from-master)
  // ==================================================================

  /**
   * Copy selected master categories (with their active indicators) into an
   * admin's own rubric tables.
   * - Every selection must be a numeric master-category id (400 otherwise).
   * - Categories the admin already has are skipped (idempotent resubmits).
   * - Returns how many categories were ACTUALLY newly persisted — INSERT IGNORE
   *   can silently drop rows (FK/duplicate-key downgraded to warnings), so each
   *   copy is verified with a follow-up lookup before being counted.
   */
  static async copyMasterCategories(admin_user_id, categoryIds = []) {
    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      const e = new Error('Please select at least one category'); e.statusCode = 400; throw e;
    }

    const ids = [...new Set(categoryIds.map(id => String(id).trim()).filter(s => s !== ''))];
    if (ids.length === 0 || ids.some(id => !/^\d+$/.test(id))) {
      const e = new Error('Invalid category selection — refresh the page and try again'); e.statusCode = 400; throw e;
    }

    const assigned = new Set(await RubricAdminModel.getAdminAssignedCategoryIds(admin_user_id));

    let copied = 0;
    for (const rawId of ids) {
      const masterId = parseInt(rawId, 10);
      if (assigned.has(masterId)) continue;
      await RubricAdminModel.assignCategoryToAdmin(masterId, admin_user_id, admin_user_id);
      const persisted = await RubricAdminModel.categoryCopyExists(masterId, admin_user_id);
      if (persisted) { copied++; assigned.add(masterId); }
    }
    return copied;
  }

  /** True when this master category already exists as an admin copy */
  static async categoryCopyExists(master_category_id, admin_user_id) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM admin_rubric_categories WHERE master_category_id = ? AND admin_user_id = ? LIMIT 1',
        [master_category_id, admin_user_id],
        (err, row) => err ? reject(err) : resolve(!!row)
      );
    });
  }

  // ------------------------------------------------------------------
  // Aliases consumed by controllers/admin/adminRubricController.js
  // ------------------------------------------------------------------

  /** Master categories (all active) */
  static async getMasterCategories() {
    return MasterRubricModel.getCategories();
  }

  /** Master indicators, optionally filtered by master category id/code */
  static async getMasterIndicators(categoryId = null) {
    if (categoryId != null && String(categoryId).trim() !== '') {
      return MasterRubricModel.getIndicatorsByCategory(String(categoryId).trim());
    }
    return MasterRubricModel.getIndicators();
  }

  /** Custom category creation (returns admin-table PK id) */
  static async createAdminCategory(admin_user_id, { name, weight }) {
    const result = await RubricAdminModel.createCustomCategory(admin_user_id, name, weight);
    return result.categoryId;
  }

  /**
   * Custom indicator creation. Accepts the adminRubricController payload shape
   * ({ master_category_id|category_id, admin_user_id, ... }) directly, or the
   * positional form ({admin_user_id}, {category_id, ...}).
   */
  static async createAdminIndicator(input = {}) {
    let payload = input;
    let admin = input ? input.admin_user_id : undefined;
    if (arguments.length === 2) {
      admin = arguments[0];
      payload = arguments[1] || {};
    }
    return RubricAdminModel.createCustomIndicator(admin, {
      category_id: payload.master_category_id != null ? payload.master_category_id : payload.category_id,
      name: payload.name,
      type: payload.type,
      is_gate: payload.is_gate,
      value: payload.value,
      benchmark: payload.benchmark
    });
  }

  /**
   * Delete an admin category by admin-table PK plus its indicator copies.
   * Children share the parent's master link: copied masters group on
   * master_category_id; customs group on (NULL master + same carrier code).
   */
  static async deleteAdminCategory(categoryId, admin_user_id) {
    const pk = parseInt(categoryId, 10);
    if (!Number.isInteger(pk)) return false;

    const row = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, master_category_id, category_code FROM admin_rubric_categories WHERE id = ? AND admin_user_id = ? LIMIT 1',
        [pk, admin_user_id],
        (err, r) => err ? reject(err) : resolve(r || null)
      );
    });
    if (!row) return false;

    await new Promise((resolve, reject) => {
      const sql = row.master_category_id != null
        ? 'DELETE FROM admin_rubric_indicators WHERE admin_user_id = ? AND master_category_id = ?'
        : 'DELETE FROM admin_rubric_indicators WHERE admin_user_id = ? AND master_category_id IS NULL AND category_code = ?';
      const params = row.master_category_id != null ? [admin_user_id, row.master_category_id] : [admin_user_id, row.category_code];
      db.run(sql, params, err => err ? reject(err) : resolve());
    });

    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM admin_rubric_categories WHERE id = ? AND admin_user_id = ?',
        [pk, admin_user_id],
        function(err) {
          if (err) return reject(err);
          resolve(this.changes > 0);
        }
      );
    });
  }
}

module.exports = RubricAdminModel;