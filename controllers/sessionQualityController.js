/**
 * Session Quality Controller
 * Handles all session quality report endpoints with filtering and analytics
 */

const SessionSnapshotModel = require('../models/SessionSnapshotModel');
const SessionAnalysisModel = require('../models/SessionAnalysisModel_v2');
const SessionLearningImpactModel = require('../models/SessionLearningImpactModel_v2');
const SessionParentSummaryModel = require('../models/SessionParentSummaryModel_v2');
const SessionCoachingFeedbackModel = require('../models/SessionCoachingFeedbackModel_v2');
const SessionBetterAlternativesModel = require('../models/SessionBetterAlternativesModel_v2');
const SessionNextPlanModel = require('../models/SessionNextPlanModel_v2');
const SessionQualityFlagsModel = require('../models/SessionQualityFlagsModel_v2');
const SessionFinalEvaluationModel = require('../models/SessionFinalEvaluationModel_v2');
const RubricEvaluationModel = require('../models/RubricEvaluationModel');
const RubricSummaryModel = require('../models/RubricSummaryModel');
const MeetingModel = require('../models/MeetingModel');

/**
 * Get dashboard data with filters
 * POST /api/tutoring/dashboard
 */
async function getDashboard(req) {
  try {
    const { db } = require('../database/db');
    const filters = {
      instructorId: req.body?.instructor_id,
      meetingId: req.body?.meeting_id,
      fromDate: req.body?.from_date,
      toDate: req.body?.to_date,
      subject: req.body?.subject,
      studentGrade: req.body?.student_grade,
      curriculum: req.body?.curriculum,
      location: req.body?.location
    };

    // Build query with filters - join with meeting_sessions and users to get names
    // Only show data for instructors created by the logged-in admin user
    let query = `
      SELECT 
        s.id,
        s.session_id,
        s.student_grade,
        s.curriculum,
        s.location,
        s.subject,
        s.topics_covered,
        s.session_objective_status,
        s.overall_score_pct,
        s.overall_rating,
        s.student_engagement,
        s.learning_impact,
        s.parent_shareability,
        s.executive_summary,
        s.created_at,
        s.updated_at,
        m.meeting_id,
        m.title,
        m.start_time,
        m.end_time,
        m.platform,
        CONCAT('SES-', LPAD(s.session_id, 6, '0')) as session_ref,
        CONCAT(teacher.first_name, ' ', teacher.last_name) as instructor_name,
        sm.student_name as student_name
      FROM session_snapshot s
      LEFT JOIN meeting_sessions ms ON s.session_id = ms.id
      LEFT JOIN meetings m ON ms.meeting_id = m.meeting_id
      LEFT JOIN session_metadata sm ON m.meeting_id = sm.meeting_id
      LEFT JOIN users teacher ON sm.teacher_user_id = teacher.id
      WHERE teacher.created_by = ?
    `;
    const params = [req.user?.id];

    if (filters.instructorId) {
      query += ' AND sm.teacher_user_id = ?';
      params.push(filters.instructorId);
    }
    if (filters.meetingId) {
      query += ' AND m.meeting_id = ?';
      params.push(filters.meetingId);
    }
    if (filters.fromDate) {
      query += ' AND m.start_time >= ?';
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      query += ' AND m.start_time <= ?';
      params.push(filters.toDate + ' 23:59:59');
    }
    if (filters.subject) {
      query += ' AND sm.subject = ?';
      params.push(filters.subject);
    }
    if (filters.studentGrade) {
      query += ' AND sm.student_grade = ?';
      params.push(filters.studentGrade);
    }
    if (filters.curriculum) {
      query += ' AND sm.curriculum = ?';
      params.push(filters.curriculum);
    }
    if (filters.location) {
      query += ' AND sm.location = ?';
      params.push(filters.location);
    }
    query += ' ORDER BY m.start_time DESC';

    const sessions = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Calculate stats
    const stats = {
      total_sessions: sessions.length,
      avg_score: sessions.length > 0 
        ? Math.round(sessions.reduce((sum, s) => sum + (s.overall_score_pct || 0), 0) / sessions.length)
        : 0,
      complete_reports: sessions.filter(s => s.overall_score_pct > 0).length,
      pending_reports: sessions.filter(s => !s.overall_score_pct || s.overall_score_pct === 0).length
    };

    // Score distribution
    const scoreRanges = [
      { min: 0, max: 20, count: 0, label: '0-20%' },
      { min: 21, max: 40, count: 0, label: '21-40%' },
      { min: 41, max: 60, count: 0, label: '41-60%' },
      { min: 61, max: 80, count: 0, label: '61-80%' },
      { min: 81, max: 100, count: 0, label: '81-100%' }
    ];

    sessions.forEach(session => {
      const score = session.overall_score_pct || 0;
      const range = scoreRanges.find(r => score >= r.min && score <= r.max);
      if (range) range.count++;
    });

    const scoreDistribution = scoreRanges.map(r => r.count);

    // Subject distribution with avg scores
    const subjectMap = {};
    const gradeMap = {};
    const curriculumScoreMap = {};
    let totalEngagement = 0, totalImpact = 0, engagementCount = 0, impactCount = 0;
    
    sessions.forEach(session => {
      // Subject
      const subject = session.subject || 'Unknown';
      if (!subjectMap[subject]) subjectMap[subject] = { count: 0, totalScore: 0 };
      subjectMap[subject].count++;
      subjectMap[subject].totalScore += session.overall_score_pct || 0;
      
      // Grade
      const grade = session.student_grade || 'Unknown';
      gradeMap[grade] = (gradeMap[grade] || 0) + 1;
      
      // Curriculum score
      const curriculum = session.curriculum || 'Unknown';
      if (!curriculumScoreMap[curriculum]) curriculumScoreMap[curriculum] = { count: 0, totalScore: 0 };
      curriculumScoreMap[curriculum].count++;
      curriculumScoreMap[curriculum].totalScore += session.overall_score_pct || 0;
      
      // Engagement & Impact
      if (session.student_engagement) {
        const engVal = parseFloat(session.student_engagement) || 50;
        totalEngagement += engVal;
        engagementCount++;
      }
      if (session.learning_impact) {
        const impVal = parseFloat(session.learning_impact) || 50;
        totalImpact += impVal;
        impactCount++;
      }
    });
    
    const subjectDistribution = Object.entries(subjectMap).map(([subject, data]) => ({
      subject,
      count: data.count,
      avg_score: Math.round(data.totalScore / data.count)
    }));

    // Grade distribution
    const gradeDistribution = Object.entries(gradeMap).map(([grade, count]) => ({
      grade,
      count
    }));

    // Curriculum score distribution
    const curriculumDistribution = Object.entries(curriculumScoreMap).map(([curriculum, data]) => ({
      curriculum,
      count: data.count,
      avg_score: Math.round(data.totalScore / data.count)
    }));

    // Average engagement & impact
    const avgEngagement = engagementCount > 0 ? Math.round(totalEngagement / engagementCount) : 50;
    const avgImpact = impactCount > 0 ? Math.round(totalImpact / impactCount) : 50;

    // Low performing sessions (score < 60%)
    const lowPerformingSessions = sessions
      .filter(s => s.overall_score_pct && s.overall_score_pct < 60)
      .map(s => ({
        session_ref: s.session_ref,
        meeting_id: s.meeting_id,
        instructor_name: s.instructor_name || 'N/A',
        student_name: s.student_name || 'N/A',
        subject: s.subject,
        student_grade: s.student_grade,
        start_time: s.start_time,
        overall_score_pct: s.overall_score_pct
      }));

    const charts = {
      score_distribution: scoreDistribution,
      subject_distribution: subjectDistribution,
      grade_distribution: gradeDistribution,
      curriculum_distribution: curriculumDistribution,
      avg_engagement: avgEngagement,
      avg_impact: avgImpact
    };

    return {
      statusCode: 200,
      success: true,
      data: {
        stats,
        sessions: sessions.map(s => ({
          session_ref: s.session_ref,
          meeting_id: s.meeting_id,
          instructor_name: s.instructor_name || 'N/A',
          student_name: s.student_name || 'N/A',
          subject: s.subject,
          student_grade: s.student_grade,
          start_time: s.start_time,
          overall_score_pct: s.overall_score_pct,
          overall_rating: s.overall_rating
        })),
        low_performing_sessions: lowPerformingSessions,
        charts
      }
    };

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return {
      statusCode: 500,
      success: false,
      error: 'Failed to fetch dashboard data'
    };
  }
}

