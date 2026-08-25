/**
 * root/services/sessionQualityGenerator.js
 *
 * Generation pipeline for the Session Quality & Impact Report.
 *
 * DESIGN DECISION: Single LLM call vs. multiple calls
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * We use ONE large LLM call with the full transcript + rubric as input.
 * Rationale:
 *   1. The existing prompt (prompts/academic-quality-analysis.prompt.md) already
 *      asks for all 10 sections in one structured output â€” the LLM is designed
 *      to produce a coherent report where sections reference each other.
 *   2. A single call ensures cross-section consistency (e.g., the same evidence
 *      appears in both rubric evaluation and coaching feedback).
 *   3. Fewer API calls = lower latency, lower cost, fewer failure points.
 *   4. The risk of malformed JSON is mitigated by validation before writing.
 *
 * SCORE CALCULATION (code, not LLM):
 *   The rubric summary (weighted_score_pct, gate_status, overall_rating) is
 *   computed from individual indicator ratings using rubric weights.
 *   This ensures the math is trustworthy and auditable.
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const settings = require('../config/settings');
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

// â”€â”€ Models â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const RubricEvaluationModel = require('../models/rubrics/RubricEvaluationModel');
const RubricSummaryModel = require('../models/rubrics/RubricSummaryModel');
const SessionSnapshotModel = require('../models/session-quality/SessionSnapshotModel');
const SessionAnalysisModel = require('../models/session-quality/SessionAnalysisModel');
const SessionLearningImpactModel = require('../models/session-quality/SessionLearningImpactModel');
const SessionParentSummaryModel = require('../models/session-quality/SessionParentSummaryModel');
const SessionCoachingFeedbackModel = require('../models/session-quality/SessionCoachingFeedbackModel');
const SessionBetterAlternativesModel = require('../models/session-quality/SessionBetterAlternativesModel');
const SessionNextPlanModel = require('../models/session-quality/SessionNextPlanModel');
const SessionQualityFlagsModel = require('../models/session-quality/SessionQualityFlagsModel');
const SessionFinalEvaluationModel = require('../models/session-quality/SessionFinalEvaluationModel');

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Resolve the transcript text for a given session_id.
 * Looks up meeting_sessions for the transcript_file_name, then reads the file.
 */
async function getTranscriptText(sessionId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT meeting_id, transcript_file_name FROM meeting_sessions WHERE id = ?',
      [sessionId],
      (err, row) => {
        if (err) return reject(err);
        if (!row || !row.transcript_file_name) {
          return reject(new Error(`No transcript file found for session ${sessionId}`));
        }

        const transcriptPath = path.resolve(
          __dirname, '..', 'storage', 'transcripts', row.transcript_file_name
        );

        if (!fs.existsSync(transcriptPath)) {
          return reject(new Error(`Transcript file not found on disk: ${transcriptPath}`));
        }

        try {
          const text = fs.readFileSync(transcriptPath, 'utf-8');
          resolve({ text, meetingId: row.meeting_id });
        } catch (e) {
          reject(new Error(`Failed to read transcript file: ${e.message}`));
        }
      }
    );
  });
}

/**
 * Fetch the full rubric definition (categories + indicators with weights/benchmarks).
 */
