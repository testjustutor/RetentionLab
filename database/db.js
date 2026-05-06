const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'transcripts.db');
const db = new sqlite3.Database(dbPath);

const initDB = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`
                CREATE TABLE IF NOT EXISTS transcripts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    meeting_session_id TEXT,
                    speaker TEXT,
                    text TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS meeting_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    meeting_id TEXT UNIQUE,
                    transcript_file_name TEXT,
                    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    end_time DATETIME
                )
            `);

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

            db.all(`PRAGMA table_info(meeting_sessions)`, (err, columns) => {
                if (err) {
                    reject(err);
                    return;
                }

                const hasTranscriptFileName = columns.some(col => col.name === 'transcript_file_name');
                const hasAudioFileName = columns.some(col => col.name === 'audio_file_name');

                const alterTasks = [];
                if (!hasTranscriptFileName) {
                    alterTasks.push(new Promise((res, rej) => {
                        db.run(`ALTER TABLE meeting_sessions ADD COLUMN transcript_file_name TEXT`, (alterErr) => {
                            if (alterErr) rej(alterErr);
                            else res();
                        });
                    }));
                }
                if (!hasAudioFileName) {
                    alterTasks.push(new Promise((res, rej) => {
                        db.run(`ALTER TABLE meeting_sessions ADD COLUMN audio_file_name TEXT`, (alterErr) => {
                            if (alterErr) rej(alterErr);
                            else res();
                        });
                    }));
                }

                if (alterTasks.length === 0) {
                    resolve();
                } else {
                    Promise.all(alterTasks).then(() => resolve()).catch(reject);
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

module.exports = { db, initDB, closeDB };

