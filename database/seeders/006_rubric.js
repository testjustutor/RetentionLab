/**
 * root/database/seeders/006_rubric.js
 * Seeds the rubric categories and indicators
 */
const { db } = require('../db');
const { logger } = require('../../utils/logger');

// Lowercase true/false is required for JavaScript
// Each indicator now includes a default 'value' (weightage)
const rubricData = {
    "A": {
        "name": "Instructional Quality & Pedagogy", "weight": 0.22, "indicators": {
            "A1.1": { "name": "Opening states purpose/objective", "type": "AI", "gate": false, "value": 1, "benchmark": "Tutor should state session objective at start.", "requires_video": false },
            "A1.2": { "name": "Instruction follows logical sequence", "type": "AI", "gate": false, "value": 1, "benchmark": "Content progresses from simple to complex in logical order.", "requires_video": false },
            "A1.3": { "name": "Practice activities align to instruction", "type": "AI", "gate": false, "value": 1, "benchmark": "Practice tasks directly reinforce the taught concept.", "requires_video": false },
            "A1.4": { "name": "Session includes meaningful closure", "type": "AI", "gate": false, "value": 1, "benchmark": "Session ends with summary or check for understanding.", "requires_video": false },
            "A2.1": { "name": "Uses evidence-based strategy", "type": "AI", "gate": false, "value": 1, "benchmark": "Instructional approach is supported by research.", "requires_video": false },
            "A2.2": { "name": "Modeling precedes guided practice", "type": "AI", "gate": false, "value": 1, "benchmark": "Tutor demonstrates skill before student attempts it.", "requires_video": false },
            "A2.3": { "name": "Strategy matches learning objective", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Chosen method directly supports the stated goal.", "requires_video": false },
            "A2.4": { "name": "Adjusts strategy based on learner response", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Tutor modifies approach when student shows confusion.", "requires_video": false },
            "A3.1": { "name": "Explanations accurate and clear", "type": "AI", "gate": true, "value": 1, "benchmark": "Information presented is correct and easy to follow.", "requires_video": false },
            "A3.2": { "name": "Examples are age/level appropriate", "type": "AI", "gate": false, "value": 1, "benchmark": "Illustrations match student's grade and ability.", "requires_video": false },
            "A3.3": { "name": "Uses think-alouds/worked examples", "type": "AI", "gate": false, "value": 1, "benchmark": "Tutor verbalizes problem-solving process.", "requires_video": false },
            "A3.4": { "name": "Avoids cognitive overload", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Information presented in manageable chunks.", "requires_video": false },
            "A4.1": { "name": "Instruction adjusted to learner level", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Pacing and complexity match student's current level.", "requires_video": false },
            "A4.2": { "name": "Uses prompts or cues to support", "type": "AI", "gate": false, "value": 1, "benchmark": "Hints guide student toward correct answer.", "requires_video": false },
            "A4.3": { "name": "Gradual release of responsibility observed", "type": "AI", "gate": false, "value": 1, "benchmark": "Support fades as student demonstrates independence.", "requires_video": false },
            "A4.4": { "name": "Support provided when learner struggles", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Additional help offered when student shows difficulty.", "requires_video": false }
        }
    },
    "B": {
        "name": "Curriculum Alignment & Accuracy", "weight": 0.15, "indicators": {
            "B1.1": { "name": "Objective aligns to curriculum", "type": "AI", "gate": false, "value": 1, "benchmark": "Session objective matches grade-level standards.", "requires_video": false },
            "B1.2": { "name": "Content matches scope & sequence", "type": "AI", "gate": false, "value": 1, "benchmark": "Topics follow the planned curriculum sequence.", "requires_video": false },
            "B1.3": { "name": "No off-grade/irrelevant content", "type": "AI", "gate": false, "value": 1, "benchmark": "All content is on-grade level and relevant.", "requires_video": false },
            "B2.1": { "name": "No factual/conceptual errors", "type": "AI", "gate": true, "value": 1, "benchmark": "Information presented is factually accurate.", "requires_video": false },
            "B2.2": { "name": "Terminology used correctly", "type": "AI", "gate": true, "value": 1, "benchmark": "Subject-specific terms are used properly.", "requires_video": false },
            "B2.3": { "name": "Corrects own mistakes", "type": "HUMAN", "gate": true, "value": 1, "benchmark": "Tutor acknowledges and fixes errors immediately.", "requires_video": false },
            "B3.1": { "name": "Adequate depth for learner level", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Complexity is appropriate for student's grade.", "requires_video": false },
            "B3.2": { "name": "Avoids unnecessary digressions", "type": "AI", "gate": false, "value": 1, "benchmark": "Discussion stays focused on the objective.", "requires_video": false },
            "B3.3": { "name": "Maintains focus on objective", "type": "AI", "gate": false, "value": 1, "benchmark": "All activities connect to the learning goal.", "requires_video": false },
            "B4.1": { "name": "Tasks support objective", "type": "AI", "gate": false, "value": 1, "benchmark": "Assignments directly practice the target skill.", "requires_video": false },
            "B4.2": { "name": "Materials are grade-appropriate", "type": "AI", "gate": false, "value": 1, "benchmark": "Resources match student's reading and skill level.", "requires_video": false },
            "B4.3": { "name": "Resources used effectively", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Materials enhance rather than distract from learning.", "requires_video": false }
        }
    },
    "C": {
        "name": "Learner Engagement & Responsiveness", "weight": 0.14, "indicators": {
            "C1.1": { "name": "Learner required to think/respond", "type": "AI", "gate": false, "value": 1, "benchmark": "Student actively participates in learning activities.", "requires_video": false },
            "C1.2": { "name": "Questions promote reasoning", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Questions require explanation, not just recall.", "requires_video": false },
            "C1.3": { "name": "Opportunities for application provided", "type": "AI", "gate": false, "value": 1, "benchmark": "Student applies knowledge through practice tasks.", "requires_video": false },
            "C2.1": { "name": "Learner remains on-task", "type": "AI", "gate": false, "value": 1, "benchmark": "Student stays focused on assigned activities.", "requires_video": true },
            "C2.2": { "name": "Instructor monitors engagement", "type": "AI", "gate": false, "value": 1, "benchmark": "Tutor checks student understanding regularly.", "requires_video": true },
            "C2.3": { "name": "Off-task behavior addressed", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Tutor redirects student when attention drifts.", "requires_video": true },
            "C3.1": { "name": "Positive reinforcement used", "type": "AI", "gate": false, "value": 1, "benchmark": "Tutor acknowledges student effort and progress.", "requires_video": true },
            "C3.2": { "name": "Instructor tone is encouraging", "type": "AI", "gate": false, "value": 1, "benchmark": "Voice conveys support and confidence in student.", "requires_video": true },
            "C3.3": { "name": "Responds to learner frustration", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Tutor recognizes and addresses student emotions.", "requires_video": true },
            "C4.1": { "name": "Acknowledges learner responses", "type": "AI", "gate": false, "value": 1, "benchmark": "Tutor confirms receipt of student input.", "requires_video": false },
            "C4.2": { "name": "Adjusts instruction based on input", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Teaching changes in response to student feedback.", "requires_video": false },
            "C4.3": { "name": "Follows up on incorrect responses", "type": "AI", "gate": false, "value": 1, "benchmark": "Errors are addressed and clarified.", "requires_video": false }
        }
    },
    "D": {
        "name": "Assessment & Feedback Quality", "weight": 0.12, "indicators": {
            "D1.1": { "name": "Checks for understanding embedded", "type": "AI", "gate": false, "value": 1, "benchmark": "Tutor verifies comprehension throughout session.", "requires_video": false },
            "D1.2": { "name": "Questions/tasks used diagnostically", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Assessments reveal student thinking process.", "requires_video": false },
            "D1.3": { "name": "Assessment aligned to objective", "type": "AI", "gate": false, "value": 1, "benchmark": "Checks directly measure the learning goal.", "requires_video": false },
            "D2.1": { "name": "Feedback is timely", "type": "AI", "gate": false, "value": 1, "benchmark": "Corrections given immediately after errors.", "requires_video": false },
            "D2.2": { "name": "Feedback is specific/actionable", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Feedback tells student what to improve and how.", "requires_video": false },
            "D2.3": { "name": "Feedback focuses on process", "type": "AI", "gate": false, "value": 1, "benchmark": "Comments address how to improve, not just outcome.", "requires_video": false },
            "D3.1": { "name": "Errors identified correctly", "type": "AI", "gate": false, "value": 1, "benchmark": "Mistakes are recognized and explained.", "requires_video": false },
            "D3.2": { "name": "Misconceptions explicitly addressed", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Root causes of errors are clarified.", "requires_video": false },
            "D3.3": { "name": "Corrective feedback is respectful", "type": "AI", "gate": false, "value": 1, "benchmark": "Corrections maintain student dignity.", "requires_video": true },
            "D4.1": { "name": "Tracks performance during session", "type": "AI", "gate": false, "value": 1, "benchmark": "Tutor monitors progress toward objective.", "requires_video": false },
            "D4.2": { "name": "Adjusts pacing based on progress", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Speed changes based on student mastery.", "requires_video": false },
            "D4.3": { "name": "Uses evidence for next steps", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Future planning is based on session observations.", "requires_video": false }
        }
    },
    "E": {
        "name": "Classroom Management & Pacing", "weight": 0.10, "indicators": {
            "E1.1": { "name": "Pacing appropriate for learner", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Speed matches student's processing ability.", "requires_video": false },
            "E1.2": { "name": "Time allocated proportionally", "type": "AI", "gate": false, "value": 1, "benchmark": "Activities receive appropriate time allocation.", "requires_video": false },
            "E1.3": { "name": "No prolonged idle time", "type": "AI", "gate": false, "value": 1, "benchmark": "Learning continues without unnecessary pauses.", "requires_video": false },
            "E2.1": { "name": "Instructor maintains control", "type": "AI", "gate": false, "value": 1, "benchmark": "Tutor directs session effectively.", "requires_video": true },
            "E2.2": { "name": "Clear directions provided", "type": "AI", "gate": false, "value": 1, "benchmark": "Instructions are easy to understand and follow.", "requires_video": false },
            "E2.3": { "name": "Manages disruptions effectively", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Interruptions handled without losing instructional time.", "requires_video": true },
            "E3.1": { "name": "Smooth transitions", "type": "AI", "gate": false, "value": 1, "benchmark": "Movement between activities is seamless.", "requires_video": false },
            "E3.2": { "name": "Maintains instructional momentum", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Session progresses without losing focus.", "requires_video": false },
            "E3.3": { "name": "Minimizes downtime", "type": "AI", "gate": false, "value": 1, "benchmark": "Non-instructional time is minimized.", "requires_video": false },
            "E4.1": { "name": "Instructional time maximized", "type": "AI", "gate": false, "value": 1, "benchmark": "Majority of time spent on learning activities.", "requires_video": false },
            "E4.2": { "name": "Minimal off-task talk", "type": "AI", "gate": false, "value": 1, "benchmark": "Conversation stays focused on learning.", "requires_video": false },
            "E4.3": { "name": "Administrative tasks minimized", "type": "AI", "gate": false, "value": 1, "benchmark": "Paperwork and logistics kept to minimum.", "requires_video": false }
        }
    },
    "F": {
        "name": "Communication & Language Use", "weight": 0.10, "indicators": {
            "F1.1": { "name": "Speech is clear/audible", "type": "AI", "gate": false, "value": 1, "benchmark": "Tutor's voice is easy to understand.", "requires_video": true },
            "F1.2": { "name": "Instructions are concise", "type": "AI", "gate": false, "value": 1, "benchmark": "Directions are brief and to the point.", "requires_video": false },
            "F1.3": { "name": "Rephrases when confused", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Tutor restates explanations when needed.", "requires_video": false },
            "F2.1": { "name": "Vocabulary appropriate for level", "type": "AI", "gate": false, "value": 1, "benchmark": "Words match student's comprehension level.", "requires_video": false },
            "F2.2": { "name": "Avoids unnecessary jargon", "type": "AI", "gate": false, "value": 1, "benchmark": "Complex terms are explained or avoided.", "requires_video": false },
            "F2.3": { "name": "Adjusts language for learner", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Speech adapts to student's understanding.", "requires_video": false },
            "F3.1": { "name": "Uses open-ended questions", "type": "AI", "gate": false, "value": 1, "benchmark": "Questions require more than yes/no answers.", "requires_video": false },
            "F3.2": { "name": "Provides adequate wait time", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Tutor allows time for student to think.", "requires_video": true },
            "F3.3": { "name": "Probes learner thinking", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Tutor asks follow-up questions to check depth.", "requires_video": false },
            "F4.1": { "name": "Listens without interruption", "type": "AI", "gate": false, "value": 1, "benchmark": "Tutor lets student finish speaking.", "requires_video": true },
            "F4.2": { "name": "Allows sufficient learner talk time", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Student speaks more than tutor.", "requires_video": true },
            "F4.3": { "name": "Responds appropriately to cues", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Tutor picks up on student's verbal and nonverbal signals.", "requires_video": true }
        }
    },
    "G": {
        "name": "Professionalism & Compliance", "weight": 0.09, "indicators": {
            "G1.1": { "name": "Maintains respectful tone", "type": "AI", "gate": true, "value": 1, "benchmark": "Tutor speaks politely and supportively.", "requires_video": true },
            "G1.2": { "name": "Demonstrates patience", "type": "AI", "gate": false, "value": 1, "benchmark": "Tutor remains calm and supportive.", "requires_video": true },
            "G1.3": { "name": "Maintains appropriate body language", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Nonverbal cues are professional and engaged.", "requires_video": true },
            "G2.1": { "name": "Uses platform tools correctly", "type": "AI", "gate": false, "value": 1, "benchmark": "Whiteboard, chat, and tools used effectively.", "requires_video": false },
            "G2.2": { "name": "Follows session protocols", "type": "AI", "gate": true, "value": 1, "benchmark": "Tutor adheres to platform guidelines.", "requires_video": false },
            "G2.3": { "name": "No prohibited actions observed", "type": "AI", "gate": true, "value": 1, "benchmark": "Session follows all safety and policy rules.", "requires_video": true },
            "G3.1": { "name": "Learner safety maintained", "type": "AI", "gate": true, "value": 1, "benchmark": "Student's wellbeing is prioritized throughout.", "requires_video": true },
            "G3.2": { "name": "No inappropriate content", "type": "AI", "gate": true, "value": 1, "benchmark": "All material is age-appropriate and professional.", "requires_video": false },
            "G3.3": { "name": "Handles sensitive situations", "type": "HUMAN", "gate": true, "value": 1, "benchmark": "Tutor responds appropriately to concerns.", "requires_video": true }
        }
    },
    "H": {
        "name": "Learning Outcomes & Evidence", "weight": 0.08, "indicators": {
            "H1.1": { "name": "Objective meaningfully addressed", "type": "AI", "gate": false, "value": 1, "benchmark": "Session successfully covers the stated goal.", "requires_video": false },
            "H1.2": { "name": "Evidence of learner understanding", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Student demonstrates grasp of the concept.", "requires_video": false },
            "H1.3": { "name": "Learner can articulate learning", "type": "AI", "gate": false, "value": 1, "benchmark": "Student explains the concept in their own words.", "requires_video": false },
            "H2.1": { "name": "Learner demonstrates target skill", "type": "AI", "gate": false, "value": 1, "benchmark": "Student performs the skill correctly.", "requires_video": false },
            "H2.2": { "name": "Improvement within session", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Student shows progress during the session.", "requires_video": false },
            "H2.3": { "name": "Errors reduce over time", "type": "HUMAN", "gate": false, "value": 1, "benchmark": "Mistake frequency decreases with practice.", "requires_video": false },
            "H3.1": { "name": "Key learning summarized", "type": "AI", "gate": false, "value": 1, "benchmark": "Main points are reviewed at the end.", "requires_video": false },
            "H3.2": { "name": "Reinforcement/practice suggested", "type": "AI", "gate": false, "value": 1, "benchmark": "Student receives guidance for continued practice.", "requires_video": false },
            "H3.3": { "name": "Next steps communicated", "type": "AI", "gate": false, "value": 1, "benchmark": "Future learning goals are clearly stated.", "requires_video": false }
        }
    }
};

// Maps each subgroup code (derived from indicator_code prefix, e.g. "A1") to a readable label.
// Used purely for report display grouping — not a separate table.
const subgroupNames = {
    "A1": "Lesson Structure & Flow",
    "A2": "Teaching Strategy & Method",
    "A3": "Explanation Clarity",
    "A4": "Differentiation & Scaffolding",

    "B1": "Curriculum Alignment",
    "B2": "Content Accuracy",
    "B3": "Depth & Focus",
    "B4": "Materials & Tasks",

    "C1": "Active Engagement",
    "C2": "Attention Monitoring",
    "C3": "Emotional Support",
    "C4": "Responsiveness to Input",

    "D1": "Formative Assessment",
    "D2": "Feedback Quality",
    "D3": "Error Correction",
    "D4": "Progress Tracking",

    "E1": "Pacing",
    "E2": "Session Control",
    "E3": "Transitions",
    "E4": "Time Efficiency",

    "F1": "Clarity of Speech",
    "F2": "Language Level",
    "F3": "Questioning Technique",
    "F4": "Active Listening",

    "G1": "Professional Demeanor",
    "G2": "Platform Compliance",
    "G3": "Safety & Conduct",

    "H1": "Objective Achievement",
    "H2": "Skill Demonstration",
    "H3": "Closure & Next Steps"
};

const seedRubric = async () => {
    const { runAsync, getAsync } = require('../seedHelpers');

    logger.info("[Seeder] Starting Rubric Seed process...");

    try {
        // Insert categories
        for (const [catId, category] of Object.entries(rubricData)) {
            await runAsync(`
                INSERT IGNORE INTO rubric_categories (category_code, name, weight) 
                VALUES (?, ?, ?)
            `, [catId, category.name, category.weight]);

            // Get the actual DB primary key
            const categoryRow = await getAsync(`
                SELECT id
                FROM rubric_categories
                WHERE category_code = ?
                LIMIT 1
            `, [catId]);

            if (!categoryRow) {
                throw new Error(`Category not found after insert: ${catId}`);
            }

            const rubricCategoryId = categoryRow.id;

            // Insert indicators using actual rubric_categories.id
            for (const [indId, ind] of Object.entries(category.indicators)) {
                const subgroupCode = indId.split('.')[0];          // e.g. "A2.3" -> "A2"
                const subgroupName = subgroupNames[subgroupCode] || null;

                await runAsync(`
                    INSERT IGNORE INTO rubric_indicators 
                    (
                        category_id,
                        indicator_code,
                        subgroup_name,
                        name,
                        type,
                        is_gate,
                        value,
                        benchmark,
                        requires_video
                    ) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    rubricCategoryId,
                    indId,
                    subgroupName,
                    ind.name,
                    ind.type,
                    ind.gate ? 1 : 0,
                    ind.value || 1,
                    ind.benchmark || null,
                    ind.requires_video ? 1 : 0
                ]);
            }
        }

        logger.info("[Seeder] Rubric seeded successfully.");
    } catch (error) {
        logger.error(`[Seeder] Fatal Error during seeding: ${error.message}`);
        throw error;
    }
};

module.exports = { seedRubric };

// Run seeder if executed directly
if (require.main === module) {
  seedRubric()
    .then(() => {
      console.log('[Seed] ✓ Rubric seeder completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Seed] ✗ Rubric seeder failed:', err);
      process.exit(1);
    });
}