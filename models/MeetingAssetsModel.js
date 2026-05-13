const { db } = require('../database/db'); 
const { logger } = require('../utils/logger');

class MeetingAssetsModel {
  /**
   * Saves or updates the storage locations for a specific meeting
   */
  static saveAssets(meetingId, data) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO meeting_assets_storage (
            meeting_id, audio_path, transcript_path, audit_json_path, summary, oqi_score
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(meeting_id) DO UPDATE SET
            audio_path = excluded.audio_path,
            transcript_path = excluded.transcript_path,
            audit_json_path = excluded.audit_json_path,
            summary = excluded.summary,
            oqi_score = excluded.oqi_score,
            processed_at = CURRENT_TIMESTAMP
      `;

      const params = [
        meetingId,
        data.audio_path || null,
        data.transcript_path || null,
        data.audit_json_path || null,
        data.summary || null,
        data.oqi_score || null
      ];

      db.run(sql, params, function(err) {
        if (err) {
          logger.error(`[MeetingAssetsModel] Save Error: ${err.message}`);
          reject(err);
        } else {
          logger.info(`[MeetingAssetsModel] Assets stored for: ${meetingId}`);
          resolve({ meetingId, status: 'stored' });
        }
      });
    });
  }

  /**
   * Updates specific fields for an existing meeting record.
   * Useful for partial updates (e.g., just updating the summary later).
   */
  static updateAssets(meetingId, data) {
    return new Promise((resolve, reject) => {
      // Dynamically build the SET clause based on provided keys
      const keys = Object.keys(data).filter(key => 
        ['audio_path', 'transcript_path', 'audit_json_path', 'summary', 'oqi_score'].includes(key)
      );

      if (keys.length === 0) {
        return reject(new Error("No valid fields provided for update"));
      }

      const setClause = keys.map(key => `${key} = ?`).join(', ');
      const params = keys.map(key => data[key]);
      params.push(meetingId); // Add meetingId for the WHERE clause

      const sql = `
        UPDATE meeting_assets_storage 
        SET ${setClause}, processed_at = CURRENT_TIMESTAMP 
        WHERE meeting_id = ?
      `;

      db.run(sql, params, function(err) {
        if (err) {
          logger.error(`[MeetingAssetsModel] Update Error: ${err.message}`);
          reject(err);
        } else if (this.changes === 0) {
          logger.warn(`[MeetingAssetsModel] No record found to update for ID: ${meetingId}`);
          resolve({ meetingId, status: 'not_found' });
        } else {
          logger.info(`[MeetingAssetsModel] Assets updated for: ${meetingId}`);
          resolve({ meetingId, status: 'updated' });
        }
      });
    });
  }

  /**
   * Retrieves the file locations for a meeting
   */
  static getAssets(meetingId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM meeting_assets_storage WHERE meeting_id = ?`;
      db.get(sql, [meetingId], (err, row) => {
        if (err) {
          logger.error(`[MeetingAssetsModel] Retrieval Error: ${err.message}`);
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }
}

module.exports = MeetingAssetsModel;