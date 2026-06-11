/**
 * root/test-engine.js
 *
 */
require('dotenv').config();
const { initDB } = require('./database/db');
const PythonBridge = require('./services/shared/pythonBridge');
const path = require('path');
const fs = require('fs');

const LOCK_PATH = path.join(__dirname, '.test-engine.lock');

function acquireLock() {
    try {
        // If lock exists, assume a run is already in progress.
        if (fs.existsSync(LOCK_PATH)) {
            let pid = '';
            try {
                pid = fs.readFileSync(LOCK_PATH, 'utf-8').trim();
            } catch (_) {
                // ignore
            }
            console.error(`\n⚠️  Test run already in progress. Lock file exists: ${LOCK_PATH}${pid ? ` (PID: ${pid})` : ''}`);
            return false;
        }

        // Create lock atomically (fails if file exists).
        fs.writeFileSync(LOCK_PATH, String(process.pid), { encoding: 'utf-8', flag: 'wx' });
        return true;
    } catch (err) {
        console.error(`\n⚠️  Could not acquire lock (${LOCK_PATH}): ${err.message}`);
        return false;
    }
}

function releaseLock() {
    try {
        if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
    } catch (_) {
        // ignore
    }
}

async function runManualTest() {
    const inputPath = process.argv[2];

    if (!inputPath) {
        console.error("❌ Error: Provide the path (e.g., node test-engine.js .\\storage\\recordings\\REC_...mp3)");
        process.exit(1);
    }

    if (!acquireLock()) process.exit(1);

    try {
        console.log('🗄️  Initializing Database & Seeding...');
        await initDB();

        // Extract ONLY the filename from the path provided in the terminal
        // This prevents the "double path" error (storage/recordings/storage/recordings/...)
        const fileName = path.basename(inputPath);

        console.log('\n==================================================');
        console.log(`🚀 STARTING PIPELINE TEST: ${fileName}`);
        console.log('==================================================\n');

        const result = await PythonBridge.runFullAudioPipeline(fileName);

        console.log(`\n✅ RUN COMPLETE: SUCCESS! OQI Score: ${result.auditResult.oqi_score}`);
        process.exit(0);
    } catch (error) {
        console.error(`\n❌ RUN COMPLETE: PIPELINE FAILED: ${error.message}`);
        process.exit(1);
    } finally {
        releaseLock();
    }
}

runManualTest();

