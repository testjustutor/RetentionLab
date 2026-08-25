/**
 * models/super_admin/settings/DeepgramProcessingModel.js
 *
 * Data-access ONLY for the SEPARATE Deepgram processing pipeline
 * (services/python_deepgram). Runs fully in parallel with
 * VideoProcessingModel - different table, no shared state.
 */
const { db } = require('../../../database/db');

const TABLE = 'deepgram_processing';

const DeepgramProcessingModel = {
  async ensureTable() {
    await new Promise((resolve, reject) => {
      db.run(`CREATE TABLE IF NOT EXISTS ${TABLE} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        file_name VARCHAR(255) DEFAULT NULL,
        mp3_name VARCHAR(255) DEFAULT NULL,
        mp3_path VARCHAR(500) DEFAULT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        duration_sec DECIMAL(10,2) DEFAULT NULL,
        speakers INT DEFAULT NULL,
        tutor_label VARCHAR(50) DEFAULT NULL,
        student_label VARCHAR(50) DEFAULT NULL,
        turns INT DEFAULT NULL,
        transcript_json VARCHAR(500) DEFAULT NULL,
        transcript_txt VARCHAR(500) DEFAULT NULL,
        error TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_dgp_file (file_name),
        INDEX idx_dgp_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`, (err) => (err ? reject(err) : resolve()));
    });
  },

  async saveRecord(rec) {
    await this.ensureTable();
    return new Promise((resolve, reject) => {
      db.run(`INSERT INTO ${TABLE}
        (file_name, mp3_name, mp3_path, status, duration_sec, speakers, tutor_label, student_label, turns, transcript_json, transcript_txt, error)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [rec.fileName || null, rec.mp3Name || null, rec.mp3Path || null, rec.status || 'pending',
         rec.durationSec ?? null, rec.speakers ?? null, rec.tutorLabel || null, rec.studentLabel || null,
         rec.turns ?? null, rec.transcriptJson || null, rec.transcriptTxt || null, rec.error || null],
        function (err) { err ? reject(err) : resolve(this.lastID); });
    });
  },

  async getLatestByFile(fileName) {
    await this.ensureTable();
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM ${TABLE} WHERE file_name = ? ORDER BY id DESC LIMIT 1`, [fileName],
        (err, row) => err ? reject(err) : resolve(row || null));
    });
  },

  async getHistory(limit = 100) {
    await this.ensureTable();
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM ${TABLE} ORDER BY id DESC LIMIT ?`, [Number(limit)],
        (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  },

  async markStatus(fileName, status, extra = {}) {
    await this.ensureTable();
    const sets = ['status = ?'];
    const params = [status];
    for (const k of ['durationSec', 'speakers', 'turns', 'tutorLabel', 'studentLabel', 'transcriptJson', 'transcriptTxt', 'error', 'mp3Path', 'mp3Name']) {
      if (extra[k] !== undefined) {
        const col = k.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
        sets.push(`${col} = ?`);
        params.push(extra[k]);
      }
    }
    params.push(fileName);
    return new Promise((resolve, reject) => {
      db.run(`UPDATE ${TABLE} SET ${sets.join(', ')} WHERE id = (SELECT id FROM (SELECT id FROM ${TABLE} WHERE file_name = ? ORDER BY id DESC LIMIT 1) t)`, params,
        (err) => err ? reject(err) : resolve());
    });
  }
};

module.exports = DeepgramProcessingModel;
