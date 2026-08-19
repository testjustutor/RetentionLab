/**
 * models/super_admin/settings/VideoProcessingModel.js
 * Reuses the existing db helper and lightweight processing tracking table.
 */
const { db } = require('../../../database/db');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
// Directly reuse the existing audio-processing pipeline used by test-engine.js
// (bypasses the CLI lock file at .test-engine.lock).
const PythonBridge = require('../../../services/shared/pythonBridge');

const ROOT_DIR = path.resolve(__dirname, '../../..');
const RECORDINGS_DIR = path.join(ROOT_DIR, 'storage', 'screen-recordings');
const CONVERTED_DIR = path.join(ROOT_DIR, 'storage', 'recordings');

// Accept only plain .mp4 filenames. Reject path separators, traversal (..),
// and any chars that could escape the recordings directory.
const SAFE_NAME_RE = /^[A-Za-z0-9_.-]+\.mp4$/i;
const MP4_EXT = '.mp4';

class VideoProcessingModel {
  /**
   * Sanitize + validate a client-supplied video filename.
   * Returns the safe basename, or null when the input is invalid/dangerous.
   * Never lets the client inject a filesystem path.
   */
  static sanitizeVideoName(rawName) {
    if (!rawName || typeof rawName !== 'string') return null;
    const base = path.basename(rawName);
    if (base !== rawName) return null; // must be a bare filename, no separators
    if (!SAFE_NAME_RE.test(base)) return null;
    return base;
  }

