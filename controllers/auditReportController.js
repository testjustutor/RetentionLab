/**
 * controllers/auditReportController.js
 * Business logic for the audit reports page.
 * Provides aggregated compliance, review quality, and AI accuracy data.
 */
const { db } = require('../database/db');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /**
   * GET /api/audit/reports/summary
   * Returns aggregated audit summary stats for the reports dashboard
   */
  async getSummary(req) {
    try {
      const days = parseInt(req.query.days) || 30;
      const companyId = req.user?.company_id;

      // 1) Total scores as audit base
      const scoresSql = `
        SELECT ms.*, m.title as meeting_title, m.platform, m.start_time as meeting_date,
               u.first_name || ' ' || u.last_name as reviewer_name
        FROM meeting_scores ms
        LEFT JOIN meetings m ON m.meeting_id = ms.meeting_id
        LEFT JOIN users u ON u.id = ms.reviewer_id
        WHERE ms.scored_at >= datetime('now', '-' || ? || ' days')
        ORDER BY ms.scored_at DESC
        LIMIT 500
      `;

      const scores = await new Promise((resolve, reject) => {
        db.all(scoresSql, [days], (err, rows) => err ? reject(err) : resolve(rows || []));
      });

      // 2) Audit results from ai_audit_results table
      const auditSql = `
        SELECT aar.*, m.title as meeting_title, m.start_time as meeting_date
        FROM ai_audit_results aar
        LEFT JOIN meetings m ON m.meeting_id = aar.meeting_id
        WHERE aar.scored_at >= datetime('now', '-' || ? || ' days')
        ORDER BY aar.scored_at DESC
        LIMIT 200
      `;

      const auditResults = await new Promise((resolve, reject) => {
        db.all(auditSql, [days], (err, rows) => err ? reject(err) : resolve(rows || []));
      });

      // 3) Build audit entries from both sources
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

      return ok({
        audits: limited,
        stats: {
          total: limited.length,
          passed,
          failed,
          passRate: limited.length > 0 ? (passed / limited.length * 100).toFixed(1) : '0.0',
          byType
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
  }
};

module.exports = controller;