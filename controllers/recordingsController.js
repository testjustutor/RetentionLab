/**
 * controllers/recordingsController.js
 * Business logic for meeting recordings, transcripts, summaries, and assets.
 * Uses user_id from calendar_integrations for lookups (not email in URL).
 */
const CalendarUsersModel = require('../models/CalendarUsersModel');
const { db } = require('../database/db');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const ASSET_KEYS = [
  { key: 'audit_json_path', label: 'Audit Log', type: 'JSON', color: 'rose' },
  { key: 'whisper_path', label: 'AI Transcript', type: 'TXT', color: 'violet' },
  { key: 'captions_raw_path', label: 'Captions', type: 'SRT', color: 'emerald' },
  { key: 'diarization_path', label: 'Diarization', type: 'JSON', color: 'sky' },
  { key: 'embeddings_path', label: 'Embeddings', type: 'JSON', color: 'amber' },
  { key: 'llm_prompts_path', label: 'LLM Prompts', type: 'JSON', color: 'fuchsia' },
  { key: 'talk_ratio_json_path', label: 'Talk Ratio', type: 'JSON', color: 'indigo' },
  { key: 'sentiment_analysis_path', label: 'Sentiment', type: 'JSON', color: 'green' },
  { key: 'action_items_path', label: 'Action Items', type: 'JSON', color: 'lime' },
  { key: 'user_silence_duration_path', label: 'Silence Track', type: 'JSON', color: 'orange' },
  { key: 'questions_asked_count_path', label: 'Questions', type: 'JSON', color: 'teal' },
  { key: 'topic_clusters_path', label: 'Topic Clusters', type: 'JSON', color: 'cyan' }
];

function toUrl(p) {
  if (!p) return null;
  // Replace backslashes with forward slashes
  let normalized = p.replace(/\\/g, '/');
  // Fix known bad paths: AUDIO_DIAR should be DIAR, cache_audio_transcripts should be cache_diarization
  normalized = normalized.replace(/AUDIO_DIAR_/g, 'DIAR_').replace(/cache_audio_transcripts/g, 'cache_diarization');
  // Extract the part after 'storage/' to get the relative web path
  const storageIdx = normalized.toLowerCase().indexOf('storage/');
  if (storageIdx !== -1) {
    // Return /storage/... path (relative, no hardcoded base URL)
    return '/' + normalized.slice(storageIdx);
  }
  // Fallback: just prefix with /
  return '/' + normalized;
}