  static ensureTable() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS video_processing (
          id INT AUTO_INCREMENT PRIMARY KEY,
          file_name VARCHAR(255) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          mp3_path VARCHAR(500) NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_video_processing_file_name (file_name),
          INDEX idx_video_processing_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;
      db.run(sql, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  static formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
    const totalSeconds = Math.round(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  }

  static getVideoFiles() {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(RECORDINGS_DIR)) {
        return resolve([]);
      }
      fs.readdir(RECORDINGS_DIR, (err, files) => {
        if (err) return reject(err);
        const mp4Files = (files || []).filter((file) => file.toLowerCase().endsWith('.mp4')).sort();
        resolve(mp4Files);
      });
    });
  }

  static getFileMeta(fileName) {
    return new Promise((resolve) => {
      const filePath = path.join(RECORDINGS_DIR, fileName);
      if (!fs.existsSync(filePath)) {
        return resolve({ size: '0.00', duration: '0:00', exists: false });
      }

      const stat = fs.statSync(filePath);
      const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);

      exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, (error, stdout) => {
        if (error) {
          return resolve({ size: sizeMB, duration: '0:00', exists: true });
        }

        const duration = Number.parseFloat(stdout.trim());
        resolve({
          size: sizeMB,
          duration: VideoProcessingModel.formatDuration(duration),
          exists: true
        });
      });
    });
  }

  static toMp3Name(fileName) {
    const base = path.basename(fileName).replace(/\.mp4$/i, '');

    // Named video type: <instructorId>_<First>_<Last>_<extId>_<sessionId>_<Title>_<YYYY_MM_DD>_<hash>
    // -> REC_<extId>_Sess<sessionId>_<YYYY_MM_DD>_<HH-MM>.mp3
    const parsed = this.parseNamedVideoName(fileName);
    if (parsed) {
      // Use scheduled start time (09:00 IST) as the time segment, HH-MM format.
      const { start } = this.scheduleTimes(parsed); // YYYY-MM-DD HH:MM:SS (local)
      const [ymd, hms] = start.split(' ');
      const [Y, M, D] = ymd.split('-');
      const HM = hms.substring(0, 5); // HH:MM -> HH-MM
      return `REC_${parsed.externalMeetingId}_Sess${parsed.sessionId}_${Y}_${M}_${D}_${HM.replace(':', '-')}.mp3`;
    }

    // Legacy SCREEN_ type: SCREEN_<id>... -> REC_<id>... (keep the rest of the name)
    const stem = base.replace(/^SCREEN_/i, 'REC_');
    return `${stem}.mp3`;
  }

  static mp3Exists(fileName) {
    const mp3Path = path.join(CONVERTED_DIR, this.toMp3Name(fileName));
    return fs.existsSync(mp3Path);
  }

  static async getLatestStatus(fileName) {
    const rows = await new Promise((resolve, reject) => {
      db.all('SELECT status FROM video_processing WHERE file_name = ? ORDER BY created_at DESC LIMIT 1', [fileName], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });

    return rows[0]?.status || null;
  }

  static async getAllVideos() {
    await this.ensureTable();
    const fileNames = await this.getVideoFiles();
    const videos = [];

    for (const fileName of fileNames) {
      const meta = await this.getFileMeta(fileName);
      const mp3Asked = this.mp3Exists(fileName);
      const lastStatus = await this.getLatestStatus(fileName);
      const status = lastStatus || (mp3Asked ? 'Converted' : 'Pending');

      videos.push({
        fileName,
        size: meta.size,
        duration: meta.duration,
        mp3Exists: mp3Asked,
        processingStatus: status,
        canConvert: !mp3Asked,
        canProcess: mp3Asked
      });
    }

    return videos;
  }

  static async convertToAudio(rawName) {
    const fileName = this.sanitizeVideoName(rawName);
    if (!fileName) {
      return { success: false, error: 'Invalid or unsafe video filename.' };
    }

    await this.ensureTable();
    const sourcePath = path.join(RECORDINGS_DIR, fileName);
    const targetName = this.toMp3Name(fileName);
    const targetPath = path.join(CONVERTED_DIR, targetName);

    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: 'Video file not found in storage/screen-recordings.' };
    }

    if (!fs.existsSync(CONVERTED_DIR)) {
      fs.mkdirSync(CONVERTED_DIR, { recursive: true });
    }

    if (fs.existsSync(targetPath)) {
      await this.saveProcessingRecord(fileName, 'converted', targetPath);
      // For named videos, sync meeting_sessions + meeting_assets with the produced paths.
      await this.syncNamedVideoAssets(targetName, fileName).catch(() => {});
      return { success: true, alreadyExists: true, mp3Path: targetPath };
    }

    await this.saveProcessingRecord(fileName, 'converting', targetPath);

    return new Promise((resolve) => {
      exec(`ffmpeg -y -i "${sourcePath}" -vn -ar 44100 -ac 2 -b:a 192k "${targetPath}"`, { cwd: ROOT_DIR }, (error) => {
        if (error) {
          this.saveProcessingRecord(fileName, 'failed', null).catch(() => {});
          return resolve({ success: false, error: error.message });
        }

        if (fs.existsSync(targetPath)) {
          this.saveProcessingRecord(fileName, 'converted', targetPath).catch(() => {});
          // For named videos, sync meeting_sessions + meeting_assets with the produced paths.
          this.syncNamedVideoAssets(targetName, fileName).catch(() => {});
          return resolve({ success: true, alreadyExists: false, mp3Path: targetPath });
        }

        this.saveProcessingRecord(fileName, 'failed', null).catch(() => {});
        resolve({ success: false, error: 'FFmpeg conversion did not create the MP3 file.' });
      });
    });
  }

  static async processAudio(rawName) {
    const fileName = this.sanitizeVideoName(rawName);
    if (!fileName) {
      return { success: false, error: 'Invalid or unsafe video filename.' };
    }

    await this.ensureTable();
    const mp3Name = this.toMp3Name(fileName);
    const mp3Path = path.join(CONVERTED_DIR, mp3Name);

    if (!fs.existsSync(mp3Path)) {
      return { success: false, error: 'MP3 file is missing. Convert the video to audio before processing.' };
    }

    await this.saveProcessingRecord(fileName, 'processing', mp3Path);

    // Directly invoke the existing pipeline used by test-engine.js (PythonBridge),
    // passing ONLY the mp3 file name. runFullAudioPipeline signature is
    // (meetingId, sessionId, fileName) — the fileName MUST be the 3rd argument,
    // otherwise the engine reads `undefined` and cannot find the recording.
    try {
      let meetingId = null;
      let sessionId = null;

      // For named videos, resolve the seeded meeting/session so the pipeline's
      // asset DB-sync step can run (best-effort; non-fatal if not found).
      const parsed = this.parseNamedVideoName(fileName);
      if (parsed) {
        const meeting = await this.getMeetingForNamedVideo(parsed);
        if (meeting) {
          meetingId = meeting.id;
          sessionId = parsed.sessionId;
        }
      }

      const result = await PythonBridge.runFullAudioPipeline(meetingId, sessionId, mp3Name);
      // Treat a thrown error or a falsy/errored result as a failure.
      if (result && result.success === false) {
        this.saveProcessingRecord(fileName, 'failed', mp3Path).catch(() => {});
        return { success: false, error: result.error || 'Audio processing returned an error.' };
      }
      await this.saveProcessingRecord(fileName, 'processed', mp3Path);
      return { success: true, alreadyExists: true, mp3Path };
    } catch (err) {
      console.error('[VideoProcessingModel] processAudio pipeline error:', err.message || err);
      await this.saveProcessingRecord(fileName, 'failed', mp3Path).catch(() => {});
      return { success: false, error: 'Audio processing failed: ' + (err.message || 'unknown error') };
    }
  }

  /** Look up the meeting id for a parsed named video (from the seeded meeting row). */
  static async getMeetingForNamedVideo(parsed) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM meetings WHERE external_meeting_id = ? AND title = ? ORDER BY id DESC LIMIT 1',
        [parsed.externalMeetingId, parsed.title],
        (err, row) => err ? reject(err) : resolve(row || null)
      );
    });
  }

  static saveProcessingRecord(fileName, status, mp3Path = null) {
    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO video_processing (file_name, status, mp3_path, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)';
      db.run(sql, [fileName, status, mp3Path], function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  static getProcessingHistory() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM video_processing ORDER BY created_at DESC', (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  /**
   * Parse a "named" video filename of the form:
   *   <instructorId>_<FirstName>_<LastName>_<externalMeetingId>_<sessionId>_<Title>_<YYYY_MM_DD>_<hash>.mp4
   * e.g. 1012_Shivani_Arora_Regular_248879_General_Discussion_2026_08_17_08715cb3.mp4
   *   instructorId=1012 · firstName=Shivani · lastName=Arora · externalMeetingId=Regular
   *   sessionId=248879 · title=General_Discussion · date=2026-08-17
   * Returns a normalized object, or null if unparseable.
   */
  static parseNamedVideoName(fileName) {
    const base = path.basename(fileName).replace(/\.mp4$/i, '');
    const parts = base.split('_');
    if (parts.length < 7) return null;

    const hash = parts[parts.length - 1];          // 08715cb3
    const dayPart = parts[parts.length - 2];       // 17
    const monthPart = parts[parts.length - 3];     // 08
    const yearPart = parts[parts.length - 4];      // 2026
    const instructorId = parts[0];                 // 1012
    const firstName = parts[1];                    // Shivani
    const lastName = parts[2];                     // Arora
    const externalMeetingId = parts[3];            // Regular
    const sessionId = parts[4];                    // 248879
    const title = parts.slice(5, parts.length - 4).join(' '); // General Discussion

    if (!/^\d+$/.test(instructorId) || !/^\d+$/.test(sessionId)) return null;
    if (!/^\d{4}$/.test(yearPart) || !/^\d{2}$/.test(monthPart) || !/^\d{2}$/.test(dayPart)) return null;

    const y = Number(yearPart), m = Number(monthPart), d = Number(dayPart);
    if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;

    const dateStr = `${yearPart}-${monthPart}-${dayPart}`; // YYYY-MM-DD

    return {
      instructorId: Number(instructorId),
      firstName,
      lastName,
      externalMeetingId,
      sessionId: Number(sessionId),
      title: title || externalMeetingId,
      dateStr,
      hash
    };
  }

  /** Build scheduled start/end (start 09:00, end +1 hour) in the meeting's timezone (IST). */
  static scheduleTimes(parsed) {
    // dateStr is already YYYY-MM-DD. Use wall-clock 09:00 (no UTC conversion) so the
    // stored scheduled_start_time matches the meeting's 'Asia/Kolkata' timezone.
    const start = `${parsed.dateStr} 09:00:00`;
    // end = start + 1 hour
    const end = `${parsed.dateStr} 10:00:00`;
    return { start, end };
  }

  /** Seed a "named" video file into users + calendar_connections + meetings + meeting_sessions. */
  static async seedNamedVideo(fileName) {
    const parsed = this.parseNamedVideoName(fileName);
    if (!parsed) {
      return { success: false, error: 'Invalid named video filename format.' };
    }

    const { instructorId, firstName, lastName, externalMeetingId, sessionId, title } = parsed;
    const { start, end } = this.scheduleTimes(parsed);

    try {
      // 1. Instructor user (upsert by id; create if missing).
      let user = await new Promise((resolve, reject) => {
        db.get('SELECT id, company_id, role_id FROM users WHERE id = ?', [instructorId], (err, row) => err ? reject(err) : resolve(row || null));
      });

      if (!user) {
        // Users may already exist by name — find by email first to avoid duplicates.
        const email = this.instructorEmail(firstName, lastName, instructorId);
        user = await new Promise((resolve, reject) => {
          db.get('SELECT id, company_id, role_id FROM users WHERE email = ? LIMIT 1', [email], (err, row) => err ? reject(err) : resolve(row || null));
        });
      }

      if (!user) {
        const roleId = await new Promise((resolve, reject) => {
          db.get('SELECT id FROM roles WHERE role_name = \'instructor\' LIMIT 1', (err, row) => err ? reject(err) : resolve(row ? row.id : null));
        });
        if (!roleId) return { success: false, error: 'Instructor role not found in roles table.' };

        const newId = await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO users (user_uuid, role_id, first_name, last_name, email, password_hash, phone, status, is_active, email_verified, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [require('crypto').randomUUID(), roleId, firstName, lastName,
             this.instructorEmail(firstName, lastName, instructorId),
             this.hashPassword('password123'), this.instructorPhone(instructorId)],
            function (err) { err ? reject(err) : resolve(this.lastID); }
          );
        });
        user = { id: newId, company_id: null, role_id: roleId };
      }

      // 2. Dummy teams calendar integration (calendar_connections).
      const teamsProvider = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM calendar_providers WHERE name = \'teams\' LIMIT 1', (err, row) => err ? reject(err) : resolve(row || null));
      });
      if (teamsProvider) {
        const existingConn = await new Promise((resolve, reject) => {
          db.get('SELECT id FROM calendar_connections WHERE user_id = ? AND provider_id = ? LIMIT 1', [user.id, teamsProvider.id], (err, row) => err ? reject(err) : resolve(row || null));
        });
        if (!existingConn) {
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO calendar_connections (user_id, provider_id, access_token, refresh_token, token_expires_at, connection_status, created_at, updated_at)
               VALUES (?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY), 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
              [user.id, teamsProvider.id,
               'dummy_acc_' + Math.random().toString(36).substring(2, 20),
               'dummy_ref_' + Math.random().toString(36).substring(2, 20)],
              function (err) { err ? reject(err) : resolve(); }
            );
          });
        }
      }

      // 3. Meeting row (reuse meetings table).
      let meeting = await new Promise((resolve, reject) => {
        db.get('SELECT id, external_meeting_id FROM meetings WHERE external_meeting_id = ? AND title = ? AND created_by = ? LIMIT 1', [externalMeetingId, title, user.id], (err, row) => err ? reject(err) : resolve(row || null));
      });

      if (!meeting) {
        const insertId = await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO meetings (external_meeting_id, title, description, scheduled_start_time, scheduled_end_time, platform, calendar_account, meeting_link, passcode, event_id, timezone, status, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sync', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [externalMeetingId, title, this.meetingDescription(parsed),
             start, end, 'teams', user.email,
             this.teamsLink(parsed), null,
             this.randomEventId(), 'Asia/Kolkata', user.id],
            function (err) { err ? reject(err) : resolve(this.lastID); }
          );
        });
        meeting = { id: insertId };
      }

      // 4. Meeting session row (meeting_sessions) with the given session id.
      const sessionRes = await new Promise((resolve, reject) => {
        db.run(
          `INSERT IGNORE INTO meeting_sessions (id, meeting_id, start_time, end_time, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [sessionId, meeting.id, start, end],
          function (err) { err ? reject(err) : resolve({ inserted: this.affectedRows }); }
        );
      });

      return { success: true, data: {
        instructorId: user.id, sessionId, meetingId: meeting.id,
        externalMeetingId, title, scheduledStart: start, scheduledEnd: end,
        platform: 'teams', timezone: 'Asia/Kolkata', sessionInserted: sessionRes.inserted > 0
      } };

    } catch (err) {
      console.error('[VideoProcessingModel] seedNamedVideo error:', err);
      return { success: false, error: 'Database seeding failed: ' + err.message };
    }
  }

  static instructorEmail(firstName, lastName, instructorId) {
    const f = (firstName || 'instructor').toLowerCase().replace(/[^a-z0-9]/g, '');
    const l = (lastName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${f}.${l}.${instructorId}@example.com`;
  }

  static instructorPhone(instructorId) {
    return `+91${String(instructorId).padStart(10, '0').slice(-10)}`;
  }

  static meetingDescription(parsed) {
    return `${parsed.title} session recorded on ${parsed.dateStr.replace(/_/g, '-')} (dummy seed).`;
  }

  static teamsLink(parsed) {
    // dateStr is YYYY-MM-DD -> compact as YYYYMMDD for the teams join link.
    return `https://teams.microsoft.com/l/meetup-join/${parsed.dateStr.replace(/[^0-9]/g, '')}%40thread.v2`;
  }

  static randomEventId() {
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 12);
  }

  static hashPassword(password) {
    const crypto = require('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const secretKey = process.env.PASSWORD_SECRET_KEY || '';
    const derived = crypto.scryptSync(secretKey + password, salt, 64).toString('hex');
    return `${salt}:${derived}`;
  }
  /**
   * After converting a named video to audio, sync the produced asset paths into
   * meeting_sessions (audio_file_name + transcript_file_name) and meeting_assets
   * (audio_path, transcript_path, video_path). Uses the transcript name derived
   * from the mp3 name (REC_ -> TRANS_, .mp3 -> .txt).
   */
  static async syncNamedVideoAssets(mp3Name, rawVideoName) {
    const parsed = this.parseNamedVideoName(rawVideoName);
    if (!parsed) return { synced: false, reason: 'not-a-named-video' };

    // Derive the transcript filename: REC_... -> TRANS_..., .mp3 -> .txt
    const transcriptName = mp3Name.replace(/^REC_/i, 'TRANS_').replace(/\.mp3$/i, '.txt');
    // Video path stored in meeting_assets.
    const videoPath = path.join(RECORDINGS_DIR, rawVideoName);

    // Resolve the seeded meeting id + session id.
    const meeting = await this.getMeetingForNamedVideo(parsed);
    if (!meeting) return { synced: false, reason: 'meeting-not-found' };
    const sessionId = parsed.sessionId;
    const meetingId = meeting.id;

    // 1. Update meeting_sessions.audio_file_name + transcript_file_name.
    await new Promise((resolve, reject) => {
      const sql = `UPDATE meeting_sessions
                   SET audio_file_name = ?,
                       transcript_file_name = ?,
                       updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?`;
      db.run(sql, [mp3Name, transcriptName, sessionId], function (err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });

    // 2. Upsert meeting_assets with audio_path, transcript_path, video_path.
    await new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO meeting_assets (
            meeting_id, session_id, audio_path, transcript_path, video_path, status, processed_at
        ) VALUES (?, ?, ?, ?, ?, 'Conversion', CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
            audio_path = VALUES(audio_path),
            transcript_path = VALUES(transcript_path),
            video_path = VALUES(video_path),
            status = 'Conversion',
            processed_at = CURRENT_TIMESTAMP
      `;
      db.run(sql, [String(meetingId), String(sessionId), mp3Name, transcriptName, videoPath], function (err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });

    return {
      synced: true,
      sessionId,
      meetingId,
      audioFileName: mp3Name,
      transcriptFileName: transcriptName,
      videoPath
    };
  }


}

module.exports = VideoProcessingModel;