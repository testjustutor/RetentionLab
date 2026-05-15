const { db } = require('../database/db');
const { logger } = require('../utils/logger');

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
        const catSql = `INSERT INTO rubric_categories (category_id, name, weight) 
                        VALUES (?, ?, ?) 
                        ON CONFLICT(category_id) DO UPDATE SET name=excluded.name, weight=excluded.weight`;
        
        categories.forEach(cat => {
          db.run(catSql, [cat.category_id, cat.name, cat.weight]);
        });

        // Upsert Indicators
        const indSql = `INSERT INTO rubric_indicators (indicator_id, category_id, name, type, is_gate) 
                        VALUES (?, ?, ?, ?, ?) 
                        ON CONFLICT(indicator_id) DO UPDATE SET 
                        name=excluded.name, type=excluded.type, is_gate=excluded.is_gate`;

        indicators.forEach(ind => {
          db.run(indSql, [ind.indicator_id, ind.category_id, ind.name, ind.type, ind.is_gate || 0]);
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
                     ON CONFLICT(meeting_id, indicator_id) DO UPDATE SET 
                     score=excluded.score, comment=excluded.comment, scored_at=CURRENT_TIMESTAMP`;

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
   * Gets a complete report for a meeting including category names and weights
   */
  static getMeetingReport(meetingId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          rc.name as category_name, 
          rc.weight as category_weight,
          ri.name as indicator_name,
          ri.indicator_id,
          ms.score,
          ms.comment,
          ms.scored_at
        FROM meeting_scores ms
        JOIN rubric_indicators ri ON ms.indicator_id = ri.indicator_id
        JOIN rubric_categories rc ON ri.category_id = rc.category_id
        WHERE ms.meeting_id = ?
      `;

      db.all(sql, [meetingId], (err, rows) => {
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
   * Gets all rubric definitions
   */
  static getFullRubric() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT rc.name as category, ri.* 
        FROM rubric_indicators ri 
        JOIN rubric_categories rc ON ri.category_id = rc.category_id
      `;
      db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = RubricModel;