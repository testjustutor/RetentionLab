/**
 * root/models/RubricEvaluationModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class RubricEvaluationModel {
  /**
   * Create or update a single indicator evaluation for a session
   */
  static upsert(evaluation) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_rubric_evaluations 
        (session_id, indicator_id, rating, evidence_text, comment, evaluated_by, confidence, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
        ON DUPLICATE KEY UPDATE 
        rating=VALUES(rating), evidence_text=VALUES(evidence_text), comment=VALUES(comment), 
        evaluated_by=VALUES(evaluated_by), confidence=VALUES(confidence), updated_at=CURRENT_TIMESTAMP`;
      
      const params = [
        evaluation.session_id,
        evaluation.indicator_id,
        evaluation.rating || 'N/A',
        evaluation.evidence_text || null,
        evaluation.comment || null,
        evaluation.evaluated_by || 'AI',
        evaluation.confidence || 'Medium'
      ];
      
      db.run(sql, params, function(err) {
        if (err) { 
          logger.error('[RubricEvaluationModel] upsert error', err); 
          return reject(err); 
        }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * Get all evaluations for a session with indicator details
   */
  static getBySession(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT 
        sre.*,
        ri.name as indicator_name,
        ri.category_id,
        ri.type as indicator_type,
        ri.is_gate,
        ri.value as weight,
        ri.benchmark,
        ri.requires_video
      FROM session_rubric_evaluations sre
      JOIN admin_rubric_indicators ri ON sre.indicator_id = ri.indicator_id
      WHERE sre.session_id = ?
      ORDER BY ri.category_id, sre.indicator_id`;
      
      db.all(sql, [sessionId], (err, rows) => {
        if (err) { 
          logger.error('[RubricEvaluationModel] getBySession error', err); 
          return reject(err); 
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get a single evaluation by session and indicator
   */
  static getBySessionAndIndicator(sessionId, indicatorId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM session_rubric_evaluations 
                   WHERE session_id = ? AND indicator_id = ? LIMIT 1`;
      
      db.get(sql, [sessionId, indicatorId], (err, row) => {
        if (err) { 
          logger.error('[RubricEvaluationModel] getBySessionAndIndicator error', err); 
          return reject(err); 
        }
        resolve(row || null);
      });
    });
  }

  /**
   * Delete all evaluations for a session
   */
  static deleteBySession(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM session_rubric_evaluations WHERE session_id = ?`;
      
      db.run(sql, [sessionId], function(err) {
        if (err) { 
          logger.error('[RubricEvaluationModel] deleteBySession error', err); 
          return reject(err); 
        }
        resolve({ changes: this.changes });
      });
    });
  }

  /**
   * Bulk insert evaluations for a session
   */
  static bulkInsert(evaluations) {
    return new Promise((resolve, reject) => {
      if (!evaluations || evaluations.length === 0) {
        return resolve({ changes: 0 });
      }

      const sql = `INSERT INTO session_rubric_evaluations 
        (session_id, indicator_id, rating, evidence_text, comment, evaluated_by, confidence) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        rating=VALUES(rating), evidence_text=VALUES(evidence_text), comment=VALUES(comment), 
        evaluated_by=VALUES(evaluated_by), confidence=VALUES(confidence)`;
      
      let completed = 0;
      let errors = [];
      const results = [];
      
      evaluations.forEach((evaluation, index) => {
        const params = [
          evaluation.session_id,
          evaluation.indicator_id,
          evaluation.rating || 'N/A',
          evaluation.evidence_text || null,
          evaluation.comment || null,
          evaluation.evaluated_by || 'AI',
          evaluation.confidence || 'Medium'
        ];
        
        db.run(sql, params, function(err) {
          if (err) {
            errors.push({ index, error: err });
          } else {
            results.push({ id: this.lastID, changes: this.changes });
          }
          
          completed++;
          if (completed === evaluations.length) {
            if (errors.length > 0) {
              logger.error('[RubricEvaluationModel] bulkInsert completed with errors', errors);
            }
            resolve({ results, errors, total: evaluations.length });
          }
        });
      });
    });
  }
}

module.exports = RubricEvaluationModel;