const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'transcripts.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('DB open error:', err);
  } else {
    console.log('DB connected');
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
      if (err) {
        console.error('Tables error:', err);
      } else {
        console.log('Tables:', tables);
      }
      db.close();
    });
  }
});
