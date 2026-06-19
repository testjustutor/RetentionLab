/**
 * root/database/rubricSeeder.js
 */
const { db } = require('./db');
const { logger } = require('../utils/logger');

// Lowercase true/false is required for JavaScript
// Each indicator now includes a default 'value' (weightage)
const rubricData = {
    "A": {
        "name": "Instructional Quality & Pedagogy", "weight": 0.22, "indicators": {
            "A1.1": { "name": "Opening states purpose/objective", "type": "AI", "gate": false, "value": 1 },
            "A1.2": { "name": "Instruction follows logical sequence", "type": "AI", "gate": false, "value": 1 },
            "A1.3": { "name": "Practice activities align to instruction", "type": "AI", "gate": false, "value": 1 },
            "A1.4": { "name": "Session includes meaningful closure", "type": "AI", "gate": false, "value": 1 },
            "A2.1": { "name": "Uses evidence-based strategy", "type": "AI", "gate": false, "value": 1 },
            "A2.2": { "name": "Modeling precedes guided practice", "type": "AI", "gate": false, "value": 1 },
            "A2.3": { "name": "Strategy matches learning objective", "type": "HUMAN", "gate": false, "value": 1 },
            "A2.4": { "name": "Adjusts strategy based on learner response", "type": "HUMAN", "gate": false, "value": 1 },
            "A3.1": { "name": "Explanations accurate and clear", "type": "AI", "gate": true, "value": 1 },
            "A3.2": { "name": "Examples are age/level appropriate", "type": "AI", "gate": false, "value": 1 },
            "A3.3": { "name": "Uses think-alouds/worked examples", "type": "AI", "gate": false, "value": 1 },
            "A3.4": { "name": "Avoids cognitive overload", "type": "HUMAN", "gate": false, "value": 1 },
            "A4.1": { "name": "Instruction adjusted to learner level", "type": "HUMAN", "gate": false, "value": 1 },
            "A4.2": { "name": "Uses prompts or cues to support", "type": "AI", "gate": false, "value": 1 },
            "A4.3": { "name": "Gradual release of responsibility observed", "type": "AI", "gate": false, "value": 1 },
            "A4.4": { "name": "Support provided when learner struggles", "type": "HUMAN", "gate": false, "value": 1 }
        }
    },
    "B": {
        "name": "Curriculum Alignment & Accuracy", "weight": 0.15, "indicators": {
            "B1.1": { "name": "Objective aligns to curriculum", "type": "AI", "gate": false, "value": 1 },
            "B1.2": { "name": "Content matches scope & sequence", "type": "AI", "gate": false, "value": 1 },
            "B1.3": { "name": "No off-grade/irrelevant content", "type": "AI", "gate": false, "value": 1 },
            "B2.1": { "name": "No factual/conceptual errors", "type": "AI", "gate": true, "value": 1 },
            "B2.2": { "name": "Terminology used correctly", "type": "AI", "gate": true, "value": 1 },
            "B2.3": { "name": "Corrects own mistakes", "type": "HUMAN", "gate": true, "value": 1 },
            "B3.1": { "name": "Adequate depth for learner level", "type": "HUMAN", "gate": false, "value": 1 },
            "B3.2": { "name": "Avoids unnecessary digressions", "type": "AI", "gate": false, "value": 1 },
            "B3.3": { "name": "Maintains focus on objective", "type": "AI", "gate": false, "value": 1 },
            "B4.1": { "name": "Tasks support objective", "type": "AI", "gate": false, "value": 1 },
            "B4.2": { "name": "Materials are grade-appropriate", "type": "AI", "gate": false, "value": 1 },
            "B4.3": { "name": "Resources used effectively", "type": "HUMAN", "gate": false, "value": 1 }
        }
    },
    "C": {
        "name": "Learner Engagement & Responsiveness", "weight": 0.14, "indicators": {
            "C1.1": { "name": "Learner required to think/respond", "type": "AI", "gate": false, "value": 1 },
            "C1.2": { "name": "Questions promote reasoning", "type": "HUMAN", "gate": false, "value": 1 },
            "C1.3": { "name": "Opportunities for application provided", "type": "AI", "gate": false, "value": 1 },
            "C2.1": { "name": "Learner remains on-task", "type": "AI", "gate": false, "value": 1 },
            "C2.2": { "name": "Instructor monitors engagement", "type": "AI", "gate": false, "value": 1 },
            "C2.3": { "name": "Off-task behavior addressed", "type": "HUMAN", "gate": false, "value": 1 },
            "C3.1": { "name": "Positive reinforcement used", "type": "AI", "gate": false, "value": 1 },
            "C3.2": { "name": "Instructor tone is encouraging", "type": "AI", "gate": false, "value": 1 },
            "C3.3": { "name": "Responds to learner frustration", "type": "HUMAN", "gate": false, "value": 1 },
            "C4.1": { "name": "Acknowledges learner responses", "type": "AI", "gate": false, "value": 1 },
            "C4.2": { "name": "Adjusts instruction based on input", "type": "HUMAN", "gate": false, "value": 1 },
            "C4.3": { "name": "Follows up on incorrect responses", "type": "AI", "gate": false, "value": 1 }
        }
    },
    "D": {
        "name": "Assessment & Feedback Quality", "weight": 0.12, "indicators": {
            "D1.1": { "name": "Checks for understanding embedded", "type": "AI", "gate": false, "value": 1 },
            "D1.2": { "name": "Questions/tasks used diagnostically", "type": "HUMAN", "gate": false, "value": 1 },
            "D1.3": { "name": "Assessment aligned to objective", "type": "AI", "gate": false, "value": 1 },
            "D2.1": { "name": "Feedback is timely", "type": "AI", "gate": false, "value": 1 },
            "D2.2": { "name": "Feedback is specific/actionable", "type": "HUMAN", "gate": false, "value": 1 },
            "D2.3": { "name": "Feedback focuses on process", "type": "AI", "gate": false, "value": 1 },
            "D3.1": { "name": "Errors identified correctly", "type": "AI", "gate": false, "value": 1 },
            "D3.2": { "name": "Misconceptions explicitly addressed", "type": "HUMAN", "gate": false, "value": 1 },
            "D3.3": { "name": "Corrective feedback is respectful", "type": "AI", "gate": false, "value": 1 },
            "D4.1": { "name": "Tracks performance during session", "type": "AI", "gate": false, "value": 1 },
            "D4.2": { "name": "Adjusts pacing based on progress", "type": "HUMAN", "gate": false, "value": 1 },
            "D4.3": { "name": "Uses evidence for next steps", "type": "HUMAN", "gate": false, "value": 1 }
        }
    },
    "E": {
        "name": "Classroom Management & Pacing", "weight": 0.10, "indicators": {
            "E1.1": { "name": "Pacing appropriate for learner", "type": "HUMAN", "gate": false, "value": 1 },
            "E1.2": { "name": "Time allocated proportionally", "type": "AI", "gate": false, "value": 1 },
            "E1.3": { "name": "No prolonged idle time", "type": "AI", "gate": false, "value": 1 },
            "E2.1": { "name": "Instructor maintains control", "type": "AI", "gate": false, "value": 1 },
            "E2.2": { "name": "Clear directions provided", "type": "AI", "gate": false, "value": 1 },
            "E2.3": { "name": "Manages disruptions effectively", "type": "HUMAN", "gate": false, "value": 1 },
            "E3.1": { "name": "Smooth transitions", "type": "AI", "gate": false, "value": 1 },
            "E3.2": { "name": "Maintains instructional momentum", "type": "HUMAN", "gate": false, "value": 1 },
            "E3.3": { "name": "Minimizes downtime", "type": "AI", "gate": false, "value": 1 },
            "E4.1": { "name": "Instructional time maximized", "type": "AI", "gate": false, "value": 1 },
            "E4.2": { "name": "Minimal off-task talk", "type": "AI", "gate": false, "value": 1 },
            "E4.3": { "name": "Administrative tasks minimized", "type": "AI", "gate": false, "value": 1 }
        }
    },
    "F": {
        "name": "Communication & Language Use", "weight": 0.10, "indicators": {
            "F1.1": { "name": "Speech is clear/audible", "type": "AI", "gate": false, "value": 1 },
            "F1.2": { "name": "Instructions are concise", "type": "AI", "gate": false, "value": 1 },
            "F1.3": { "name": "Rephrases when confused", "type": "HUMAN", "gate": false, "value": 1 },
            "F2.1": { "name": "Vocabulary appropriate for level", "type": "AI", "gate": false, "value": 1 },
            "F2.2": { "name": "Avoids unnecessary jargon", "type": "AI", "gate": false, "value": 1 },
            "F2.3": { "name": "Adjusts language for learner", "type": "HUMAN", "gate": false, "value": 1 },
            "F3.1": { "name": "Uses open-ended questions", "type": "AI", "gate": false, "value": 1 },
            "F3.2": { "name": "Provides adequate wait time", "type": "HUMAN", "gate": false, "value": 1 },
            "F3.3": { "name": "Probes learner thinking", "type": "HUMAN", "gate": false, "value": 1 },
            "F4.1": { "name": "Listens without interruption", "type": "AI", "gate": false, "value": 1 },
            "F4.2": { "name": "Allows sufficient learner talk time", "type": "HUMAN", "gate": false, "value": 1 },
            "F4.3": { "name": "Responds appropriately to cues", "type": "HUMAN", "gate": false, "value": 1 }
        }
    },
    "G": {
        "name": "Professionalism & Compliance", "weight": 0.09, "indicators": {
            "G1.1": { "name": "Maintains respectful tone", "type": "AI", "gate": true, "value": 1 },
            "G1.2": { "name": "Demonstrates patience", "type": "AI", "gate": false, "value": 1 },
            "G1.3": { "name": "Maintains appropriate body language", "type": "HUMAN", "gate": false, "value": 1 },
            "G2.1": { "name": "Uses platform tools correctly", "type": "AI", "gate": false, "value": 1 },
            "G2.2": { "name": "Follows session protocols", "type": "AI", "gate": true, "value": 1 },
            "G2.3": { "name": "No prohibited actions observed", "type": "AI", "gate": true, "value": 1 },
            "G3.1": { "name": "Learner safety maintained", "type": "AI", "gate": true, "value": 1 },
            "G3.2": { "name": "No inappropriate content", "type": "AI", "gate": true, "value": 1 },
            "G3.3": { "name": "Handles sensitive situations", "type": "HUMAN", "gate": true, "value": 1 }
        }
    },
    "H": {
        "name": "Learning Outcomes & Evidence", "weight": 0.08, "indicators": {
            "H1.1": { "name": "Objective meaningfully addressed", "type": "AI", "gate": false, "value": 1 },
            "H1.2": { "name": "Evidence of learner understanding", "type": "HUMAN", "gate": false, "value": 1 },
            "H1.3": { "name": "Learner can articulate learning", "type": "AI", "gate": false, "value": 1 },
            "H2.1": { "name": "Learner demonstrates target skill", "type": "AI", "gate": false, "value": 1 },
            "H2.2": { "name": "Improvement within session", "type": "HUMAN", "gate": false, "value": 1 },
            "H2.3": { "name": "Errors reduce over time", "type": "HUMAN", "gate": false, "value": 1 },
            "H3.1": { "name": "Key learning summarized", "type": "AI", "gate": false, "value": 1 },
            "H3.2": { "name": "Reinforcement/practice suggested", "type": "AI", "gate": false, "value": 1 },
            "H3.3": { "name": "Next steps communicated", "type": "AI", "gate": false, "value": 1 }
        }
    }
};

