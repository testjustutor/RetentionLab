/**
 * root/models/RubricSummaryModel.js
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class RubricSummaryModel {
  /**
   * Create or update a session rubric summary
   */
  static upsert(summary) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_rubric_summary 
        (session_id, weighted_score_pct, gate_status, overall_rating, confidence_level, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
        ON DUPLICATE KEY UPDATE 
        weighted_score_pct=VALUES(weighted_score_pct), 
        gate_status=VALUES(gate_status), 
        overall_rating=VALUES(overall_rating), 
        confidence_level=VALUES(confidence_level), 
        updated_at=CURRENT_TIMESTAMP`;
      
      const params = [
        summary.session_id,
        summary.weighted_score_pct || 0.00,
        summary.gate_status || 'all_passed',
        summary.overall_rating || 'Developing',
        summary.confidence_level || 'Medium — transcript-based; video/audio not available'
      ];
      
      db.run(sql, params, function(err) {
        if (err) { 
          logger.error('[RubricSummaryModel] upsert error', err); 
          return reject(err); 
        }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * Get summary for a session
   */
  static getBySession(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM session_rubric_summary 
                   WHERE session_id = ? LIMIT 1`;
      
      db.get(sql, [sessionId], (err, row) => {
        if (err) { 
          logger.error('[RubricSummaryModel] getBySession error', err); 
          return reject(err); 
        }
        resolve(row || null);
      });
    });
  }

  /**
   * Get summaries for multiple sessions
   */
  static getBySessionIds(sessionIds) {
    return new Promise((resolve, reject) => {
      if (!sessionIds || sessionIds.length === 0) {
        return resolve([]);
      }

      const placeholders = sessionIds.map(() => '?').join(',');
      const sql = `SELECT * FROM session_rubric_summary 
                   WHERE session_id IN (${placeholders})`;
      
      db.all(sql, sessionIds, (err, rows) => {
        if (err) { 
          logger.error('[RubricSummaryModel] getBySessionIds error', err); 
          return reject(err); 
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Delete summary for a session
   */
  static deleteBySession(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM session_rubric_summary WHERE session_id = ?`;
      
      db.run(sql, [sessionId], function(err) {
        if (err) { 
          logger.error('[RubricSummaryModel] deleteBySession error', err); 
          return reject(err); 
        }
        resolve({ changes: this.changes });
      });
    });
  }

  /**
   * Bulk upsert summaries for multiple sessions
   */
  static bulkUpsert(summaries) {
    return new Promise((resolve, reject) => {
      if (!summaries || summaries.length === 0) {
        return resolve({ changes: 0 });
      }

      let completed = 0;
      let errors = [];
      const results = [];
      
      summaries.forEach((summary) => {
        const sql = `INSERT INTO session_rubric_summary 
          (session_id, weighted_score_pct, gate_status, overall_rating, confidence_level) 
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
          weighted_score_pct=VALUES(weighted_score_pct), 
          gate_status=VALUES(gate_status), 
          overall_rating=VALUES(overall_rating), 
          confidence_level=VALUES(confidence_level)`;
        
        const params = [
          summary.session_id,
          summary.weighted_score_pct || 0.00,
          summary.gate_status || 'all_passed',
          summary.overall_rating || 'Developing',
          summary.confidence_level || 'Medium — transcript-based; video/audio not available'
        ];
        
        db.run(sql, params, function(err) {
          if (err) {
            errors.push({ session_id: summary.session_id, error: err });
          } else {
            results.push({ id: this.lastID, changes: this.changes });
          }
          
          completed++;
          if (completed === summaries.length) {
            if (errors.length > 0) {
              logger.error('[RubricSummaryModel] bulkUpsert completed with errors', errors);
            }
            resolve({ results, errors, total: summaries.length });
          }
        });
      });
    });
  }

  /**
   * Get all summaries with gate_failed status
   */
  static getFailedGateSessions() {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM session_rubric_summary 
                   WHERE gate_status = 'gate_failed'
                   ORDER BY created_at DESC`;
      
      db.all(sql, [], (err, rows) => {
        if (err) { 
          logger.error('[RubricSummaryModel] getFailedGateSessions error', err); 
          return reject(err); 
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get summary statistics across all sessions
   */
  static getOverallStats() {
    return new Promise((resolve, reject) => {
      const sql = `SELECT 
        COUNT(*) as total_sessions,
        AVG(weighted_score_pct) as avg_score,
        SUM(CASE WHEN gate_status = 'all_passed' THEN 1 ELSE 0 END) as passed_gates,
        SUM(CASE WHEN gate_status = 'gate_failed' THEN 1 ELSE 0 END) as failed_gates,
        SUM(CASE WHEN overall_rating = 'Developing' THEN 1 ELSE 0 END) as developing_count,
        SUM(CASE WHEN overall_rating = 'Proficient' THEN 1 ELSE 0 END) as proficient_count,
        SUM(CASE WHEN overall_rating = 'Exemplary' THEN 1 ELSE 0 END) as exemplary_count
      FROM session_rubric_summary`;
      
      db.get(sql, [], (err, row) => {
        if (err) { 
          logger.error('[RubricSummaryModel] getOverallStats error', err); 
          return reject(err); 
        }
        resolve(row || null);
      });
    });
  }
}

module.exports = RubricSummaryModel;