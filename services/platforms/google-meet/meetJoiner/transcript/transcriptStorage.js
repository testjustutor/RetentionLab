/**
 * root/services/platforms/google-meet/meetJoiner/transcript/transcriptStorage.js
 */

const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../../../../../utils/logger');
const { cleanTranscript } = require('./captionProcessor');

// Fix 2: Write meeting header when file is first created
async function ensureTranscriptHeader(ctx) {
  const filePath = ctx.filePath;
  if (!filePath) return;

  try {
    // Check if file already exists and has content
    const stat = await fs.stat(filePath).catch(() => null);
    if (stat && stat.size > 0) return; // already has content, skip header

    const dirPath = path.dirname(filePath);
    await fs.mkdir(dirPath, { recursive: true });

    const now = new Date();
    const dateStr = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const header = [
      '==========================================',
      'GOOGLE-MEET MEETING TRANSCRIPT',
      '==========================================',
      `Meeting ID : ${ctx.meetingId || 'N/A'}`,
      `Session ID : ${ctx.sessionId || '1'}`,
      `Date       : ${dateStr}`,
      '==========================================',
      ''
    ].join('\n');

    await fs.writeFile(filePath, header);
    logger.info(`GoogleMeetJoiner(transcriptStorage): Transcript header written to ${filePath}`);
  } catch (err) {
    logger.error('GoogleMeetJoiner(transcriptStorage): Failed to write transcript header', err);
  }
}

async function saveTranscriptLine(ctx, formattedLine) {
  if (!formattedLine) {
    logger.warn('GoogleMeetJoiner(transcriptStorage): formattedLine is undefined/null');
    return;
  }
  if (!ctx?.filePath) {
    logger.warn('GoogleMeetJoiner(transcriptStorage): filePath missing inside captionMonitor');
    return;
  }

  // Fix 2: Ensure header exists before first line
  await ensureTranscriptHeader(ctx);

  const filePath = ctx.filePath;
  const dirPath = path.dirname(filePath);

  try {
    await fs.mkdir(dirPath, { recursive: true });
    await fs.appendFile(filePath, `${formattedLine}\n`);
  } catch (err) {
    logger.error('GoogleMeetJoiner(transcriptStorage): File append error:', err);
  }
}

async function exportTranscriptBuffer(ctx) {
  if (!ctx) {
    logger.warn('GoogleMeetJoiner(transcriptStorage): exportTranscriptBuffer called with no ctx');
    return;
  }
  if (!ctx.filePath) {
    logger.warn('GoogleMeetJoiner(transcriptStorage): filePath missing for exportTranscriptBuffer');
    return;
  }

  try {
    const filePath = ctx.filePath;

    // Fix 1: Check if file already has live-appended content
    const stat = await fs.stat(filePath).catch(() => null);

    if (stat && stat.size > 0) {
      // File already has content from live appends — DO NOT overwrite
      logger.info(`GoogleMeetJoiner(transcriptStorage): File already has content, skipping buffer overwrite → ${filePath}`);
      return;
    }

    // File is empty or missing — fall back to writing from buffer
    const dirPath = path.dirname(filePath);
    await fs.mkdir(dirPath, { recursive: true });

    const buffer = Array.isArray(ctx.transcriptBuffer) ? ctx.transcriptBuffer : [];

    if (buffer.length === 0) {
      logger.warn('GoogleMeetJoiner(transcriptStorage): transcriptBuffer is empty, nothing to export');
      return;
    }

    // Write header + buffer lines
    const now = new Date();
    const dateStr = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const header = [
      '==========================================',
      'GOOGLE-MEET MEETING TRANSCRIPT',
      '==========================================',
      `Meeting ID : ${ctx.meetingId || 'N/A'}`,
      `Session ID : ${ctx.sessionId || '1'}`,
      `Date       : ${dateStr}`,
      '==========================================',
      ''
    ].join('\n');

    const rawContent = buffer.map(b => `[${b.time}] ${b.name}: ${b.text}`).join('\n') + '\n';
    const cleanedContent = cleanTranscript(rawContent); // ← apply cleaner
    await fs.writeFile(filePath, header + cleanedContent);
    logger.info(`GoogleMeetJoiner(transcriptStorage): Exported transcript buffer to ${filePath}`);

  } catch (err) {
    logger.error('GoogleMeetJoiner(transcriptStorage): Export buffer failed', err);
  }
}

module.exports = { saveTranscriptLine, exportTranscriptBuffer, ensureTranscriptHeader };