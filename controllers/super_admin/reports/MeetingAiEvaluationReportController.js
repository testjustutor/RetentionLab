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
      const overall = await MeetingAiEvaluationReportModel.getSessionOverallSummary(sessionId);
      const categoryScores = await MeetingAiEvaluationReportModel.getSessionCategoryScores(sessionId);

      // Aggregate stats from the new status-code schema.
      // status_code: 1=Met, 2=Not Met, 3=Not Applicable (excluded).
      const scored = results.filter(
        (r) => r.status_code !== null && r.status_code !== undefined && Number(r.status_code) !== 3
      );
      const avgPct = overall && Number(overall.final_score) ? Number(overall.final_score) : 0;
      const oqiScore = avgPct;
      const gateFailed = results.filter((r) => Number(r.is_gate) === 1 && Number(r.status_code) === 2).length;

      // The session report table renders Category / Indicator / Weightage /
      // AI Outcome / Evidence Quote from the status-code rows. The new schema
      // carries evidence in ai_evidence (reason stores the justification).
      const seenIndicators = new Set();
      const auditRows = [];
      results.forEach((r) => {
        const dedupeKey = r.indicator_id != null
          ? `i${r.indicator_id}`
          : `n${String(r.indicator_name || r.id || '').toLowerCase()}`;
        if (seenIndicators.has(dedupeKey)) return;
        seenIndicators.add(dedupeKey);
        auditRows.push({
          id: r.id,
          category_name: r.category_name,
          indicator_name: r.indicator_name,
          category_weight: r.category_weight,
          indicator_value: r.indicator_value,
          rating: r.rating,
          status_code: r.status_code,
          ai_evidence: r.ai_evidence,
          reason: r.reason
        });
      });

      // ai_audit_category_scores rollup - one row per rubric category
      // (A-H), already computed by the audit engine (audit_scoring.py) at
      // scoring time. Just shape numeric fields consistently for the UI.
      const categories = (categoryScores || []).map((c) => ({
        category_id: c.category_id,
        category_name: c.category_name || c.category_code || 'Other',
        category_code: c.category_code,
        category_weight: c.category_weight !== null && c.category_weight !== undefined
          ? Number(c.category_weight) : null,
        countMet: Number(c.count_met) || 0,
        countNotMet: Number(c.count_not_met) || 0,
        countNotApplicable: Number(c.count_not_applicable) || 0,
        totalCriteria: Number(c.total_criteria) || 0,
        categoryScore: c.category_score !== null && c.category_score !== undefined
          ? Number(c.category_score) : 0
      }));

      // ai_audit_overall_summary - the single session-level rollup row.
      // Exposed in full (not just final_score, which is all getSessionReport
      // used before) so the UI can also show red_flag / total criteria /
      // the narrative summary text if present.
      const overallSummary = overall ? {
        finalScore: overall.final_score !== null && overall.final_score !== undefined
          ? Number(overall.final_score) : 0,
        totalWeightedPercent: overall.total_weighted_percent !== null && overall.total_weighted_percent !== undefined
          ? Number(overall.total_weighted_percent) : 0,
        totalCriteriaAll: Number(overall.total_criteria_all) || 0,
        redFlag: Number(overall.red_flag) === 1,
        overallSummaryText: overall.overall_summary || null
      } : null;

      return ok({
        session: meta,
        results: auditRows,
        categoryScores: categories,
        overallSummary,
        stats: {
          indicatorCount: auditRows.length,
          avgScorePct: scored.length ? Math.round(avgPct * 10) / 10 : 0,
          oqiScore,
          gateFailed,
          evidenceCount: auditRows.filter((r) => r.ai_evidence || r.reason).length
        }
      });
    } catch (e) {
      return err(e.message);
    }
  }
};

module.exports = controller;