/**
 * Sample data seeder for Session Quality & Impact Report
 * Inserts test data for all 10 report sections
 */

const { runAsync, getAsync } = require('../seedHelpers');
const { db } = require('../db');

const seedSessionQualityData = async () => {
  console.log('Seeding session quality sample data...');
  
  const meetingId = 'demo-meeting-001';
  
  // 1. Session Metadata
  await runAsync(`INSERT IGNORE INTO session_metadata 
    (meeting_id, student_name, teacher_user_id, subject, student_grade, curriculum, topic)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [meetingId, 'John Doe', 2, 'Mathematics', '10th', 'CBSE', 'Algebra - Linear Equations']
  );

  // 2. Quality Report (Rubric)
  await runAsync(`INSERT IGNORE INTO session_quality_reports 
    (meeting_id, percentage_score, overall_rating, student_engagement, learning_impact, parent_shareability, confidence_level, generated_by, generated_at, executive_summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [meetingId, 85, 'Excellent', 'High', 'Significant', 'Yes', 'High', 'AI System', new Date().toISOString(), 
     'This session demonstrated excellent teaching practices with strong student engagement and significant learning outcomes. The teacher effectively used visual aids and interactive examples to explain linear equations.']
  );

  // 3. Session Analysis
  const analyses = [
    { meeting_id: meetingId, analysis_type: 'worked_well', description: 'Teacher used excellent visual aids to explain concepts', evidence: 'Whiteboard diagrams and real-world examples' },
    { meeting_id: meetingId, analysis_type: 'worked_well', description: 'Strong questioning technique', evidence: 'Socratic method used throughout' },
    { meeting_id: meetingId, analysis_type: 'needs_improvement', description: 'Pacing was too fast for some students', evidence: '3 students asked for repetition' },
    { meeting_id: meetingId, analysis_type: 'missed_opportunity', description: 'Could have included more practice problems', evidence: 'Only 2 practice problems given' }
  ];
  
  for (const analysis of analyses) {
    await runAsync(`INSERT IGNORE INTO session_analysis 
      (meeting_id, analysis_type, description, evidence)
      VALUES (?, ?, ?, ?)`,
      [analysis.meeting_id, analysis.analysis_type, analysis.description, analysis.evidence]
    );
  }

  // 4. Learning Impact
  const impacts = [
    { meeting_id: meetingId, impact_area: 'Concept Understanding', impact_level: 'High', observation: 'Students demonstrated clear understanding of linear equations', evidence: 'Correctly solved 8/10 practice problems' },
    { meeting_id: meetingId, impact_area: 'Problem Solving', impact_level: 'High', observation: 'Students applied concepts to new problems independently', evidence: 'Solved 3 unguided problems correctly' },
    { meeting_id: meetingId, impact_area: 'Retention', impact_level: 'Medium', observation: 'Students remembered key formulas from previous session', evidence: 'Recalled slope-intercept form without prompting' }
  ];
  
  for (const impact of impacts) {
    await runAsync(`INSERT IGNORE INTO student_learning_impact 
      (meeting_id, impact_area, impact_level, observation, evidence)
      VALUES (?, ?, ?, ?, ?)`,
      [impact.meeting_id, impact.impact_area, impact.impact_level, impact.observation, impact.evidence]
    );
  }

  // 5. Parent Summary
  await runAsync(`INSERT IGNORE INTO session_parent_summary 
    (meeting_id, what_was_covered, how_student_participated, progress_noticed, needs_more_practice, home_support_suggestions)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [meetingId, 
     'Linear equations - slope, intercept, and graphing',
     'Active participation, asked clarifying questions, solved practice problems',
     'Significant improvement in understanding algebraic concepts over the past week',
     'Practice solving word problems involving linear equations at home. Focus on identifying variables and constants.',
     'Next session will cover quadratic equations. Review slope-intercept form before next class.']
  );

  // 6. Coaching Feedback
  const coachingItems = [
    { meeting_id: meetingId, feedback_type: 'strength', area: 'Visual Teaching', evidence: 'Excellent use of diagrams and real-world examples', why_it_matters: 'Helps students visualize abstract concepts', recommended_action: 'Continue using visual aids; consider digital graphing tools' },
    { meeting_id: meetingId, feedback_type: 'strength', area: 'Questioning Technique', evidence: 'Effective Socratic questioning throughout', why_it_matters: 'Promotes critical thinking and engagement', recommended_action: 'Maintain this approach; try more open-ended questions' },
    { meeting_id: meetingId, feedback_type: 'improvement', area: 'Pacing', evidence: 'Moved too quickly through some examples', why_it_matters: 'Some students struggled to keep up', recommended_action: 'Check for understanding more frequently; slow down for complex topics' }
  ];
  
  for (const item of coachingItems) {
    await runAsync(`INSERT IGNORE INTO teacher_coaching_feedback 
      (meeting_id, feedback_type, area, evidence, why_it_matters, recommended_action)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [item.meeting_id, item.feedback_type, item.area, item.evidence, item.why_it_matters, item.recommended_action]
    );
  }

  // 7. Better Alternatives
  const alternatives = [
    { meeting_id: meetingId, transcript_situation: 'Teacher explained slope formula using only numbers', current_approach: 'Direct explanation with numerical examples', better_alternative: 'Use a visual graph to show slope as rise/run', purpose: 'Visual representation helps students understand the concept better' },
    { meeting_id: meetingId, transcript_situation: 'Students practiced problems individually', current_approach: 'Silent individual work', better_alternative: 'Think-pair-share collaborative approach', purpose: 'Peer learning reinforces understanding and builds confidence' }
  ];
  
  for (const alt of alternatives) {
    await runAsync(`INSERT IGNORE INTO teacher_better_alternatives 
      (meeting_id, transcript_situation, current_approach, better_alternative, purpose)
      VALUES (?, ?, ?, ?, ?)`,
      [alt.meeting_id, alt.transcript_situation, alt.current_approach, alt.better_alternative, alt.purpose]
    );
  }

  // 8. Next Session Plan
  await runAsync(`INSERT IGNORE INTO next_session_plan 
    (meeting_id, session_focus, priority_topics, gaps_to_address, activities, time_allocation, materials_needed, success_criteria)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [meetingId,
     'Introduction to Quadratic Equations',
     'Understanding quadratic form, identifying coefficients, solving simple quadratics',
     'Students need more practice with word problems; reinforce linear equation foundations',
     '1. Review linear equations (10 min), 2. Introduce quadratic concept (15 min), 3. Guided practice (15 min), 4. Independent practice (10 min)',
     '50 minutes total',
     'Graphing calculator, worksheet with 10 practice problems, visual aids',
     'Students can identify and solve 7/10 quadratic equations independently']
  );

  // 9. Quality Flags
  const flags = [
    { meeting_id: meetingId, flag_description: 'Pacing too fast for some students', severity: 'medium', evidence: '3 students asked for repetition during examples', recommended_fix: 'Implement quick check-ins every 5 minutes; slow down for complex topics' },
    { meeting_id: meetingId, flag_description: 'Limited practice problems provided', severity: 'low', evidence: 'Only 2 practice problems given', recommended_fix: 'Provide at least 5-7 practice problems per session' }
  ];
  
  for (const flag of flags) {
    await runAsync(`INSERT IGNORE INTO session_quality_flags 
      (meeting_id, flag_description, severity, evidence, recommended_fix)
      VALUES (?, ?, ?, ?, ?)`,
      [flag.meeting_id, flag.flag_description, flag.severity, flag.evidence, flag.recommended_fix]
    );
  }

  // 10. Final Evaluation
  await runAsync(`INSERT IGNORE INTO session_final_evaluation 
    (meeting_id, overall_session_rating, teacher_performance, student_engagement, learning_impact, parent_communication_readiness, recommended_action, aq_team_summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [meetingId,
     'Excellent',
     'Outstanding - effective use of visual aids and strong student engagement',
     'High - students actively participated and asked questions',
     'Significant - demonstrated clear understanding of concepts',
     'Yes - parent summary generated with clear home support suggestions',
     'Certify as Exemplary Teaching Practice',
     'This session demonstrated outstanding teaching practices. The teacher effectively engaged students, used appropriate visual aids, and maintained a positive learning environment.']
  );

  console.log('✓ Session quality sample data seeded successfully');
  console.log(`  Meeting ID: ${meetingId}`);
  console.log('  Sections seeded: metadata, report, analysis, impact, parentSummary, coaching, betterAlternatives, nextPlan, flags, finalEval');
};

module.exports = { seedSessionQualityData };