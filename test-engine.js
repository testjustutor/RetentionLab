/**
 * root/test-engine.js
 *
 */
require('dotenv').config();
const { initDB } = require('./database/db');
const PythonBridge = require('./services/shared/pythonBridge');
const MeetingSessionModel = require('./models/meetings/meeting-session/meetingSessionModel');
const path = require('path');

async function runManualTest() {
    // Usage:
    //   node test-engine.js <sessionId>                 -> look up meeting_id + audio_file_name from meeting_sessions
    //   node test-engine.js <recordingPath> [meetingId] [sessionId]  -> explicit file path (fallback)
    const arg = process.argv[2];

    if (!arg) {
        console.error("❌ Error: Provide a session id or a recording path.");
        console.error("   node test-engine.js <sessionId>");
        console.error("   or");
        console.error("   node test-engine.js .\\storage\\recordings\\REC_...mp3 [meetingId] [sessionId]");
        process.exit(1);
    }

    try {
        console.log('🗄️  Initializing Database & Seeding...');
        await initDB();

        let meetingId = null;
        let sessionId = null;
        let fileName = null;

        // If the first arg is a plain number, treat it as a meeting_sessions.id and
        // resolve the meeting id + audio file automatically from the database.
        if (/^\d+$/.test(String(arg).trim())) {
            sessionId = parseInt(String(arg).trim(), 10);
            const session = await MeetingSessionModel.getById(sessionId);
            if (!session) {
                console.error(`❌ No session found for id ${sessionId} in meeting_sessions`);
                process.exit(1);
            }
            if (!session.audio_file_name) {
                console.error(`❌ Session ${sessionId} has no audio_file_name recorded.`);
                process.exit(1);
            }
            meetingId = session.meeting_id;
            // audio_file_name may be a full storage path — the engine needs just the filename.
            fileName = path.basename(session.audio_file_name);
            console.log(`🗂️  Resolved session ${sessionId} -> meeting_id ${meetingId}, audio: ${session.audio_file_name}`);
        } else {
            // Fallback: explicit recording path, optionally with meetingId/sessionId.
            const inputPath = process.argv[2];
            meetingId = process.argv[3];
            sessionId = process.argv[4];
            // Extract ONLY the filename from the path provided in the terminal
            // This prevents the "double path" error (storage/recordings/storage/recordings/...)
            fileName = path.basename(inputPath);
        }

        console.log('\n==================================================');
        const contextNote = meetingId && sessionId
            ? ' (meetingId: ' + meetingId + ', sessionId: ' + sessionId + ')'
            : ' (meetingId/sessionId parsed from filename)';
        console.log(`🚀 STARTING PIPELINE TEST: ${fileName}${contextNote}`);
        console.log('==================================================\n');

        const result = await PythonBridge.runFullAudioPipeline(
            meetingId ? meetingId : null,
            sessionId ? sessionId : null,
            fileName
        );

        console.log(`\n✅ RUN COMPLETE: SUCCESS! OQI Score: ${result.auditResult.oqi_score}`);
        process.exit(0);
    } catch (error) {
        console.error(`\n❌ RUN COMPLETE: PIPELINE FAILED: ${error.message}`);
        process.exit(1);
    }
}

runManualTest();

