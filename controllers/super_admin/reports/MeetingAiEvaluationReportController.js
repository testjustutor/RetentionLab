/**
 * controllers/super_admin/reports/MeetingAiEvaluationReportController.js
 * Business logic for the Super Admin Meeting AI Evaluation report.
 * Controllers never write SQL — all DB access goes through Models.
 */
const MeetingAiEvaluationReportModel = require('../../../models/super_admin/reports/MeetingAiEvaluationReportModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /**
   * GET /api/super_admin/reports/meeting-ai-evaluation/instructors
   * Active instructors (super admin sees all companies).
   */
  async getInstructors(req) {
    try {
      const instructors = await MeetingAiEvaluationReportModel.getInstructors(req.user || {});
      return ok({ instructors });
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * POST /api/super_admin/reports/meeting-ai-evaluation/summary
   * Accepts: from_date, to_date, instructor_id (in request body)
   * Returns meetings with their sessions, each session annotated with AI audit availability.
   *
   * getMeetingSessions() now does the audit aggregation itself (single query, joined subquery)
   * instead of a separate unfiltered getSessionAuditSummary() call merged here in JS — see the
   * model for details. This method just shapes the already-merged rows for the response.
   *
   * has_ai_report means "at least one ai_audit_results row exists for this session" — that
   * includes excluded indicators (ai_score IS NULL). A session where every indicator is
   * excluded will show has_ai_report: true with ai_avg_score_pct: 0, which can look the same
   * in the UI as "scored and got 0%". ai_scored_count is exposed alongside ai_indicator_count
   * so the UI can distinguish "no indicators evaluated" from "genuinely scored 0%" if needed.
   */
  async getSummary(req) {
    try {
      const { from_date, to_date, instructor_id } = req.body;
      const rows = await MeetingAiEvaluationReportModel.getMeetingSessions({
        from_date,
        to_date,
        instructor_id
      });

      const records = (rows || []).map((r) => ({
        ...r,
        ai_indicator_count: Number(r.ai_indicator_count) || 0,
        ai_scored_count: Number(r.ai_scored_count) || 0,
        ai_avg_score_pct: r.ai_avg_score_pct ? Number(r.ai_avg_score_pct) : 0,
        ai_scored_at: r.ai_scored_at || null,
        has_ai_report: Number(r.ai_indicator_count) > 0
      }));

      const totalMeetings = new Set(records.map((r) => r.meeting_id)).size;
      const totalSessions = records.length;
      const withReport = records.filter((r) => r.has_ai_report).length;
      const withoutReport = totalSessions - withReport;

      return ok({
        records,
        stats: {
          totalMeetings,
          totalSessions,
          withReport,
          withoutReport
        }
      });
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * GET /api/super_admin/reports/meeting-ai-evaluation/session/:sessionId
   * Returns full AI-generated data for one session (ai_audit_results rows + meeting/session context).
   */
  async getSessionReport(req) {
    try {
      const sessionId = parseInt(req.params.sessionId, 10);
      if (!sessionId) return err('Invalid session id', 400);

      const meta = await MeetingAiEvaluationReportModel.getSessionMeta(sessionId);
      if (!meta) return err('Session not found', 404);

      const results = await MeetingAiEvaluationReportModel.getSessionAuditResults(sessionId);

      // Compute aggregate stats for the session.
      // A row with ai_score null is an EXCLUDED indicator (e.g. video-gated and
      // not scorable from a transcript). Excluded rows must not contribute to the
      // average nor count as gate failures — otherwise they'd be double-penalized.
      // A row with ai_score set but ai_max_score 0/null contributes 0 rather than being
      // dropped — this matches the summary query's per-row CASE logic so the two pages agree.
      const scored = results.filter(
        (r) => r.ai_score !== null && r.ai_score !== undefined
      );
      const avgPct = scored.length
        ? scored.reduce((sum, r) => {
            const denom = Number(r.ai_max_score) || 0;
            return sum + (denom > 0 ? ((Number(r.ai_score) || 0) / denom) * 100 : 0);
          }, 0) / scored.length
        : 0;
      const gateFailed = results.filter((r) => Number(r.is_gate) === 1 &&
        r.ai_score !== null && r.ai_score !== undefined &&
        (Number(r.ai_score) || 0) < (Number(r.ai_max_score) || 0)).length;

      // oqi_score is expected to be a session-level value duplicated across every indicator
      // row. Rather than trusting results[0] (results is ordered alphabetically by
      // category/indicator name, not meaningfully for this purpose), take the max across
      // all rows so a null/0 first row can't silently zero out the session's OQI score.
      const oqiScore = results.length
        ? Math.round(Math.max(...results.map((r) => Number(r.oqi_score) || 0)))
        : 0;

      return ok({
        session: meta,
        results,
        stats: {
          indicatorCount: results.length,
          avgScorePct: scored.length ? Math.round(avgPct * 10) / 10 : 0,
          oqiScore,
          gateFailed,
          evidenceCount: results.filter((r) => r.ai_evidence || r.evidence_quote).length
        }
      });
    } catch (e) {
      return err(e.message);
    }
  }
};

module.exports = controller;