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
   * GET /api/super_admin/reports/meeting-ai-evaluation/summary
   * Accepts: from_date, to_date, instructor_id
   * Returns meetings with their sessions, each session annotated with AI audit availability.
   */
  async getSummary(req) {
    try {
      const { from_date, to_date, instructor_id } = req.query;
      const rows = await MeetingAiEvaluationReportModel.getMeetingSessions({
        from_date,
        to_date,
        instructor_id
      });
      const summary = await MeetingAiEvaluationReportModel.getSessionAuditSummary();

      // Index audit summary by session id.
      const summaryBySession = {};
      (summary || []).forEach((s) => {
        summaryBySession[String(s.session_id)] = s;
      });

      // Merge meeting + session + audit summary into enriched records.
      const records = (rows || []).map((r) => {
        const audit = summaryBySession[String(r.session_id)] || {};
        return {
          ...r,
          ai_indicator_count: Number(audit.ai_indicator_count) || 0,
          ai_avg_score_pct: audit.ai_avg_score_pct ? Number(audit.ai_avg_score_pct) : 0,
          ai_scored_at: audit.ai_scored_at || null,
          has_ai_report: Number(audit.ai_indicator_count) > 0
        };
      });

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
      const oqiScores = results.map((r) => Number(r.oqi_score)).filter((v) => !Number.isNaN(v));
      const avgPct = results.length
        ? results.reduce((sum, r) => {
            const denom = Number(r.ai_max_score) || 0;
            return sum + (denom > 0 ? ((Number(r.ai_score) || 0) / denom) * 100 : 0);
          }, 0) / results.length
        : 0;
      const gateFailed = results.filter((r) => Number(r.is_gate) === 1 &&
        (Number(r.ai_score) || 0) < (Number(r.ai_max_score) || 0)).length;

      return ok({
        session: meta,
        results,
        stats: {
          indicatorCount: results.length,
          avgScorePct: results.length ? Math.round(avgPct * 10) / 10 : 0,
          oqiScore: results.length ? Math.round(results[0].oqi_score || 0) : 0,
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