/**
 * Risks Insights Controller
 * Provides dynamic risk data from session quality flags and coaching feedback
 */
const RisksModel = require('../../models/insights/RisksModel');

const controller = {
  /**
   * GET /api/insights/risks
   * Get risks and issues from sessions
   */
  async getRisks(req, res) {
    try {
      const user = req.user;
      const { from_date, to_date, instructor_id, severity } = req.body;

      // Get risks from session quality flags (SQL lives in RisksModel)
      const risks = await RisksModel.getQualityFlagRisks(user, { from_date, to_date, instructor_id });

      // Parse JSON flags and flatten into individual risks
      const parsedRisks = [];
      risks.forEach(row => {
        let flags = [];
        try {
          flags = typeof row.flags === 'string' ? JSON.parse(row.flags) : (row.flags || []);
        } catch (e) {
          flags = [];
        }
        flags.forEach(flag => {
          // Apply severity filter
          if (severity && flag.severity !== severity) return;
          parsedRisks.push({
            id: row.id,
            session_id: row.session_id,
            risk_description: flag.description || flag.type || 'Quality issue',
            severity: flag.severity || 'medium',
            evidence: flag.evidence || null,
            recommended_fix: flag.recommended_fix || null,
            created_at: row.created_at,
            updated_at: row.updated_at,
            meeting_title: row.meeting_title,
            meeting_date: row.meeting_date,
            instructor_name: row.instructor_name,
            instructor_id: row.instructor_id
          });
        });
      });

      // Get risks from low quality scores (SQL lives in RisksModel)
      const qualityRisks = await RisksModel.getQualityScoreRisks(user, { from_date, to_date, instructor_id });

      // Convert quality risks to standard format
      const qualityRiskItems = qualityRisks.map(qr => ({
        id: 'quality_' + qr.meeting_id,
        risk_description: `Low session quality score: ${qr.percentage_score}% - ${qr.confidence_reason || 'Below threshold'}`,
        severity: qr.percentage_score < 40 ? 'high' : 'medium',
        evidence: qr.executive_summary,
        recommended_fix: 'Review session recording and provide coaching',
        meeting_title: qr.meeting_title,
        meeting_date: qr.meeting_date,
        instructor_name: qr.instructor_name,
        instructor_id: qr.instructor_id,
        created_at: qr.meeting_date,
        risk_type: 'quality_score'
      }));

      // Combine all risks
      const allRisks = [
        ...parsedRisks.map(r => ({ ...r, risk_type: 'quality_flag' })),
        ...qualityRiskItems
      ];

      // Calculate summary statistics
      const totalRisks = allRisks.length;
      const highRisks = allRisks.filter(r => r.severity === 'high').length;
      const mediumRisks = allRisks.filter(r => r.severity === 'medium').length;
      const lowRisks = allRisks.filter(r => r.severity === 'low').length;

      // Risk type distribution
      const riskTypeDistribution = { quality_flag: 0, quality_score: 0 };
      allRisks.forEach(risk => {
        const type = risk.risk_type || 'quality_flag';
        riskTypeDistribution[type] = (riskTypeDistribution[type] || 0) + 1;
      });

      // Instructor-wise breakdown
      const instructorStats = {};
      allRisks.forEach(risk => {
        const instructorId = risk.instructor_id;
        if (!instructorStats[instructorId]) {
          instructorStats[instructorId] = {
            instructor_id: instructorId,
            instructor_name: risk.instructor_name,
            total_risks: 0,
            high_risks: 0,
            medium_risks: 0,
            low_risks: 0
          };
        }
        instructorStats[instructorId].total_risks++;
        if (risk.severity === 'high') instructorStats[instructorId].high_risks++;
        else if (risk.severity === 'medium') instructorStats[instructorId].medium_risks++;
        else if (risk.severity === 'low') instructorStats[instructorId].low_risks++;
      });

      const instructorBreakdown = Object.values(instructorStats);

      // Recent risks (last 10)
      const recentRisks = allRisks.slice(0, 10).map(risk => ({
        id: risk.id,
        risk_description: risk.risk_description,
        severity: risk.severity,
        risk_type: risk.risk_type,
        evidence: risk.evidence,
        recommended_fix: risk.recommended_fix,
        meeting_title: risk.meeting_title,
        meeting_date: risk.meeting_date,
        instructor_name: risk.instructor_name,
        created_at: risk.created_at
      }));

      res.json({
        success: true,
        summary: {
          total_risks: totalRisks,
          high_risks: highRisks,
          medium_risks: mediumRisks,
          low_risks: lowRisks,
          risk_type_distribution: riskTypeDistribution
        },
        instructor_breakdown: instructorBreakdown,
        recent_risks: recentRisks
      });
    } catch (err) {
      console.error('Risks insights error:', err);
      res.status(500).json({ error: err.message, success: false });
    }
  }
};

module.exports = controller;
