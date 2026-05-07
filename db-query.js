const { getTranscriptsBySession } = require('./models/transcriptModel.js');

async function query() {
  try {
    const rows = await getTranscriptsBySession(0);
    console.log(`Total transcripts for session 0: ${rows.length}`);
    if (rows.length > 0) {
      console.log('Speakers:', [...new Set(rows.map(r => r.speaker))]);
      console.log('Sample:', rows.slice(-3));
    }
  } catch (e) {
    console.error('Query error:', e);
  }
}

query();
