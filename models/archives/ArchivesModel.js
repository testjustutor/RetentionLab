/**
 * root/models/ArchivesModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

/**
 * ArchivesModel
 * Returns data for public/super_admin/storage/archives.html + public/js/super_admin/storage/archives.js
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
    search = '',
    instructorId = null,
    page = 1,
    pageSize = 20
  } = {}) {

    const result = await ArchivesModel.getMeetingHistory({
      limit,
      from,
      to,
      search,
      instructorId,
      page,
      pageSize
    });

    const hydrated = [];
    const meetings = result.meetings || [];

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
        createdBy: m.created_by || null,
        instructorName: m.instructor_name || 'Unknown Instructor',
        audioUrl: ArchivesModel.toPublicUrl(session?.audio_file_name, 'audio'),
        transcripts: session?.transcript_file_name
          ? ArchivesModel.toPublicUrl(session.transcript_file_name, 'transcript')
          : ''
      });
    }

    return {
      meetings: hydrated,
      total: result.total || 0,
      page: result.page || 1,
      pageSize: result.pageSize || 20,
      totalPages: result.totalPages || 0
    };
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
    search = '',
    instructorId = null,
    page = 1,
    pageSize = 20
  } = {}) {
    return new Promise((resolve, reject) => {
      const pageSizeNum = Math.max(1, Math.min(100, Number(pageSize) || 20));
      const pageNum = Math.max(1, Number(page) || 1);
      const offset = (pageNum - 1) * pageSizeNum;

      let countQuery = `
        SELECT COUNT(*) as total
        FROM meetings m
        WHERE m.status NOT IN ('queued', 'scheduled')
      `;

      let dataQuery = `
        SELECT m.*, u.first_name, u.last_name, u.email
        FROM meetings m
        LEFT JOIN users u ON m.created_by = u.id
        WHERE m.status NOT IN ('queued', 'scheduled')
      `;

      const params = [];
      const countParams = [];

      // date filter
      if (from) {
        const dateStr = from.toISOString().slice(0, 10);
        dataQuery += ' AND date(m.scheduled_start_time) >= date(?)';
        countQuery += ' AND date(m.scheduled_start_time) >= date(?)';
        params.push(dateStr);
        countParams.push(dateStr);
      }

      if (to) {
        const dateStr = to.toISOString().slice(0, 10);
        dataQuery += ' AND date(m.scheduled_end_time) <= date(?)';
        countQuery += ' AND date(m.scheduled_end_time) <= date(?)';
        params.push(dateStr);
        countParams.push(dateStr);
      }

      // instructor filter
      if (instructorId) {
        dataQuery += ' AND m.created_by = ?';
        countQuery += ' AND m.created_by = ?';
        params.push(instructorId);
        countParams.push(instructorId);
      }

      // search filter
      const s = (search || '').trim();
      if (s) {
        dataQuery += ' AND (m.meeting_id LIKE ? OR m.title LIKE ?)';
        countQuery += ' AND (m.meeting_id LIKE ? OR m.title LIKE ?)';
        params.push(`%${s}%`, `%${s}%`);
        countParams.push(`%${s}%`, `%${s}%`);
      }

      // Get total count first
      db.get(countQuery, countParams, (err, countRow) => {
        if (err) {
          logger.error('Model(ArchivesModel): Error counting meetings:', err);
          return reject(err);
        }

        const total = countRow?.total || 0;
        const totalPages = Math.ceil(total / pageSizeNum);

        // Add ordering and pagination
        dataQuery += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
        params.push(pageSizeNum, offset);

        db.all(dataQuery, params, (err, rows) => {
          if (err) {
            logger.error('Model(ArchivesModel): Error fetching meeting history:', err);
            return reject(err);
          }

          const meetings = (rows || []).map(row => ({
            ...row,
            instructor_name: row.first_name && row.last_name
              ? `${row.first_name} ${row.last_name}`
              : (row.first_name || row.email || 'Unknown Instructor')
          }));

          resolve({
            meetings,
            total,
            page: pageNum,
            pageSize: pageSizeNum,
            totalPages
          });
        });
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

  /**
   * Get all instructors (users with instructor or solo_instructor role)
   */
  static async getInstructors() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT DISTINCT u.id, u.first_name, u.last_name, u.email
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE r.role_name IN ('instructor', 'solo_instructor')
        ORDER BY u.first_name, u.last_name
      `;

      db.all(query, (err, rows) => {
        if (err) {
          logger.error('Model(ArchivesModel): Error fetching instructors:', err);
          return reject(err);
        }

        const instructors = (rows || []).map(row => ({
          id: row.id,
          name: row.first_name && row.last_name
            ? `${row.first_name} ${row.last_name}`
            : (row.first_name || row.email || 'Unknown'),
          email: row.email
        }));

        resolve(instructors);
      });
    });
  }
}

module.exports = ArchivesModel;