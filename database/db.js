const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 1. Define the DB Path
const dbPath = path.resolve(__dirname, '..', 'retention_lab.db');

// 2. Create the Database instance immediately
const db = new sqlite3.Database(dbPath);

/**
 * Initializes all tables and runs the seeder.
 * The seeder is required INSIDE the function to prevent circular dependency errors.
 */
const initDB = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // 1. Transcripts Table
            db.run(`
                CREATE TABLE IF NOT EXISTS transcripts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    meeting_session_id TEXT,
                    speaker TEXT,
                    text TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // 2. Meeting Sessions Table
            db.run(`
                CREATE TABLE IF NOT EXISTS meeting_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    meeting_id TEXT UNIQUE,
                    transcript_file_name TEXT,
                    audio_file_name TEXT,
                    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    end_time DATETIME
                )
            `);

            // 3. Calendar Meetings Table
            db.run(`
                CREATE TABLE IF NOT EXISTS calendar_meetings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    meeting_id TEXT UNIQUE,
                    platform TEXT,
                    passcode TEXT,
                    event_id TEXT,
                    calendar_account TEXT,
                    meeting_link TEXT,
                    timezone TEXT,
                    start_time DATETIME,
                    end_time DATETIME,
                    title TEXT,
                    status TEXT DEFAULT 'joining',
                    session_id TEXT,
                    summary TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // 4. Calendar Accounts Table
            db.run(`
                CREATE TABLE IF NOT EXISTS calendar_accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE,
                    credentials_file TEXT NOT NULL,
                    token_file TEXT,
                    scopes TEXT,
                    status TEXT DEFAULT 'active',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // 5. Meeting Assets Storage Table
            db.run(`
                CREATE TABLE IF NOT EXISTS meeting_assets_storage (
                    meeting_id TEXT PRIMARY KEY,
                    audio_path TEXT,
                    transcript_path TEXT,
                    audit_json_path TEXT,
                    wav_audio_path TEXT,
                    whisper_path TEXT,
                    captions_raw_path TEXT,
                    diarization_path TEXT,
                    embeddings_path TEXT,
                    llm_prompts_path TEXT,
                    action_items_path TEXT,
                    sentiment_analysis_path TEXT,
                    talk_ratio_json_path TEXT,
                    user_silence_duration_path TEXT,
                    questions_asked_count_path TEXT,
                    topic_clusters_path TEXT,
                    summary_path TEXT,
                    oqi_score REAL,
                    evidence_quote TEXT,
                    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // 6. Rubric Categories Table
            db.run(`
                CREATE TABLE IF NOT EXISTS rubric_categories (
                    category_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    weight REAL NOT NULL
                )
            `);

            // 7. Rubric Indicators Table
            db.run(`
                CREATE TABLE IF NOT EXISTS rubric_indicators (
                    indicator_id TEXT PRIMARY KEY,
                    category_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    type TEXT CHECK(type IN ('AI', 'HUMAN')),
                    is_gate BOOLEAN DEFAULT 0,
                    FOREIGN KEY (category_id) REFERENCES rubric_categories(category_id)
                )
            `);

            // 8. Meeting Scores Table
            db.run(`
                CREATE TABLE IF NOT EXISTS meeting_scores (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    meeting_id TEXT NOT NULL,
                    indicator_id TEXT NOT NULL,
                    score INTEGER DEFAULT 0,
                    comment TEXT,
                    scored_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (meeting_id) REFERENCES meeting_assets_storage(meeting_id),
                    FOREIGN KEY (indicator_id) REFERENCES rubric_indicators(indicator_id),
                    UNIQUE(meeting_id, indicator_id)
                )
            `, async (err) => {
                if (err) {
                    return reject(err);
                }
                try {
                    // --- REQUIRE SEEDER INSIDE TO PREVENT 'UNDEFINED' DB ERROR ---
                    const { seedRubric } = require('./rubricSeeder');
                    
                    if (typeof seedRubric === 'function') {
                        await seedRubric();
                    }
                    
                    resolve(); 
                } catch (seedErr) {
                    // Log error but resolve anyway so the server can start
                    console.error("Seeding Error:", seedErr.message);
                    resolve(); 
                }
            });
        });
    });
};

const closeDB = () => {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

// EXPORT EVERYTHING AT ONCE
module.exports = { db, initDB, closeDB };