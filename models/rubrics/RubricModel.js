/**
 * root/models/RubricModel.js
 * 
 * Handles rubric definitions, meeting scoring, and reports.
 * Updated to support admin-specific rubric data for calculations.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class RubricModel {
  /**
   * 1. Rubric Definitions
   * Saves or updates categories and indicators (The Rubric Setup)
   */
  static async syncRubric(categories, indicators) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Upsert Categories
        const catSql = `INSERT INTO admin_rubric_categories (category_id, name, weight) 
                        VALUES (?, ?, ?) 
                        ON DUPLICATE KEY UPDATE name=VALUES(name), weight=VALUES(weight)`;
        
        categories.forEach(cat => {
          db.run(catSql, [cat.category_id, cat.name, cat.weight]);
        });

        // Upsert Indicators
        const indSql = `INSERT INTO admin_rubric_indicators (indicator_id, category_id, name, type, is_gate, value) 
                        VALUES (?, ?, ?, ?, ?, ?) 
                        ON DUPLICATE KEY UPDATE 
                        name=VALUES(name), type=VALUES(type), is_gate=VALUES(is_gate), value=VALUES(value)`;

        indicators.forEach(ind => {
          db.run(indSql, [ind.indicator_id, ind.category_id, ind.name, ind.type, ind.is_gate || 0, ind.value || 1]);
        });

        db.run('COMMIT', (err) => {
          if (err) {
            logger.error(`[RubricModel] Sync Error: ${err.message}`);
            db.run('ROLLBACK');
            reject(err);
          } else {
            logger.info('[RubricModel] Rubric structure synced successfully');
            resolve(true);
          }
        });
      });
    });
  }

  /**
   * 2. Meeting Scoring
   * Saves or updates scores for a specific meeting
   */
  static saveMeetingScores(meetingId, scores) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        const sql = `INSERT INTO meeting_scores (meeting_id, indicator_id, score, comment) 
                     VALUES (?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE 
                     score=VALUES(score), comment=VALUES(comment), scored_at=CURRENT_TIMESTAMP`;

        const stmt = db.prepare(sql);
        
        scores.forEach(s => {
          stmt.run([meetingId, s.indicator_id, s.score, s.comment || null]);
        });

        stmt.finalize((err) => {
          if (err) {
            logger.error(`[RubricModel] Score Save Error: ${err.message}`);
            reject(err);
          } else {
            logger.info(`[RubricModel] Scores saved for meeting: ${meetingId}`);
            resolve(true);
          }
        });
      });
    });
  }

  /**
   * 3. Retrieval
   * Gets a complete report for a meeting including category names and weights.
   * If admin_user_id is provided, uses admin-specific rubric data.
   */
  static getMeetingReport(meetingId, admin_user_id = null) {
    return new Promise((resolve, reject) => {
      let sql;
      let params;

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
          LEFT JOIN admin_rubric_indicators ari ON ms.indicator_id = ari.master_indicator_id 
          AND ari.admin_user_id = ?
          LEFT JOIN admin_rubric_categories arc ON ari.master_category_id = arc.master_category_id 
          AND arc.admin_user_id = ?
          WHERE ms.meeting_id = ?
        `;
        params = [admin_user_id, admin_user_id, meetingId];
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
          JOIN admin_rubric_indicators ri ON ms.indicator_id = ri.id
          JOIN admin_rubric_categories rc ON ri.admin_category_id = rc.id
          WHERE ms.meeting_id = ?
        `;
        params = [meetingId];
      }

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error(`[RubricModel] Report Error: ${err.message}`);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Gets all rubric definitions (master data)
   */
  static getFullRubric() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT rc.name as category, ri.* 
        FROM admin_rubric_indicators ri 
        JOIN admin_rubric_categories rc ON ri.admin_category_id = rc.id
      `;
      db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Gets full rubric for a specific admin (admin-specific copies)
   */
  static getFullRubricForAdmin(admin_user_id) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT arc.name as category, ari.* 
        FROM admin_rubric_indicators ari 
        JOIN admin_rubric_categories arc ON ari.master_category_id = arc.master_category_id AND ari.admin_user_id = arc.admin_user_id
        WHERE ari.admin_user_id = ?
      `;
      db.all(sql, [admin_user_id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = RubricModel;