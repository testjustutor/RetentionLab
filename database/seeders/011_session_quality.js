/**
 * root/database/seeders/011_session_quality.js
 *
 * Seeds the 10 Session Quality & Impact Report tables with realistic sample data
 * so the frontend pages display content immediately after seeding.
 *
 * Uses session_id=1 (must exist in meeting_sessions).
 */
const { db } = require('../db');
const { logger } = require('../../utils/logger');

// ── Helper: promisified run ─────────────────────────────────────────────────
const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) return reject(err);
    resolve({ lastID: this.lastID, changes: this.changes });
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) return reject(err);
    resolve(row || null);
  });
});

const seedSessionQuality = async () => {
  logger.info('[SessionQualitySeeder] Starting...');

  // Find first available session
  const session = await get('SELECT id, meeting_id FROM meeting_sessions ORDER BY id ASC LIMIT 1');
  if (!session) {
    logger.warn('[SessionQualitySeeder] No meeting_sessions found — skipping');
    return;
  }

  const sessionId = session.id;
  const meetingId = session.meeting_id;
  logger.info(`[SessionQualitySeeder] Using session_id=${sessionId}, meeting_id=${meetingId}`);

  // ─── 1. session_snapshot ─────────────────────────────────────────────────
  await run(`
    INSERT INTO session_snapshot 
      (session_id, student_grade, curriculum, location, subject, topics_covered,
       session_objective_status, overall_score_pct, overall_rating, student_engagement,
       learning_impact, parent_shareability, executive_summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      student_grade=VALUES(student_grade), curriculum=VALUES(curriculum),
      location=VALUES(location), subject=VALUES(subject),
      topics_covered=VALUES(topics_covered),
      session_objective_status=VALUES(session_objective_status),
      overall_score_pct=VALUES(overall_score_pct),
      overall_rating=VALUES(overall_rating),
      student_engagement=VALUES(student_engagement),
      learning_impact=VALUES(learning_impact),
      parent_shareability=VALUES(parent_shareability),
      executive_summary=VALUES(executive_summary)
  `, [
    sessionId,
    'Grade 7',
    'IGCSE',
    'UAE',
    'Mathematics — Algebra',
    JSON.stringify(['Linear equations', 'Solving for x', 'Word problems']),
    'Partially Met — objective was stated but not fully achieved',
    62.50,
    'Developing',
    'Moderate — student participated when prompted',
    'Moderate — student showed understanding of basic concepts but struggled with application',
    'Partially — requires some context for parents',
    'Grade 7 IGCSE student in UAE participated in a one-to-one Algebra session. The tutor covered linear equations and solving for x. The student demonstrated basic understanding but needs additional practice with multi-step problems and word problems. Session objective was partially met.'
  ]);
  logger.info('[SessionQualitySeeder] session_snapshot seeded');

  // ─── 2. session_analysis ─────────────────────────────────────────────────
  await run(`
    INSERT INTO session_analysis 
      (session_id, what_worked_well, what_needs_improvement, missed_opportunities)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      what_worked_well=VALUES(what_worked_well),
      what_needs_improvement=VALUES(what_needs_improvement),
      missed_opportunities=VALUES(missed_opportunities)
  `, [
    sessionId,
    JSON.stringify([
      { text: 'Clear explanation of variable isolation', evidence: 'Tutor demonstrated step-by-step how to isolate x on both sides of the equation', impact: 'Positive' },
      { text: 'Good use of practice problems', evidence: 'Tutor provided 3 practice problems after explaining the concept', impact: 'Positive' },
      { text: 'Patient and supportive tone throughout', evidence: 'Tutor encouraged student after each correct answer and calmly corrected errors', impact: 'High' },
      { text: 'Effective scaffolding on difficult problems', evidence: 'When student struggled with 2x+5=15, tutor broke it down into smaller steps', impact: 'High' }
    ]),
    JSON.stringify([
      { text: 'Needs stronger session opening with clear objective', evidence: 'Session started without stating what would be covered', recommendation: 'Begin each session with "Today we will learn..."' },
      { text: 'More opportunities for student to explain reasoning', evidence: 'Student often gave short answers without being asked to explain how they arrived at the answer', recommendation: 'Ask "How did you get that answer?" after each response' },
      { text: 'Session closure was rushed', evidence: 'Session ended abruptly without a summary of what was learned', recommendation: 'Reserve 2-3 minutes for a closing summary' }
    ]),
    JSON.stringify([
      { text: 'Could have used a real-world example to increase engagement', evidence: 'Student seemed more engaged when tutor mentioned shopping example', suggested_approach: 'Use more relatable contexts like money, sports scores, or age puzzles' },
      { text: 'Missed chance to check for deeper understanding', evidence: 'Student correctly solved "x+3=7" but may not understand why subtracting 3 works', suggested_approach: 'Ask "Why do we subtract 3 from both sides?" before moving on' },
      { text: 'Did not assign or suggest homework/practice', evidence: 'No practice work was suggested at the end', suggested_approach: 'Assign 2-3 similar problems for independent practice' }
    ])
  ]);
  logger.info('[SessionQualitySeeder] session_analysis seeded');

  // ─── 3. session_learning_impact ──────────────────────────────────────────
  await run(`
    INSERT INTO session_learning_impact 
      (session_id, impact_areas)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE
      impact_areas=VALUES(impact_areas)
  `, [
    sessionId,
    JSON.stringify([
      { area: 'Concept Understanding', observation: 'Student understood the concept of isolating variables after guided practice', evidence: 'Correctly solved 3 of 4 one-step equations independently', impact_level: 'Strong' },
      { area: 'Student Participation', observation: 'Student actively attempted all problems but needed prompting', evidence: 'Answered 8 of 12 questions when asked, volunteered 2 responses', impact_level: 'Moderate' },
      { area: 'Confidence', observation: 'Student showed increased confidence after each correct answer', evidence: 'Started hesitantly but by end was attempting problems without prompting', impact_level: 'Moderate' },
      { area: 'Accuracy', observation: 'Strong on one-step equations, struggled with multi-step problems', evidence: '80% accuracy on simple equations, 40% on multi-step', impact_level: 'Moderate' },
      { area: 'Problem Solving', observation: 'Able to apply learned method to similar problems but not novel contexts', evidence: 'Could solve equations but struggled to set up equations from word problems', impact_level: 'Limited progress' }
    ])
  ]);
  logger.info('[SessionQualitySeeder] session_learning_impact seeded');

  // ─── 4. session_parent_summary ───────────────────────────────────────────
  await run(`
    INSERT INTO session_parent_summary 
      (session_id, covered_text, participation_text, progress_text, needs_practice_text, home_support_tips)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      covered_text=VALUES(covered_text), participation_text=VALUES(participation_text),
      progress_text=VALUES(progress_text), needs_practice_text=VALUES(needs_practice_text),
      home_support_tips=VALUES(home_support_tips)
  `, [
    sessionId,
    'Today we worked on Algebra — specifically solving linear equations like "x + 5 = 12" and "2x = 10". We practiced finding the value of x by using inverse operations.',
    'Your child participated well throughout the session. They attempted every problem I presented and showed good effort even when the problems got harder. They seemed more confident by the end of the session.',
    'I noticed good progress with one-step equations — your child can confidently solve problems like "x + 7 = 15". Their understanding of the basic concept is solid.',
    'We need more practice with multi-step problems and especially setting up equations from word problems. This is a common challenge at this level and we will continue working on it.',
    JSON.stringify([
      'Practice 2-3 simple equations each day — even 5 minutes helps build confidence',
      'Ask your child to explain "why" they solved a problem the way they did — teaching reinforces learning',
      'Use everyday situations like "If we have 10 AED and need to buy items that cost x, how many can we buy?" to make algebra relatable'
    ])
  ]);
  logger.info('[SessionQualitySeeder] session_parent_summary seeded');

  // ─── 5. session_coaching_feedback ────────────────────────────────────────
  await run(`
    INSERT INTO session_coaching_feedback 
      (session_id, strengths, areas_to_improve)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      strengths=VALUES(strengths), areas_to_improve=VALUES(areas_to_improve)
  `, [
    sessionId,
    JSON.stringify([
      { strength: 'Excellent scaffolding technique', evidence: 'When student struggled with "2x+3=11", tutor broke it down: "First, what do we need to remove from both sides?"', why_it_matters: 'This approach builds student independence and reduces learned helplessness' },
      { strength: 'Positive and encouraging tone', evidence: 'After every correct answer, tutor said "Great job!" or "Excellent!" — maintained supportive atmosphere throughout', why_it_matters: 'Positive reinforcement increases student confidence and willingness to attempt difficult problems' },
      { strength: 'Good use of wait time', evidence: 'After asking questions, tutor waited 5-7 seconds for student to think before giving hints', why_it_matters: 'Adequate wait time improves depth of student thinking and reduces impulsive responses' }
    ]),
    JSON.stringify([
      { area: 'Session objective should be stated upfront', evidence: 'Session began with "Let\'s start with this problem" without explaining the learning goal', why_it_matters: 'Students learn better when they know what they are expected to learn', recommended_action: 'Start each session with: "Today we will learn how to..."' },
      { area: 'Increase student talk time', evidence: 'Analysis shows tutor spoke approximately 70% of the time', why_it_matters: 'Students need more opportunities to articulate their thinking to deepen understanding', recommended_action: 'After each explanation, ask "Can you explain that back to me in your own words?"' },
      { area: 'Add session closure with summary', evidence: 'Session ended with "OK, see you next time" without reviewing what was learned', why_it_matters: 'Closure helps consolidate learning and identify remaining gaps', recommended_action: 'Reserve last 3 minutes to review key concepts and preview next session' }
    ])
  ]);
  logger.info('[SessionQualitySeeder] session_coaching_feedback seeded');

  // ─── 6. session_better_alternatives ──────────────────────────────────────
  await run(`
    INSERT INTO session_better_alternatives 
      (session_id, items)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE
      items=VALUES(items)
  `, [
    sessionId,
    JSON.stringify([
      {
        situation: 'Student solved "x+5=12" correctly but tutor immediately moved to next problem',
        current_approach: 'Tutor said "Correct, let\'s try the next one" without probing understanding',
        better_alternative: 'Ask "How did you know to subtract 5 from both sides? What happens if we add 5 instead?"',
        purpose: 'Checks conceptual understanding rather than just procedural correctness'
      },
      {
        situation: 'Student struggled with "2x+3=11" and tutor provided the answer after 10 seconds',
        current_approach: 'Tutor: "We subtract 3 from both sides, so 2x=8, then x=4"',
        better_alternative: 'Guide step-by-step: "What operation do we need to undo first? What is happening to x on this side?"',
        purpose: 'Builds problem-solving independence rather than showing the answer'
      },
      {
        situation: 'When student gave wrong answer, tutor said "No, that\'s not right. Try again."',
        current_approach: 'Simply saying "No" without explaining why the answer was wrong',
        better_alternative: '"Let\'s check your answer. If x=3, what does 2(3)+5 equal? Does that match our equation?"',
        purpose: 'Helps student self-correct and understand why their approach didn\'t work'
      }
    ])
  ]);
  logger.info('[SessionQualitySeeder] session_better_alternatives seeded');

  // ─── 7. session_next_plan ────────────────────────────────────────────────
  await run(`
    INSERT INTO session_next_plan 
      (session_id, segments, priority_focus, gaps_to_address)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      segments=VALUES(segments), priority_focus=VALUES(priority_focus),
      gaps_to_address=VALUES(gaps_to_address)
  `, [
    sessionId,
    JSON.stringify([
      { segment: 'Recap / Warm-up', duration: '5 min', plan: 'Review one-step equations with 2-3 quick problems to activate prior knowledge' },
      { segment: 'Concept Reinforcement', duration: '10 min', plan: 'Re-teach solving two-step equations using worked examples: 2x+3=11, 3x-5=10' },
      { segment: 'Guided Practice', duration: '15 min', plan: 'Work through 4 two-step problems together, gradually reducing hints' },
      { segment: 'Independent Practice', duration: '10 min', plan: 'Student solves 2 two-step equations independently with minimal support' },
      { segment: 'Word Problems Introduction', duration: '8 min', plan: 'Introduce simple word problems: "Sarah has x apples, she buys 3 more and has 12. How many did she start with?"' },
      { segment: 'Review & Homework', duration: '2 min', plan: 'Summarize key steps for solving equations, assign 3 practice problems' }
    ]),
    JSON.stringify([
      'Building fluency with two-step equations (e.g., 2x+3=11)',
      'Translating word problems into equations',
      'Checking answers by substituting back into original equation'
    ]),
    JSON.stringify([
      'Setting up equations from word problems',
      'Working with negative coefficients',
      'Multi-step equations requiring two operations'
    ])
  ]);
  logger.info('[SessionQualitySeeder] session_next_plan seeded');

  // ─── 8. session_quality_flags ─────────────────────────────────────────────
  await run(`
    INSERT INTO session_quality_flags 
      (session_id, flags)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE
      flags=VALUES(flags)
  `, [
    sessionId,
    JSON.stringify([
      {
        flag: 'No session objective stated at the beginning',
        severity: 'Medium',
        evidence: 'Session transcript shows no statement of learning goals in the first 5 minutes',
        recommended_fix: 'Always start with "Today we will learn X" — this is a minimum quality standard'
      },
      {
        flag: 'Insufficient wait time on difficult problems',
        severity: 'Low',
        evidence: 'On the multi-step problem, tutor provided the answer after only 10 seconds of student thinking',
        recommended_fix: 'Allow at least 15-20 seconds of think time before giving hints'
      },
      {
        flag: 'No end-of-session summary or closure',
        severity: 'Medium',
        evidence: 'Session ended abruptly — last 30 seconds had no review of what was learned',
        recommended_fix: 'Reserve final 3 minutes to summarize key takeaways and assign practice'
      }
    ])
  ]);
  logger.info('[SessionQualitySeeder] session_quality_flags seeded');

  // ─── 9. session_final_evaluation ──────────────────────────────────────────
  await run(`
    INSERT INTO session_final_evaluation 
      (session_id, overall_session_rating, teacher_performance, student_engagement,
       learning_impact, parent_communication_readiness, recommended_action, summary_narrative)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      overall_session_rating=VALUES(overall_session_rating),
      teacher_performance=VALUES(teacher_performance),
      student_engagement=VALUES(student_engagement),
      learning_impact=VALUES(learning_impact),
      parent_communication_readiness=VALUES(parent_communication_readiness),
      recommended_action=VALUES(recommended_action),
      summary_narrative=VALUES(summary_narrative)
  `, [
    sessionId,
    'Developing (62%)',
    'Developing — strong scaffolding but needs to improve session structure and closure',
    'Moderate — student participated but was not consistently engaged throughout',
    'Moderate — some progress in understanding but gaps remain in application',
    'Partially Ready — parent summary can be shared but needs additional context',
    'Minor Coaching — focus on session structure: objectives, wait time, and closure',
    'Session showed a competent tutor with good content knowledge and excellent rapport with the student. The tutor\'s scaffolding approach was effective and the student showed progress in basic equation solving. However, the session lacked structural elements: no clear objective was stated at the beginning, and there was no closure or summary at the end. The tutor would benefit from coaching on session structure while maintaining their strong instructional delivery and positive rapport. Overall, a Developing session with clear potential for improvement.'
  ]);
  logger.info('[SessionQualitySeeder] session_final_evaluation seeded');

  // ─── 10. rubric evaluations + summary ─────────────────────────────────────
  await seedRubricEvaluations(sessionId);

  logger.info(`[SessionQualitySeeder] Complete for session_id=${sessionId}`);
};

