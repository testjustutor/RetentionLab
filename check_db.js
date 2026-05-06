const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// This points to the database file in your current folder
const dbPath = path.join(__dirname, 'transcripts.db');
const db = new sqlite3.Database(dbPath);

console.log("--- SCANNING DATABASE FOR TRANSCRIPTS ---");

db.all("SELECT * FROM transcripts", [], (err, rows) => {
    if (err) {
        console.error("❌ Error reading database:", err.message);
        return;
    }
    if (rows.length === 0) {
        console.log("⚠️ No transcripts found yet. Make sure the bot is in a meeting and captions are enabled.");
    } else {
        console.log(`✅ Found ${rows.length} rows of data:`);
        console.table(rows); 
    }
    db.close();
});