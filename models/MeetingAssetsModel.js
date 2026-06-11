/**
 * root/models/MeetingAssetsModel.js
 */
const { db } = require('../database/db'); 
const { logger } = require('../utils/logger');

class MeetingAssetsModel {

  /**
   * Step 0: Initialize a record with placeholders.
   */
  static initializeAssets(meetingId, audioPath, wav_audio_path) {

    return new Promise((resolve, reject) => {

      const sql = `
        INSERT INTO meeting_assets (
            meeting_id,
            audio_path,
            wav_audio_path,
            status,
            processed_at
        )
        VALUES (?, ?, ?, 'Conversion', CURRENT_TIMESTAMP)

        ON CONFLICT(meeting_id) DO UPDATE SET
            wav_audio_path = excluded.wav_audio_path,
            status = 'Conversion',
            processed_at = CURRENT_TIMESTAMP
      `;

      db.run(
        sql,
        [
          meetingId,
          audioPath,
          wav_audio_path
        ],
        function(err) {

          if (err) {

            logger.error(
              `[MeetingAssetsModel] Init Error: ${err.message}`
            );

            reject(err);

          } else {

            logger.info(
              `[MeetingAssetsModel] Step 1 Started: Conversion for ${meetingId}`
            );

            resolve({
              meetingId,
              status: 'Conversion'
            });
          }
        }
      );
    });
  }

  /**
   * Saves or updates the storage locations for a specific meeting.
   * Updated to include the 'status' column.
   */
  static saveAssets(meetingId, data) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO meeting_assets (
            meeting_id, audio_path, transcript_path, audit_json_path, 
            wav_audio_path, whisper_path, captions_raw_path, diarization_path, 
            embeddings_path, llm_prompts_path, action_items_path, 
            sentiment_analysis_path, talk_ratio_json_path, user_silence_duration_path, 
            questions_asked_count_path, topic_clusters_path, summary_path, 
            oqi_score, evidence_quote, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(meeting_id) DO UPDATE SET
            audio_path = excluded.audio_path,
            transcript_path = excluded.transcript_path,
            audit_json_path = excluded.audit_json_path,
            wav_audio_path = excluded.wav_audio_path,
            whisper_path = excluded.whisper_path,
            captions_raw_path = excluded.captions_raw_path,
            diarization_path = excluded.diarization_path,
            embeddings_path = excluded.embeddings_path,
            llm_prompts_path = excluded.llm_prompts_path,
            action_items_path = excluded.action_items_path,
            sentiment_analysis_path = excluded.sentiment_analysis_path,
            talk_ratio_json_path = excluded.talk_ratio_json_path,
            user_silence_duration_path = excluded.user_silence_duration_path,
            questions_asked_count_path = excluded.questions_asked_count_path,
            topic_clusters_path = excluded.topic_clusters_path,
            summary_path = excluded.summary_path,
            oqi_score = excluded.oqi_score,
            evidence_quote = excluded.evidence_quote,
            status = excluded.status,
            processed_at = CURRENT_TIMESTAMP
      `;

      const params = [
        meetingId,
        data.audio_path || null,
        data.transcript_path || null,
        data.audit_json_path || null,
        data.wav_audio_path || null,
        data.whisper_path || null,
        data.captions_raw_path || null,
        data.diarization_path || null,
        data.embeddings_path || null,
        data.llm_prompts_path || null,
        data.action_items_path || null,
        data.sentiment_analysis_path || null,
        data.talk_ratio_json_path || null,
        data.user_silence_duration_path || null,
        data.questions_asked_count_path || null,
        data.topic_clusters_path || null,
        data.summary_path || null,
        data.oqi_score || null,
        data.evidence_quote || null,
        data.status || 'Processing' // Default to Processing if not provided
      ];

      db.run(sql, params, function(err) {
        if (err) {
          logger.error(`[MeetingAssetsModel] Save Error: ${err.message}`);
          reject(err);
        } else {
          logger.info(`[MeetingAssetsModel] Assets stored for: ${meetingId} (Status: ${data.status})`);
          resolve({ meetingId, status: 'stored' });
        }
      });
    });
  }

  /**
   * Updates specific fields for an existing meeting record.
   * Added 'status' to validColumns.
   */
  static updateAssets(meetingId, data) {
    return new Promise((resolve, reject) => {
      const validColumns = [
        'audio_path', 'transcript_path', 'audit_json_path', 'wav_audio_path',
        'whisper_path', 'captions_raw_path', 'diarization_path', 'embeddings_path',
        'llm_prompts_path', 'action_items_path', 'sentiment_analysis_path',
        'talk_ratio_json_path', 'user_silence_duration_path', 'questions_asked_count_path',
        'topic_clusters_path', 'summary_path', 'oqi_score', 'evidence_quote', 'status'
      ];

      const keys = Object.keys(data).filter(key => validColumns.includes(key));

      if (keys.length === 0) {
        return reject(new Error("No valid fields provided for update"));
      }

      const setClause = keys.map(key => `${key} = ?`).join(', ');
      const params = keys.map(key => data[key]);
      params.push(meetingId);

      const sql = `
        UPDATE meeting_assets 
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

  static getAssets(meetingId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM meeting_assets WHERE meeting_id = ?`;
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