const fs = require('fs').promises;
const path = require('path');
const TranscriptModel = require('../models/transcriptModel');
const ParticipantModel = require('../models/participantModel'); // TODO: Create participantModel
const { logger } = require('./logger');

async function exportToJson(meetingId, outputDir = '.') {
  try {
    const transcripts = await TranscriptModel.getTranscriptsByMeeting(meetingId);
    const sessionId = transcripts[0]?.meeting_session_id || 0;
    const participantEvents = sessionId ? await ParticipantModel.getEventsBySession(sessionId) : []; // TODO: Uncomment when participantModel exists

    const filename = path.join(outputDir, `transcript-${meetingId}-${new Date().toISOString().split('T')[0]}.json`);

    const data = {
      meetingId,
      sessionId,
      generatedAt: new Date().toISOString(),
      totalTranscripts: transcripts.length,
      participants: [...new Set(transcripts.map(t => t.speaker).filter(Boolean))],
      participantEvents,
      transcripts: transcripts.map(t => ({
        id: t.id,
        speaker: t.speaker,
        text: t.text,
        time: t.timestamp
      })),
      summary: transcripts.length ? `${transcripts.length} utterances from ${new Set(transcripts.map(t => t.speaker)).size} speakers` : 'No captions detected (HOST+BOT still exports metadata)'
    };

    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    logger.info(`JSON transcript exported to ${filename}`);
    return filename;
  } catch (err) {
    logger.error('JSON export error:', err);
    throw err;
  }
}

async function exportToTxt(meetingId, outputDir = '.') {
  try {
    const transcripts = await TranscriptModel.getTranscriptsByMeeting(meetingId);
    const filename = path.join(outputDir, `transcript-${meetingId}-${new Date().toISOString().split('T')[0]}.txt`);
    
    let content = `Meeting Transcript - ID: ${meetingId}\nGenerated: ${new Date().toISOString()}\n\n`;
    transcripts.forEach(t => {
      content += `[${t.timestamp}] ${t.speaker}: ${t.text}\n`;
    });

    await fs.writeFile(filename, content);
    logger.info(`TXT transcript exported to ${filename}`);
    return filename;
  } catch (err) {
    logger.error('TXT export error:', err);
    throw err;
  }
}

async function exportBoth(meetingId, outputDir = '.') {
  const jsonFile = await exportToJson(meetingId, outputDir);
  const txtFile = await exportToTxt(meetingId, outputDir);
  return { json: jsonFile, txt: txtFile };
}

module.exports = { exportToJson, exportToTxt, exportBoth };