/**
 * Seed rubric evaluations and summary.
 * Gets indicator IDs from the rubric_indicators table.
 */
async function seedRubricEvaluations(sessionId) {
  // Get all rubric indicators
  const indicators = await new Promise((resolve, reject) => {
    db.all('SELECT indicator_id, is_gate FROM rubric_indicators ORDER BY indicator_id', [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });

  if (indicators.length === 0) {
    logger.warn('[SessionQualitySeeder] No rubric indicators found — run rubric seeder first');
    return;
  }

  // Generate ratings — most "Met", some "Partial", a few "Not met"
  const notMetSet = new Set(['B2.3', 'G1.3', 'F3.2', 'C3.3']);
  const partialSet = new Set(['A2.3', 'A4.1', 'B3.1', 'C1.2', 'C3.1', 'D2.2', 'D4.2', 'E1.1', 'F1.3', 'H1.2']);
  const highConfSet = new Set(['A1.1', 'A3.1', 'B2.1', 'G2.2', 'G3.1']);

  for (const ind of indicators) {
    let rating, confidence;
    if (notMetSet.has(ind.indicator_id)) {
      rating = 'Not met';
      confidence = 'High';
    } else if (partialSet.has(ind.indicator_id)) {
      rating = 'Partial';
      confidence = 'Medium';
    } else {
      rating = 'Met';
      confidence = highConfSet.has(ind.indicator_id) ? 'High' : 'Medium';
    }

    await run(`
      INSERT INTO session_rubric_evaluations 
        (session_id, indicator_id, rating, evidence_text, comment, evaluated_by, confidence)
      VALUES (?, ?, ?, ?, ?, 'AI', ?)
      ON DUPLICATE KEY UPDATE
        rating=VALUES(rating), evidence_text=VALUES(evidence_text),
        comment=VALUES(comment), confidence=VALUES(confidence)
    `, [
      sessionId,
      ind.indicator_id,
      rating,
      generateEvidence(ind.indicator_id, rating),
      generateComment(ind.indicator_id, rating),
      confidence
    ]);
  }

  // Summary — compute from actual ratings
  const summary = await computeSummary(sessionId);
  await run(`
    INSERT INTO session_rubric_summary 
      (session_id, weighted_score_pct, gate_status, overall_rating, confidence_level)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      weighted_score_pct=VALUES(weighted_score_pct),
      gate_status=VALUES(gate_status),
      overall_rating=VALUES(overall_rating),
      confidence_level=VALUES(confidence_level)
  `, [
    sessionId,
    summary.weighted_score_pct,
    summary.gate_status,
    summary.overall_rating,
    'Medium — transcript-based; video/audio not available'
  ]);

  logger.info(`[SessionQualitySeeder] Rubric evaluations seeded (${indicators.length} indicators)`);
}

async function computeSummary(sessionId) {
  const rows = await new Promise((resolve, reject) => {
    db.all(`
      SELECT sre.indicator_id, sre.rating, ri.category_id, rc.weight as category_weight,
             ri.value as indicator_weight, ri.is_gate
      FROM session_rubric_evaluations sre
      JOIN rubric_indicators ri ON sre.indicator_id = ri.indicator_id
      JOIN rubric_categories rc ON ri.category_id = rc.category_id
      WHERE sre.session_id = ?
    `, [sessionId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });

  const ratingScores = { 'Met': 1.0, 'Partial': 0.5, 'Not met': 0.0, 'N/A': null };
  const categoryScores = {};
  const categoryWeights = {};
  let allGatesPassed = true;

  for (const row of rows) {
    const catId = row.category_id;
    categoryWeights[catId] = row.category_weight;
    if (!categoryScores[catId]) {
      categoryScores[catId] = { totalScore: 0, totalWeight: 0, gatesPassed: true };
    }

    const score = ratingScores[row.rating];
    if (score !== null) {
      categoryScores[catId].totalScore += score * (row.indicator_weight || 1);
      categoryScores[catId].totalWeight += (row.indicator_weight || 1);
    }

    if (row.is_gate && row.rating !== 'Met') {
      categoryScores[catId].gatesPassed = false;
      allGatesPassed = false;
    }
  }

  let totalWeightedScore = 0;
  let totalWeight = 0;
  for (const [catId, data] of Object.entries(categoryScores)) {
    const catWeight = categoryWeights[catId] || 0;
    if (data.totalWeight > 0) {
      totalWeightedScore += (data.totalScore / data.totalWeight) * catWeight;
      totalWeight += catWeight;
    }
  }

  const weightedScorePct = totalWeight > 0
    ? Math.round((totalWeightedScore / totalWeight) * 10000) / 100
    : 0;

  let overallRating;
  if (weightedScorePct >= 80) overallRating = 'Exemplary';
  else if (weightedScorePct >= 60) overallRating = 'Proficient';
  else if (weightedScorePct >= 40) overallRating = 'Developing';
  else overallRating = 'Needs Improvement';

  return {
    weighted_score_pct: weightedScorePct,
    gate_status: allGatesPassed ? 'all_passed' : 'gate_failed',
    overall_rating: overallRating
  };
}

function generateEvidence(indicatorId, rating) {
  const evidenceMap = {
    'A1.1': { 'Met': 'Tutor said "Let\'s learn how to solve equations" in first minute' },
    'A3.1': { 'Met': 'All mathematical explanations were accurate and clear' },
    'B2.1': { 'Met': 'No factual errors observed in any explanation' },
    'B2.2': { 'Met': 'Terms like "coefficient", "inverse operation", "variable" used correctly' },
    'B2.3': { 'Not met': 'Tutor did not acknowledge an error when it occurred' },
    'C3.1': { 'Partial': 'Some positive reinforcement used but inconsistent' },
    'E1.1': { 'Partial': 'Pacing was generally appropriate but sometimes rushed through difficult concepts' },
    'F3.2': { 'Not met': 'Wait time after questions was less than 3 seconds on several occasions' },
    'G1.3': { 'Not met': 'Unable to assess body language from transcript' },
    'C3.3': { 'Not met': 'No evidence of recognizing or addressing student frustration' }
  };
  return (evidenceMap[indicatorId] && evidenceMap[indicatorId][rating]) || 
         `${rating} — evidence from transcript analysis`;
}

function generateComment(indicatorId, rating) {
  const comments = {
    'A1.3': { 'Met': 'Practice activities directly reinforced the taught concept' },
    'A3.2': { 'Met': 'Examples were appropriate for Grade 7 level' },
    'B1.2': { 'Met': 'Content followed typical IGCSE Algebra scope and sequence' },
    'D2.1': { 'Met': 'Feedback was provided immediately after each student response' },
    'F4.2': { 'Met': 'Student had adequate opportunities to speak' }
  };
  return (comments[indicatorId] && comments[indicatorId][rating]) || 
         `Indicator ${indicatorId}: ${rating}`;
}

module.exports = { seedSessionQuality };

// Run seeder if executed directly
if (require.main === module) {
  seedSessionQuality()
    .then(() => {
      console.log('[Seed] ✓ Session quality seeder completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Seed] ✗ Session quality seeder failed:', err);
      process.exit(1);
    });
}
