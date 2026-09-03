const { db } = require('./database/db');

function q(sql, params) {
  return new Promise(function (resolve, reject) {
    db.all(sql, params || [], function (err, rows) {
      if (err) { reject(err); return; }
      resolve(rows);
    });
  });
}

async function main() {
  try {
    const cols = await q('SHOW COLUMNS FROM meeting_session_scores');
    console.log('COLUMNS:', JSON.stringify(cols, null, 2));
    const cnt = await q('SELECT COUNT(*) AS c FROM meeting_session_scores');
    console.log('COUNT:', cnt[0].c);
    const sample = await q('SELECT * FROM meeting_session_scores LIMIT 5');
    console.log('SAMPLE:', JSON.stringify(sample, null, 2));
  } catch (e) {
    console.error('ERR:', e.message);
  }
  process.exit(0);
}

main();