/**
 * Get filter options
 * POST /api/tutoring/filters/options
 */
async function getFilterOptions(req) {
  try {
    const field = req.body?.field;
    const validFields = ['subject', 'student_grade', 'curriculum', 'location'];
    
    if (!field || !validFields.includes(field)) {
      return {
        statusCode: 400,
        success: false,
        error: 'Invalid field. Must be one of: ' + validFields.join(', ')
      };
    }

    const { db } = require('../database/db');
    
    const query = `
      SELECT DISTINCT ${field} as value, ${field} as label
      FROM session_snapshot
      WHERE ${field} IS NOT NULL AND ${field} != ''
      ORDER BY ${field}
    `;

    const options = await new Promise((resolve, reject) => {
      db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    return {
      statusCode: 200,
      success: true,
      data: { options }
    };

  } catch (error) {
    console.error('Error fetching filter options:', error);
    return {
      statusCode: 500,
      success: false,
      error: 'Failed to fetch filter options'
    };
  }
}

/**
 * Get aggregate report for a specific session
 * POST /api/tutoring/report
 * Accepts internal session ID - never exposes real meeting IDs to frontend.
 */
async function getAggregateReport(req) {
  try {
    const { db } = require('../database/db');
    const internalSessionId = parseInt(req.body?.session_internal_id, 10);
    
    if (!internalSessionId || isNaN(internalSessionId)) {
      return {
        statusCode: 400,
        success: false,
        error: 'Session identifier is required'
      };
    }

    // Look up the session and meeting internally
    const session = await new Promise((resolve, reject) => {
      db.get(
        'SELECT ms.id, ms.meeting_id, ms.start_time, ms.end_time FROM meeting_sessions ms WHERE ms.id = ?',
        [internalSessionId],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });

    if (!session) {
      return {
        statusCode: 404,
        success: false,
        error: 'Session not found'
      };
    }

    // Get meeting info using the real meeting_id (internal lookup only)
    const meeting = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM meetings WHERE meeting_id = ?', [session.meeting_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // Get all report sections using the session_id (which is meeting_sessions.id)
    const sessionId = session.id;
    
    // Load each section independently to avoid Promise.all failing silently
    let snapshot, analysis, impact, parentSummary, coaching, betterAlternatives, nextPlan, flags, finalEval, rubricSummary, rubricEvaluations;
    
    try { snapshot = await SessionSnapshotModel.findBySessionId(sessionId); } catch (e) { console.error('Error loading snapshot:', e); }
    try { analysis = await SessionAnalysisModel.findBySessionId(sessionId); } catch (e) { console.error('Error loading analysis:', e); }
    try { impact = await SessionLearningImpactModel.findBySessionId(sessionId); } catch (e) { console.error('Error loading impact:', e); }
    try { parentSummary = await SessionParentSummaryModel.findBySessionId(sessionId); } catch (e) { console.error('Error loading parentSummary:', e); }
    try { coaching = await SessionCoachingFeedbackModel.findBySessionId(sessionId); } catch (e) { console.error('Error loading coaching:', e); }
    try { betterAlternatives = await SessionBetterAlternativesModel.findBySessionId(sessionId); } catch (e) { console.error('Error loading betterAlternatives:', e); }
    try { nextPlan = await SessionNextPlanModel.findBySessionId(sessionId); } catch (e) { console.error('Error loading nextPlan:', e); }
    try { flags = await SessionQualityFlagsModel.findBySessionId(sessionId); } catch (e) { console.error('Error loading flags:', e); }
    try { finalEval = await SessionFinalEvaluationModel.findBySessionId(sessionId); } catch (e) { console.error('Error loading finalEval:', e); }
    try { rubricSummary = await RubricSummaryModel.getBySession(sessionId); } catch (e) { console.error('Error loading rubricSummary:', e); }
    try { rubricEvaluations = await RubricEvaluationModel.getBySession(sessionId); } catch (e) { console.error('Error loading rubricEvaluations:', e); }

    return {
      statusCode: 200,
      success: true,
      data: {
        metadata: {
          meeting_title: meeting?.title || 'Untitled',
          start_time: meeting?.start_time || session.start_time,
          end_time: meeting?.end_time || session.end_time
        },
        snapshot: snapshot || {},
        report: rubricSummary || {},
        analysis: analysis || { items: [] },
        impact: impact || { areas: [] },
        parentSummary: parentSummary || {},
        coaching: coaching || { strengths: [], areas_to_improve: [] },
        betterAlternatives: betterAlternatives || { items: [] },
        nextPlan: nextPlan || { segments: [], priority_focus: [], gaps_to_address: [] },
        flags: flags || { flags: [] },
        finalEval: finalEval || {},
        rubricEvaluations: rubricEvaluations || { evaluations: [] }
      }
    };

  } catch (error) {
    console.error('Error fetching aggregate report:', error);
    return {
      statusCode: 500,
      success: false,
      error: 'Failed to fetch report'
    };
  }
}

module.exports = {
  getDashboard,
  getFilterOptions,
  getAggregateReport
};