const seedRubric = () => {
    return new Promise((resolve, reject) => {
        logger.info("[Seeder] Starting Rubric Seed process...");

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            // Categories Prepared Statement
            const catStmt = db.prepare(`
                INSERT INTO rubric_categories (category_id, name, weight) 
                VALUES (?, ?, ?)
                ON CONFLICT(category_id) DO UPDATE SET 
                    name=excluded.name, 
                    weight=excluded.weight
            `);

            // Indicators Prepared Statement (now includes value)
            const indStmt = db.prepare(`
                INSERT INTO rubric_indicators (indicator_id, category_id, name, type, is_gate, value) 
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(indicator_id) DO UPDATE SET 
                    name=excluded.name, 
                    type=excluded.type, 
                    is_gate=excluded.is_gate,
                    value=excluded.value
            `);

            try {
                Object.entries(rubricData).forEach(([catId, category]) => {
                    catStmt.run(catId, category.name, category.weight);

                    Object.entries(category.indicators).forEach(([indId, ind]) => {
                        indStmt.run(indId, catId, ind.name, ind.type, ind.gate ? 1 : 0, ind.value || 1);
                    });
                });

                catStmt.finalize();
                indStmt.finalize();

                db.run("COMMIT", (err) => {
                    if (err) {
                        logger.error(`[Seeder] Commit Failed: ${err.message}`);
                        db.run("ROLLBACK");
                        reject(err);
                    } else {
                        logger.info("[Seeder] Rubric seeded successfully.");
                        resolve();
                    }
                });
            } catch (error) {
                db.run("ROLLBACK");
                logger.error(`[Seeder] Fatal Error during seeding: ${error.message}`);
                reject(error);
            }
        });
    });
};

module.exports = { seedRubric };