async function getFullRubric() {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        rc.id AS category_id, rc.name AS category_name, rc.weight AS category_weight,
        ri.indicator_code AS indicator_id, ri.name AS indicator_name, ri.type, ri.is_gate,
        ri.value AS indicator_weight, ri.benchmark, ri.requires_video
      FROM rubric_categories rc
      JOIN rubric_indicators ri ON ri.category_id = rc.id
      ORDER BY rc.id, ri.indicator_code
    `;
    db.all(sql, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

/**
 * Call the LLM with the transcript + rubric, requesting structured JSON output.
 * Uses the same provider fallback pattern as the existing bot code.
 */
async function callLLM(transcriptText, rubricJson) {
  const promptPath = path.resolve(__dirname, '..', 'prompts', 'academic-quality-analysis.prompt.md');
  const promptTemplate = fs.readFileSync(promptPath, 'utf-8');

  // Build the system prompt
  const systemPrompt = promptTemplate
    .replace('[PASTE RUBRIC JSON HERE]', JSON.stringify(rubricJson, null, 2))
    .replace('[PASTE SESSION TRANSCRIPT HERE]', transcriptText);

  // Add a final instruction to output ONLY valid JSON matching the expected schema
  const userMessage = `${systemPrompt}

---

IMPORTANT â€” OUTPUT FORMAT:

You MUST respond with ONLY a valid JSON object (no markdown, no code fences, no extra text)
that matches the following structure exactly. Every field is required.

{
  "session_snapshot": {
    "student_grade": "Grade 7",
    "curriculum": "IGCSE",
    "location": "UAE",
    "subject": "string",
    "topics_covered": ["string"],
    "session_objective_status": "string",
    "overall_score_pct": null,
    "overall_rating": "string",
    "student_engagement": "string",
    "learning_impact": "string",
    "parent_shareability": "string",
    "executive_summary": "string"
  },
  "rubric_evaluations": [
    {
      "indicator_id": "string",
      "rating": "Met|Partial|Not met|N/A",
      "evidence_text": "string",
      "comment": "string",
      "confidence": "High|Medium|Low"
    }
  ],
  "session_analysis": {
    "what_worked_well": ["string"],
    "what_needs_improvement": ["string"],
    "missed_opportunities": ["string"]
  },
  "session_learning_impact": {
    "impact_areas": [
      {
        "area": "string",
        "observation": "string",
        "evidence": "string",
        "impact_level": "Strong|Moderate|Limited progress"
      }
    ]
  },
  "session_parent_summary": {
    "covered_text": "string",
    "participation_text": "string",
    "progress_text": "string",
    "needs_practice_text": "string",
    "home_support_tips": ["string"]
  },
  "session_coaching_feedback": {
    "strengths": [
      { "strength": "string", "evidence": "string", "why_it_matters": "string" }
    ],
    "areas_to_improve": [
      { "area": "string", "evidence": "string", "why_it_matters": "string", "recommended_action": "string" }
    ]
  },
  "session_better_alternatives": {
    "items": [
      { "situation": "string", "current_approach": "string", "better_alternative": "string", "purpose": "string" }
    ]
  },
  "session_next_plan": {
    "segments": [
      { "segment": "string", "duration": "string", "plan": "string" }
    ],
    "priority_focus": ["string"],
    "gaps_to_address": ["string"]
  },
  "session_quality_flags": {
    "flags": [
      { "flag": "string", "severity": "High|Medium|Low", "evidence": "string", "recommended_fix": "string" }
    ]
  },
  "session_final_evaluation": {
    "overall_session_rating": "string",
    "teacher_performance": "string",
    "student_engagement": "string",
    "learning_impact": "string",
    "parent_communication_readiness": "string",
    "recommended_action": "string",
    "summary_narrative": "string"
  }
}

For rubric_evaluations, include ONE entry per indicator_id from the rubric.
For rating, use exactly: "Met", "Partial", "Not met", or "N/A".
For impact_level, use exactly: "Strong", "Moderate", or "Limited progress".
For severity, use exactly: "High", "Medium", or "Low".
For confidence, use exactly: "High", "Medium", or "Low".
`;

  // Try providers in priority order
  const providers = [...new Set([settings.ai.provider, 'cloude', 'openai'])].filter(p => p);

  for (const provider of providers) {
    try {
      logger.info(`[SessionQualityGenerator] Calling LLM with provider: ${provider}`);

      let apiUrl, apiKey, model;
      if (provider === 'openai') {
        apiUrl = 'https://api.openai.com/v1/chat/completions';
        apiKey = settings.ai.openaiApiKey;
        model = settings.ai.openaiModel;
      } else if (provider === 'cloude') {
        apiUrl = 'https://api.cloude.com/openai/v1/chat/completions';
        apiKey = settings.ai.cloudeApiKey;
        model = settings.ai.cloudeModel;
      } else {
        continue;
      }

      const response = await axios.post(apiUrl, {
        model,
        messages: [
          { role: 'system', content: 'You are an expert Academic Quality Analyst. You output ONLY valid JSON.' },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.1,
        max_tokens: 16000,
        response_format: { type: 'json_object' }
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 180000 // 3 minutes for large generation
      });

      const content = response.data.choices[0].message.content;
      logger.info(`[SessionQualityGenerator] LLM response received (${content.length} chars)`);

      // Parse and validate
      const parsed = JSON.parse(content);
      return parsed;

    } catch (error) {
      const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
      logger.warn(`[SessionQualityGenerator] ${provider} failed: ${errorMsg}. Trying next...`);
    }
  }

  throw new Error('All LLM providers failed to generate the report');
}

/**
 * Validate the LLM response has the expected structure.
 * Throws if critical sections are missing.
 */
function validateLLMResponse(data) {
  const requiredSections = [
    'session_snapshot',
    'rubric_evaluations',
    'session_analysis',
    'session_learning_impact',
    'session_parent_summary',
    'session_coaching_feedback',
    'session_better_alternatives',
    'session_next_plan',
    'session_quality_flags',
    'session_final_evaluation'
  ];

  for (const section of requiredSections) {
    if (!data[section]) {
      throw new Error(`Validation failed: missing section "${section}"`);
    }
  }

  // Validate rubric_evaluations is an array with at least some entries
  if (!Array.isArray(data.rubric_evaluations) || data.rubric_evaluations.length === 0) {
    throw new Error('Validation failed: rubric_evaluations must be a non-empty array');
  }

  // Validate each evaluation has required fields
  for (const ev of data.rubric_evaluations) {
    if (!ev.indicator_id || !ev.rating) {
      throw new Error(`Validation failed: rubric_evaluation missing indicator_id or rating`);
    }
    if (!['Met', 'Partial', 'Not met', 'N/A'].includes(ev.rating)) {
      throw new Error(`Validation failed: invalid rating "${ev.rating}" for ${ev.indicator_id}`);
    }
  }

  logger.info('[SessionQualityGenerator] LLM response validated successfully');
  return true;
}

/**
 * Compute the rubric summary from individual indicator ratings.
 * This is done in CODE, not by the LLM, so the math is trustworthy.
 *
 * @param {Array} evaluations â€” Array of { indicator_id, rating, ... }
 * @param {Array} rubricRows  â€” Full rubric definition rows from DB
 * @returns {Object} { weighted_score_pct, gate_status, overall_rating, confidence_level }
 */
function computeRubricSummary(evaluations, rubricRows) {
  // Build a lookup: indicator_id -> { category_id, category_weight, indicator_weight, is_gate }
  const indicatorMap = {};
  const categoryWeights = {};

  for (const row of rubricRows) {
    indicatorMap[row.indicator_id] = {
      category_id: row.category_id,
      category_weight: row.category_weight,
      indicator_weight: row.indicator_weight || 1,
      is_gate: row.is_gate === 1 || row.is_gate === true
    };
    categoryWeights[row.category_id] = row.category_weight;
  }

  // Rating to numeric score mapping
  const ratingScores = { 'Met': 1.0, 'Partial': 0.5, 'Not met': 0.0, 'N/A': null };

  // Group evaluations by category
  const categoryScores = {};
  let totalWeightedScore = 0;
  let totalWeight = 0;
  let allGatesPassed = true;
  let gateResults = [];

  for (const ev of evaluations) {
    const meta = indicatorMap[ev.indicator_id];
    if (!meta) {
      logger.warn(`[ScoreCalc] Unknown indicator: ${ev.indicator_id}, skipping`);
      continue;
    }

    const score = ratingScores[ev.rating];
    if (score === null) continue; // Skip N/A

    const catId = meta.category_id;
    if (!categoryScores[catId]) {
      categoryScores[catId] = { totalScore: 0, totalWeight: 0, gatesPassed: true };
    }

    categoryScores[catId].totalScore += score * meta.indicator_weight;
    categoryScores[catId].totalWeight += meta.indicator_weight;

    // Check gate indicators
    if (meta.is_gate) {
      const gatePassed = ev.rating === 'Met';
      if (!gatePassed) {
        categoryScores[catId].gatesPassed = false;
        allGatesPassed = false;
        gateResults.push({ indicator: ev.indicator_id, passed: false, rating: ev.rating });
      } else {
        gateResults.push({ indicator: ev.indicator_id, passed: true, rating: ev.rating });
      }
    }
  }

  // Compute weighted score across categories
  for (const [catId, data] of Object.entries(categoryScores)) {
    const catWeight = categoryWeights[catId] || 0;
    if (data.totalWeight > 0) {
      const catPct = data.totalScore / data.totalWeight; // 0..1
      totalWeightedScore += catPct * catWeight;
      totalWeight += catWeight;
    }
  }

  const weightedScorePct = totalWeight > 0
    ? Math.round((totalWeightedScore / totalWeight) * 10000) / 100
    : 0;

  // Gate status
  const gateStatus = allGatesPassed ? 'all_passed' : 'gate_failed';

  // Overall rating based on score
  let overallRating;
  if (weightedScorePct >= 80) overallRating = 'Exemplary';
  else if (weightedScorePct >= 60) overallRating = 'Proficient';
  else if (weightedScorePct >= 40) overallRating = 'Developing';
  else overallRating = 'Needs Improvement';

  const confidenceLevel = 'Medium â€” transcript-based; video/audio not available';

  return {
    weighted_score_pct: weightedScorePct,
    gate_status: gateStatus,
    overall_rating: overallRating,
    confidence_level: confidenceLevel,
    gate_results: gateResults
  };
}

/**
 * Run the full generation pipeline for a session.
 *
 * @param {number} sessionId â€” The meeting_sessions.id
 * @param {string} meetingId â€” The meetings.meeting_id (for logging/context)
 * @returns {Object} Summary of what was written
 */
async function generateSessionQualityReport(sessionId, meetingId) {
  logger.info(`[SessionQualityGenerator] Starting pipeline for session=${sessionId}, meeting=${meetingId}`);

  // Step 1: Fetch transcript
  const { text: transcriptText } = await getTranscriptText(sessionId);
  logger.info(`[SessionQualityGenerator] Transcript loaded (${transcriptText.length} chars)`);

  // Step 2: Fetch full rubric definition
  const rubricRows = await getFullRubric();
  logger.info(`[SessionQualityGenerator] Rubric loaded (${rubricRows.length} indicators)`);

  // Step 3: Build rubric JSON for the LLM
  const rubricForLLM = buildRubricForLLM(rubricRows);

  // Step 4: Call LLM
  const llmData = await callLLM(transcriptText, rubricForLLM);

  // Step 5: Validate LLM response
  validateLLMResponse(llmData);

  // Step 6: Compute rubric summary in code (trustworthy math)
  const rubricSummary = computeRubricSummary(llmData.rubric_evaluations, rubricRows);
  logger.info(`[SessionQualityGenerator] Score computed: ${rubricSummary.weighted_score_pct}%, gate=${rubricSummary.gate_status}`);

  // Step 7: Write all data in a single transaction
  const writeResults = await writeAllSections(sessionId, llmData, rubricSummary);

  logger.info(`[SessionQualityGenerator] Pipeline complete for session=${sessionId}`);
  return writeResults;
}

/**
 * Build a rubric JSON structure suitable for the LLM prompt.
 */
function buildRubricForLLM(rubricRows) {
  const categories = {};
  for (const row of rubricRows) {
    if (!categories[row.category_id]) {
      categories[row.category_id] = {
        category_id: row.category_id,
        name: row.category_name,
        weight: row.category_weight,
        indicators: []
      };
    }
    categories[row.category_id].indicators.push({
      indicator_id: row.indicator_id,
      name: row.indicator_name,
      type: row.type,
      is_gate: row.is_gate === 1 || row.is_gate === true,
      value: row.indicator_weight || 1,
      benchmark: row.benchmark || '',
      requires_video: row.requires_video === 1 || row.requires_video === true
    });
  }
  return Object.values(categories);
}

/**
 * Write all 10 sections to the database in a single transaction.
 */
async function writeAllSections(sessionId, llmData, rubricSummary) {
  return new Promise((resolve, reject) => {
    db.run('BEGIN TRANSACTION', async (beginErr) => {
      if (beginErr) return reject(beginErr);

      try {
        const results = {};

        // 1. Rubric evaluations (bulk upsert)
        const evaluations = llmData.rubric_evaluations.map(ev => ({
          session_id: sessionId,
          indicator_id: ev.indicator_id,
          rating: ev.rating,
          evidence_text: ev.evidence_text || null,
          comment: ev.comment || null,
          evaluated_by: 'AI',
          confidence: ev.confidence || 'Medium'
        }));
        const evalResult = await RubricEvaluationModel.bulkInsert(evaluations);
        results.rubric_evaluations = { count: evaluations.length, errors: evalResult.errors?.length || 0 };

        // 2. Rubric summary
        const summaryResult = await RubricSummaryModel.upsert({
          session_id: sessionId,
          weighted_score_pct: rubricSummary.weighted_score_pct,
          gate_status: rubricSummary.gate_status,
          overall_rating: rubricSummary.overall_rating,
          confidence_level: rubricSummary.confidence_level
        });
        results.rubric_summary = summaryResult;

        // 3. Session snapshot
        const snap = llmData.session_snapshot;
        snap.overall_score_pct = rubricSummary.weighted_score_pct; // Use computed score
        await SessionSnapshotModel.upsert({
          session_id: sessionId,
          ...snap
        });
        results.session_snapshot = { written: true };

        // 4. Session analysis
        await SessionAnalysisModel.upsert({
          session_id: sessionId,
          what_worked_well: llmData.session_analysis.what_worked_well || [],
          what_needs_improvement: llmData.session_analysis.what_needs_improvement || [],
          missed_opportunities: llmData.session_analysis.missed_opportunities || []
        });
        results.session_analysis = { written: true };

        // 5. Learning impact
        await SessionLearningImpactModel.upsert({
          session_id: sessionId,
          impact_areas: llmData.session_learning_impact.impact_areas || []
        });
        results.session_learning_impact = { written: true };

        // 6. Parent summary
        await SessionParentSummaryModel.upsert({
          session_id: sessionId,
          covered_text: llmData.session_parent_summary.covered_text || '',
          participation_text: llmData.session_parent_summary.participation_text || '',
          progress_text: llmData.session_parent_summary.progress_text || '',
          needs_practice_text: llmData.session_parent_summary.needs_practice_text || '',
          home_support_tips: llmData.session_parent_summary.home_support_tips || []
        });
        results.session_parent_summary = { written: true };

        // 7. Coaching feedback
        await SessionCoachingFeedbackModel.upsert({
          session_id: sessionId,
          strengths: llmData.session_coaching_feedback.strengths || [],
          areas_to_improve: llmData.session_coaching_feedback.areas_to_improve || []
        });
        results.session_coaching_feedback = { written: true };

        // 8. Better alternatives
        await SessionBetterAlternativesModel.upsert({
          session_id: sessionId,
          items: llmData.session_better_alternatives.items || []
        });
        results.session_better_alternatives = { written: true };

        // 9. Next plan
        await SessionNextPlanModel.upsert({
          session_id: sessionId,
          segments: llmData.session_next_plan.segments || [],
          priority_focus: llmData.session_next_plan.priority_focus || [],
          gaps_to_address: llmData.session_next_plan.gaps_to_address || []
        });
        results.session_next_plan = { written: true };

        // 10. Quality flags
        await SessionQualityFlagsModel.upsert({
          session_id: sessionId,
          flags: llmData.session_quality_flags.flags || []
        });
        results.session_quality_flags = { written: true };

        // 11. Final evaluation
        await SessionFinalEvaluationModel.upsert({
          session_id: sessionId,
          overall_session_rating: llmData.session_final_evaluation.overall_session_rating || '',
          teacher_performance: llmData.session_final_evaluation.teacher_performance || '',
          student_engagement: llmData.session_final_evaluation.student_engagement || '',
          learning_impact: llmData.session_final_evaluation.learning_impact || '',
          parent_communication_readiness: llmData.session_final_evaluation.parent_communication_readiness || '',
          recommended_action: llmData.session_final_evaluation.recommended_action || '',
          summary_narrative: llmData.session_final_evaluation.summary_narrative || ''
        });
        results.session_final_evaluation = { written: true };

        // Commit
        db.run('COMMIT', (commitErr) => {
          if (commitErr) {
            logger.error('[SessionQualityGenerator] Commit failed, rolling back', commitErr);
            return db.run('ROLLBACK', () => reject(commitErr));
          }
          logger.info('[SessionQualityGenerator] Transaction committed successfully');
          resolve(results);
        });

      } catch (writeErr) {
        logger.error('[SessionQualityGenerator] Write error, rolling back', writeErr);
        db.run('ROLLBACK', () => reject(writeErr));
      }
    });
  });
}

module.exports = { generateSessionQualityReport };
