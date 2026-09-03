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
    //   node test-engine.js <sessionId>                          -> look up meeting_id + audio_file_name from meeting_sessions
    //   node test-engine.js <meetingId> <sessionId>               -> EXPLICIT meetingId + sessionId (both numeric); audio_file_name still resolved via sessionId lookup, but meetingId is NOT overridden from the DB - the value you pass is used as-is
    //   node test-engine.js <recordingPath> [meetingId] [sessionId] -> explicit file path (fallback)
    const arg1 = process.argv[2];
    const arg2 = process.argv[3];

    if (!arg1) {
        console.error("❌ Error: Provide a session id, a meetingId + sessionId pair, or a recording path.");
        console.error("   node test-engine.js <sessionId>");
        console.error("   or");
        console.error("   node test-engine.js <meetingId> <sessionId>");
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

        const arg1IsNumeric = /^\d+$/.test(String(arg1).trim());
        const arg2IsNumeric = arg2 !== undefined && /^\d+$/.test(String(arg2).trim());

        if (arg1IsNumeric && arg2IsNumeric) {
            // EXPLICIT MODE: node test-engine.js <meetingId> <sessionId>
            // Both ids are supplied directly on the command line - meetingId is
            // used exactly as given (NOT re-resolved/overridden from the DB via
            // meeting_sessions.meeting_id), mirroring test_ai_evaluation.py's
            // explicit meetingId + sessionId contract. The audio_file_name still
            // needs to come from meeting_sessions (that's the only place it's
            // stored), so sessionId is used to look up the recording.
            meetingId = parseInt(String(arg1).trim(), 10);
            sessionId = parseInt(String(arg2).trim(), 10);

            const session = await MeetingSessionModel.getById(sessionId);
            if (!session) {
                console.error(`❌ No session found for id ${sessionId} in meeting_sessions`);
                process.exit(1);
            }
            if (!session.audio_file_name) {
                console.error(`❌ Session ${sessionId} has no audio_file_name recorded.`);
                process.exit(1);
            }

            fileName = path.basename(session.audio_file_name);

            if (session.meeting_id && Number(session.meeting_id) !== meetingId) {
                console.warn(
                    `⚠️  WARNING: explicit meetingId=${meetingId} does not match `
                    + `meeting_sessions.meeting_id=${session.meeting_id} for session ${sessionId}. `
                    + `Proceeding with the explicitly supplied meetingId=${meetingId} as requested.`
                );
            }

            console.log(`🗂️  Explicit mode -> meeting_id ${meetingId}, session_id ${sessionId}, audio: ${session.audio_file_name}`);
        } else if (arg1IsNumeric) {
            // SINGLE-ARG MODE: node test-engine.js <sessionId>
            // Resolve meeting_id + audio_file_name automatically from the database.
            sessionId = parseInt(String(arg1).trim(), 10);
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
            // PATH MODE: node test-engine.js <recordingPath> [meetingId] [sessionId]
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