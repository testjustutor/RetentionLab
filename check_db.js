const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'transcripts.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT * FROM transcripts", [], (err, rows) => {
    if (err) {
        console.error("❌ Error reading database:", err.message);
        return;
    }
    if (rows.length === 0) {
        console.log("⚠️ No transcripts found yet. Make sure the bot is in a meeting and captions are enabled.");
    } else {
        console.log(`✅ Found ${rows.length} rows of data:`);
    }
    db.close();
});