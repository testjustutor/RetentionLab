/**
 * controllers/reviewerSessionsController.js
 * Business logic for reviewer sessions page.
 * Shows instructor dropdown and their sessions with details.
 */
const { db } = require('../../database/db');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /** GET /api/reviewer-sessions/instructors — List instructors with meetings assigned to this reviewer */
  async getInstructors(req) {
    try {
      const reviewerId = req.user.id;

      // Only return instructors that have meetings assigned to this reviewer
      let sql = `
        SELECT DISTINCT u.id, u.first_name, u.last_name, u.email,
               r.role_name
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        INNER JOIN meetings m ON LOWER(m.calendar_account) = LOWER(u.email)
        INNER JOIN meeting_reviewers mr ON mr.meeting_id = m.external_meeting_id AND mr.reviewer_id = ?
        WHERE u.deleted_at IS NULL
        AND u.is_active = 1
        AND r.role_name IN ('solo_instructor', 'instructor')
        ORDER BY u.first_name, u.last_name`;
      const params = [reviewerId];

      const rows = await new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
      });

      return ok({ instructors: rows });
    } catch (e) { return err(e.message); }
  },

  /** GET /api/reviewer-sessions/instructor-sessions — Get sessions for a specific instructor */
  async getInstructorSessions(req) {
    try {
      const reviewerId = req.user.id;
      const instructorId = req.query.instructor_id;
      const status = req.query.status || '';
      const search = req.query.search || '';

      if (!instructorId) return err('instructor_id is required', 400);

      let sql = `
        SELECT m.external_meeting_id as meeting_id,
               m.title as meeting_title,
               m.scheduled_start_time as start_time,
               m.scheduled_end_time as end_time,
               m.platform,
               m.meeting_link,
               m.status as meeting_status,
               m.calendar_account,
               m.summary as meeting_summary,
               ma.audio_path,
               ma.transcript_path,
               ma.summary_path,
               ma.diarization_path,
               ma.audit_json_path,
               ma.embeddings_path,
               ma.llm_prompts_path,
               ma.action_items_path,
               ma.sentiment_analysis_path,
               ma.talk_ratio_json_path,
               ma.questions_asked_count_path,
               ma.topic_clusters_path,
               ma.oqi_score,
               ma.evidence_quote,
               (SELECT COUNT(*) FROM meeting_scores ms WHERE ms.meeting_id = m.external_meeting_id) as score_count,
               (SELECT AVG(ms.score) FROM meeting_scores ms WHERE ms.meeting_id = m.external_meeting_id) as avg_score,
               (SELECT COUNT(*) FROM participant_sessions ps WHERE ps.meeting_id = m.external_meeting_id) as participant_count
        FROM meetings m
        INNER JOIN meeting_reviewers mr ON mr.meeting_id = m.external_meeting_id AND mr.reviewer_id = ?
        LEFT JOIN meeting_assets ma ON ma.meeting_id = m.external_meeting_id
        WHERE LOWER(m.calendar_account) = (SELECT LOWER(email) FROM users WHERE id = ?)`;
      const params = [reviewerId, instructorId];

      if (status) {
        if (status === 'all') {
          // no filter
        } else if (status === 'completed') {
          sql += ` AND m.status = 'completed'`;
        } else if (status === 'in_progress') {
          sql += ` AND m.status IN ('in_progress', 'active', 'joining')`;
        } else if (status === 'scheduled') {
          sql += ` AND m.status IN ('queued', 'launching', 'starting')`;
        }
      }

      if (search) {
        sql += ` AND (m.title LIKE ? OR m.platform LIKE ? OR m.calendar_account LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      sql += ` ORDER BY m.scheduled_start_time DESC LIMIT 100`;

      const rows = await new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
      });

      // Format the data - convert absolute path to web-relative URL
      function toUrl(p) {
        if (!p) return null;
        let normalized = p.replace(/\\/g, '/');
        // Fix filename prefixes for old pipeline data
        normalized = normalized.replace(/AUDIO_TRANS_/g, 'TRANS_');
        normalized = normalized.replace(/AUDIO_DIAR_/g, 'DIAR_');
        // Fix folder names for old pipeline data
        normalized = normalized.replace(/cache_audio_transcripts\//g, 'transcripts/');
        normalized = normalized.replace(/cache_audio_transcripts$/g, 'transcripts');
        // Extract storage/... part from absolute path
        const storageIdx = normalized.indexOf('storage/');
        if (storageIdx !== -1) return '/' + normalized.slice(storageIdx);
        return '/' + normalized;
      }

      const sessions = rows.map(r => {
        return {
          meeting_id: r.meeting_id,
          title: r.meeting_title || 'Untitled Session',
          platform: r.platform || 'unknown',
          start_time: r.start_time,
          end_time: r.end_time,
          meeting_link: r.meeting_link,
          calendar_account: r.calendar_account,
          meeting_status: r.meeting_status,
          duration: r.start_time && r.end_time
            ? Math.round((new Date(r.end_time) - new Date(r.start_time)) / 60000)
            : null,
          has_audio: !!r.audio_path,
          has_transcript: !!r.transcript_path,
          has_summary: !!r.summary_path,
          audio_url: toUrl(r.audio_path),
          transcript_url: toUrl(r.transcript_path),
          summary_url: toUrl(r.summary_path),
          diarization_url: toUrl(r.diarization_path),
          audit_url: toUrl(r.audit_json_path),
          embeddings_url: toUrl(r.embeddings_path),
          llm_prompts_url: toUrl(r.llm_prompts_path),
          action_items_url: toUrl(r.action_items_path),
          sentiment_url: toUrl(r.sentiment_analysis_path),
          talk_ratio_url: toUrl(r.talk_ratio_json_path),
          questions_url: toUrl(r.questions_asked_count_path),
          topic_clusters_url: toUrl(r.topic_clusters_path),
          oqi_score: r.oqi_score,
          evidence_quote: r.evidence_quote,
          score_count: r.score_count || 0,
          avg_score: r.avg_score ? Math.round(r.avg_score * 10) / 10 : null,
          participant_count: r.participant_count || 0,
          meeting_summary: r.meeting_summary,
          days_since_meeting: Math.floor((Date.now() - new Date(r.start_time).getTime()) / (1000 * 60 * 60 * 24))
        };
      });

      // Counts
      const counts = {
        total: sessions.length,
        completed: sessions.filter(s => s.meeting_status === 'completed').length,
        in_progress: sessions.filter(s => ['in_progress', 'active', 'joining'].includes(s.meeting_status)).length,
        scheduled: sessions.filter(s => ['queued', 'launching', 'starting'].includes(s.meeting_status)).length
      };

      return ok({ sessions, counts });
    } catch (e) { return err(e.message); }
  },

  /** GET /api/reviewer-sessions/:meetingId/details — Get detailed info for a single session */
  async getSessionDetails(req) {
    try {
      const meetingId = req.params.meetingId;

      const row = await new Promise((resolve, reject) => {
        db.get(
          `SELECT m.*,
                  ma.audio_path, ma.transcript_path, ma.summary_path, ma.wav_audio_path,
                  ma.oqi_score, ma.evidence_quote, ma.review_status as asset_review_status,
                  ma.reviewer_comments,
                  u.first_name || ' ' || u.last_name as owner_name
           FROM meetings m
           LEFT JOIN meeting_assets ma ON ma.meeting_id = m.external_meeting_id
           LEFT JOIN users u ON u.email = m.calendar_account
           WHERE m.external_meeting_id = ?`,
          [meetingId],
          (err, row) => err ? reject(err) : resolve(row)
        );
      });

      if (!row) return err('Session not found', 404);

      // Get scores for this meeting
      const scores = await new Promise((resolve, reject) => {
        db.all(
          `SELECT ms.*, rc.name as category_name
           FROM meeting_scores ms
           LEFT JOIN rubric_categories rc ON rc.category_id = ms.category_id
           WHERE ms.meeting_id = ?
           ORDER BY ms.created_at DESC`,
          [meetingId],
          (err, rows) => err ? reject(err) : resolve(rows || [])
        );
      });

      // Get participants
      const participants = await new Promise((resolve, reject) => {
        db.all(
          `SELECT * FROM participant_sessions WHERE meeting_id = ? ORDER BY joined_at`,
          [meetingId],
          (err, rows) => err ? reject(err) : resolve(rows || [])
        );
      });

      return ok({
        session: {
          meeting_id: row.meeting_id,
          title: row.title || 'Untitled Session',
          platform: row.platform || 'unknown',
          start_time: row.start_time,
          end_time: row.end_time,
          meeting_link: row.meeting_link,
          calendar_account: row.calendar_account,
          status: row.status,
          duration: row.start_time && row.end_time
            ? Math.round((new Date(row.end_time) - new Date(row.start_time)) / 60000)
            : null,
          meeting_summary: row.summary,
          has_audio: !!row.audio_path,
          has_transcript: !!row.transcript_path,
          has_summary: !!row.summary_path,
          oqi_score: row.oqi_score,
          evidence_quote: row.evidence_quote,
          owner_name: row.owner_name,
          asset_review_status: row.asset_review_status,
          reviewer_comments: row.reviewer_comments,
          scores,
          participants: participants.map(p => ({
            name: p.participant_name,
            joined_at: p.joined_at,
            left_at: p.left_at,
            duration: p.session_duration_seconds,
            status: p.session_status
          }))
        }
      });
    } catch (e) { return err(e.message); }
  }
};

module.exports = controller;