/**
 * controllers/auditReportController.js
 * Business logic for the audit reports page.
 * Provides aggregated compliance, review quality, and AI accuracy data.
 */
const AuditReportModel = require('../../models/reports/AuditReportModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /**
   * GET /api/audit/reports/summary
   * Returns aggregated audit summary stats for the reports dashboard
   * Supports date range and instructor filtering
   */
  async getSummary(req) {
    try {
      const companyId = req.user?.company_id;
      let startDate, endDate;

      // Parse date range from query params
      if (req.query.startDate && req.query.endDate) {
        startDate = new Date(req.query.startDate);
        endDate = new Date(req.query.endDate);
        // Set end date to end of day
        endDate.setHours(23, 59, 59, 999);
      } else {
        // Default: last 30 days
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
      }

      // Parse instructor IDs from query params
      let instructorIds = null;
      if (req.query.instructorIds) {
        instructorIds = Array.isArray(req.query.instructorIds)
          ? req.query.instructorIds.map(id => parseInt(id, 10))
          : [parseInt(req.query.instructorIds, 10)];
      }

      // 1) Get scores and audit results using date range
      const scores = await AuditReportModel.getScoresByDateRange(startDate, endDate, instructorIds);
      const auditResults = await AuditReportModel.getAuditResultsByDateRange(startDate, endDate, instructorIds);

      // 2) Build audit entries from both sources
      const audits = [];

      // From ai_audit_results
      auditResults.forEach(r => {
        const score = r.ai_score || 0;
        const maxScore = r.ai_max_score || 5;
        const pct = maxScore > 0 ? (score / maxScore * 100) : 0;
        audits.push({
          id: `audit-${r.id}`,
          type: 'accuracy',
          category: r.category_id || 'General',
          description: `AI Audit for ${r.meeting_title || 'meeting'}`,
          findings: `Score: ${score}/${maxScore} (${pct.toFixed(0)}%) - ${r.evidence_quote ? r.evidence_quote.substring(0, 100) : 'No evidence'}`,
          score: (score / Math.max(maxScore, 1) * 5).toFixed(1),
          maxScore: '5',
          status: pct >= 70 ? 'pass' : 'fail',
          date: r.scored_at || r.meeting_date
        });
      });

      // From meeting_scores (review quality)
      scores.forEach(s => {
        if (s.score_type === 'HUMAN') {
          audits.push({
            id: `review-${s.id}`,
            type: 'quality',
            category: 'Review',
            description: `Review for ${s.meeting_title || 'meeting'}`,
            findings: `Score: ${(+s.score || 0).toFixed(1)}/5 by ${s.reviewer_name || 'reviewer'}`,
            score: (+s.score || 0).toFixed(1),
            maxScore: '5',
            status: (+s.score || 0) >= 3.5 ? 'pass' : 'fail',
            date: s.scored_at || s.meeting_date
          });
        }
      });

      // From meeting_scores (compliance - score type metadata)
      const typeCounts = {};
      scores.forEach(s => {
        const t = s.score_type || 'UNKNOWN';
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      });
      Object.entries(typeCounts).forEach(([type, count]) => {
        audits.push({
          id: `compliance-${type}`,
          type: 'compliance',
          category: 'Compliance',
          description: `Score type compliance: ${type}`,
          findings: `${count} scores recorded of type ${type}`,
          score: Math.min(count / Math.max(scores.length, 1) * 5, 5).toFixed(1),
          maxScore: '5',
          status: count > 0 ? 'pass' : 'fail',
          date: new Date().toISOString()
        });
      });

      // Sort by date descending, limit to 100
      audits.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      const limited = audits.slice(0, 100);

      // Calculate stats
      const passed = limited.filter(a => a.status === 'pass').length;
      const failed = limited.filter(a => a.status === 'fail').length;
      const byType = {};
      limited.forEach(a => {
        byType[a.type] = (byType[a.type] || 0) + 1;
      });

      // Calculate by category for charts
      const byCategory = {};
      limited.forEach(a => {
        byCategory[a.category] = (byCategory[a.category] || 0) + 1;
      });

      return ok({
        audits: limited,
        stats: {
          total: limited.length,
          passed,
          failed,
          passRate: limited.length > 0 ? (passed / limited.length * 100).toFixed(1) : '0.0',
          byType,
          byCategory
        }
      });
    } catch (e) { return err(e.message); }
  },

  /**
   * GET /api/audit/reports/detail/:type
   * Get detailed audit entries filtered by type (compliance|quality|accuracy)
   */
  async getByType(req) {
    try {
      const result = await controller.getSummary(req);
      if (!result.success) return result;
      const type = req.params.type;
      const filtered = (result.audits || []).filter(a => a.type === type);
      return ok({ audits: filtered, total: filtered.length });
    } catch (e) { return err(e.message); }
  },

  /**
   * GET /api/audit/reports/instructors
   * Get list of active instructors, optionally filtered by calendar connection status
   */
  async getInstructors(req) {
    try {
      const companyId = req.user?.company_id;
      if (!companyId) return err('Company ID required', 400);

      const calendarConnectedOnly = req.query.calendarConnected === 'true';
      const instructors = await AuditReportModel.getActiveInstructors(companyId, calendarConnectedOnly);

      return ok({ instructors });
    } catch (e) { return err(e.message); }
  }
};

module.exports = controller;
