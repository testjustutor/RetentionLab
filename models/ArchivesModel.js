/**
 * root/models/ArchivesModel.js
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

/**
 * ArchivesModel
 * Returns data for public/archives.html + public/js/archives.js
 */
class ArchivesModel {
  /**
   * Get completed meetings with transcripts and audio file (if available)
   *
   * Frontend shape:
   * {
   *   meetings: [
   *     {
   *       id, title, date, platform, meetingId, audioUrl,
   *       transcripts: [ { speaker, time, text, color, isSystem? } ]
   *     }
   *   ]
   * }
   */
  static async getCompletedMeetingsWithTranscripts({
    limit = 50,
    from = null,
    to = null,
    search = ''
  } = {}) {

    const meetings = await ArchivesModel.getMeetingHistory({
      limit,
      from,
      to,
      search
    });

    const hydrated = [];

    for (const m of meetings) {

      const mMeetingId = m.meeting_id;

      if (!mMeetingId) continue;

      const session = await ArchivesModel.getSessionByMeetingId(mMeetingId);
      const transcripts = [];

      const start = m.start_time || m.startTime || m.created_at;
      const date = start ? new Date(start).toISOString() : new Date().toISOString();

      hydrated.push({
        id: `archive_${m.id ?? mMeetingId}`,
        title: m.title || m.meeting_title || 'Untitled Session',
        date,
        platform: m.platform || 'unknown',
        meetingId: mMeetingId,
        audioUrl: ArchivesModel.toPublicUrl(session?.audio_file_name, 'audio'),
        transcripts: session?.transcript_file_name
          ? ArchivesModel.toPublicUrl(session.transcript_file_name, 'transcript')
          : ''
      });
    }

    return { meetings: hydrated };
  }

  static toPublicUrl(filePath, type = 'file') {
    if (!filePath) return '';

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    let normalized = String(filePath).replace(/\\/g, '/');

    // already full URL
    if (normalized.startsWith('http')) return normalized;

    // if full disk path exists (audio case)
    const idx = normalized.indexOf('/storage/');
    if (idx !== -1) {
      return baseUrl + normalized.slice(idx);
    }

    // filename only (transcript case)
    const fileName = normalized.split('/').pop();

    if (type === 'audio') {
      return `${baseUrl}/storage/recordings/${fileName}`;
    }

    return `${baseUrl}/storage/transcripts/${fileName}`;
  }

  static #inferTranscriptColor(speaker) {
    const s = String(speaker || '').toLowerCase().trim();
    if (!s) return 'emerald';

    const hash = Array.from(s).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const colors = ['emerald', 'blue', 'indigo', 'orange', 'fuchsia'];
    return colors[hash % colors.length];
  }

  static formatQuery = (query, params) => {
    let i = 0;
    return query.replace(/\?/g, () => {
      const val = params[i++];
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'string') return `'${val}'`;
      return val;
    });
  };

  static getMeetingHistory({
    limit = 50,
    from = null,
    to = null,
    search = ''
  } = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT * FROM meetings
        WHERE status NOT IN ('queued')
      `;

      const params = [];

      // date filter uses created_at by default

      if (from) {
        query += ' AND date(start_time) >= date(?)';
        params.push(from.toISOString().slice(0, 10));
      }

      if (to) {
        query += ' AND date(end_time) <= date(?)';
        params.push(to.toISOString().slice(0, 10));
      }
      
      const s = (search || '').trim();

      if (s) {
        query += ' AND (meeting_id LIKE ? OR title LIKE ?)';
        params.push(`%${s}%`, `%${s}%`);
      }
      
      query += ' ORDER BY datetime(created_at) DESC LIMIT ?';
      params.push(limit);
      
      db.all(query, params, (err, rows) => {
        if (err) {
          logger.error('Model(ArchivesModel): Error fetching meeting history:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  static getSessionByMeetingId(meetingId) {
    return new Promise((resolve, reject) => {
      db.get(
        `
          SELECT s.id, s.meeting_id, s.transcript_file_name, s.audio_file_name, s.start_time, s.end_time
          FROM meeting_sessions s
          WHERE s.meeting_id = ?
          ORDER BY s.id DESC
          LIMIT 1
        `,
        [meetingId],
        (err, row) => {
          if (err) {
            logger.error('Model(ArchivesModel): Error fetching session by meeting ID:', err);
            return reject(err);
          }
          resolve(row || null);
        }
      );
    });
  }
}

module.exports = ArchivesModel;