const controller = {
  /** GET /api/recordings/users — list connected instructors with user_id */
  async listUsers(req) {
    try {
      const conns = await CalendarUsersModel.getAllUsers();
      const users = (conns || []).filter(c => c.status === 'active' && c.email)
        .map(c => ({ user_id: c.user_id || c.user_id_ref, email: c.email, role_name: c.role_name || 'instructor' }));
      return ok({ users });
    } catch (e) { return err(e.message); }
  },

  // ── Generic data fetcher (shared by all content pages) ──────────────
  async _fetchByUserId(userId, selectFields, mapFn, limit) {
    limit = limit || 50;
    // Get the user's email from calendar_integrations
    const conns = await CalendarUsersModel.getAllUsers();
    const conn = (conns || []).find(c => (c.user_id || c.user_id_ref) == userId && c.status === 'active');
    if (!conn || !conn.email) return [];
    const rows = await new Promise((r, j) => db.all(
      `SELECT m.*, ma.*, ms.transcript_file_name as session_transcript_file
       FROM meetings m 
       LEFT JOIN meeting_assets ma ON ma.meeting_id = m.meeting_id
       LEFT JOIN meeting_sessions ms ON ms.meeting_id = m.meeting_id
       WHERE LOWER(m.calendar_account)=LOWER(?) ORDER BY m.start_time DESC LIMIT ?`, [conn.email, limit], (e, rr) => e ? j(e) : r(rr || [])));
    return mapFn(rows);
  },

  /** GET /api/recordings/by-user/:userId */
  async getRecordings(req) {
    try {
      const userId = parseInt(req.params.userId);
      if (!userId) return err('User ID required', 400);
      const data = await controller._fetchByUserId(userId, null, rows =>
        rows.map(r => ({ meeting_id: r.meeting_id, title: r.title || 'Untitled', start_time: r.start_time, end_time: r.end_time, platform: r.platform || 'unknown', play_url: toUrl(r.audio_path || r.audio_path), has_recording: !!(r.audio_path || r.audio_path), asset_status: r.asset_status || 'not_started', status: r.status || 'unknown' }))
      );
      return ok({ userId, count: data.length, recordings: data });
    } catch (e) { return err(e.message); }
  },

  /** GET /api/recordings/transcripts/:userId */
  async getTranscripts(req) {
    try {
      const userId = parseInt(req.params.userId);
      if (!userId) return err('User ID required', 400);
      const data = await controller._fetchByUserId(userId, null, rows =>
        rows.map(r => { 
          // Prefer bot captions transcript (live captions) over AI whisper transcript
          let url = null;
          let hasTranscript = false;
          if (r.session_transcript_file) {
            url = '/storage/transcripts/' + r.session_transcript_file;
            hasTranscript = true;
          } else {
            url = r.transcript_path || r.whisper_path || null;
            hasTranscript = !!(r.transcript_path || r.whisper_path);
          }
          return {
           meeting_id: r.meeting_id, 
           title: r.title || 'Untitled', 
           start_time: r.start_time, 
           end_time: r.end_time, 
           platform: r.platform || 'unknown', 
           view_url: toUrl(url), 
           has_transcript: hasTranscript, 
           asset_status: r.asset_status || 'not_started', 
          status: r.status || 'unknown' 
        }; 
        })
      );
      return ok({ userId, count: data.length, transcripts: data });
    } catch (e) { return err(e.message); }
  },

  /** GET /api/recordings/summaries/:userId */
  async getSummaries(req) {
    try {
      const userId = parseInt(req.params.userId);
      if (!userId) return err('User ID required', 400);
      const data = await controller._fetchByUserId(userId, null, rows =>
        rows.map(r => { 
          // Use stored summary_path, or derive from bot captions transcript filename
          let summaryUrl = r.summary_path || null;
          if (!summaryUrl && r.session_transcript_file) {
            summaryUrl = '/storage/summaries/' + r.session_transcript_file.replace('TRANS_', 'SUMMARY_');
          }
          return { 
            meeting_id: r.meeting_id, 
            title: r.title || 'Untitled', 
            start_time: r.start_time, 
            end_time: r.end_time, 
            platform: r.platform || 'unknown', 
            summary_url: toUrl(summaryUrl), 
            action_items_url: toUrl(r.action_items_path), 
            topic_clusters_url: toUrl(r.topic_clusters_path), 
            oqi_score: r.oqi_score || null, 
            evidence_quote: r.evidence_quote || null, 
            has_summary: !!(summaryUrl || r.oqi_score), 
            asset_status: r.asset_status || 'not_started', 
            status: r.status || 'unknown' 
          };
        })
      );
      return ok({ userId, count: data.length, summaries: data });
    } catch (e) { return err(e.message); }
  },

  /** GET /api/recordings/assets/:userId */
  async getAssets(req) {
    try {
      const userId = parseInt(req.params.userId);
      if (!userId) return err('User ID required', 400);
      const data = await controller._fetchByUserId(userId, null, rows => {
        const meetings = rows.map(r => {
          const files = [];
          ASSET_KEYS.forEach(a => { if (r[a.key]) files.push({ key: a.key, label: a.label, type: a.type, color: a.color, url: toUrl(r[a.key]) }); });
          return { meeting_id: r.meeting_id, title: r.title || 'Untitled', start_time: r.start_time, end_time: r.end_time, platform: r.platform || 'unknown', files, fileCount: files.length, has_assets: files.length > 0 };
        }).filter(m => m.has_assets);
        return meetings;
      });
      return ok({ userId, count: data.length, meetings: data });
    } catch (e) { return err(e.message); }
  }
};

module.exports = controller;