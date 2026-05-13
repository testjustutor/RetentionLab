require('dotenv').config();
const { initDB } = require('./database/db');
const PythonBridge = require('./services/shared/pythonBridge');

async function runManualTest() {
    const fileName = process.argv[2];

    if (!fileName) {
        console.error("❌ Error: Provide the filename (e.g., node test-engine.js REC_...mp3)");
        process.exit(1);
    }

    try {
        console.log("🗄️  Initializing Database & Seeding...");
        await initDB(); 

        console.log(`\n==================================================`);
        console.log(`🚀 STARTING PIPELINE TEST: ${fileName}`);
        console.log(`==================================================\n`);

        const result = await PythonBridge.runFullAudioPipeline(fileName);

        console.log(`\n✅ SUCCESS! OQI Score: ${result.auditResults.oqi_score}`);
        process.exit(0);
    } catch (error) {
        console.error(`\n❌ PIPELINE FAILED: ${error.message}`);
        process.exit(1);
    }
}

runManualTest();