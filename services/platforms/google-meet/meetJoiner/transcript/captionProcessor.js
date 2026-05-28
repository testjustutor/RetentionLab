/**
 * root/services/platforms/google-meet/meetJoiner/transcript/captionProcessor.js
 */
const { logger } = require('../../../../../utils/logger');
const { saveTranscriptLine } = require('./transcriptStorage');

async function processCaptionLines(
  ctx,
  captions,
  lastCaptionLine,
  lastSpeakerName
) {
  const {
    seenRows,
    transcriptBuffer,
    handleCaptionEvent
  } = ctx;

  for (const item of captions) {
    const { name, text } = item;

    logger.info(`GoogleMeetJoiner(captionProcessor): Processing | Name: "${name}" | Text: "${text}"`);

    // Fix 1: Check participant name bubble BEFORE seenRows to avoid poisoning the set
    try {
      const tracker = ctx?.participantTracker;
      const candidate = (text || '').trim();
      if (candidate && tracker?.trackedParticipants?.has(candidate)) {
        logger.info(`GoogleMeetJoiner(captionProcessor): Skipping name bubble: "${candidate}"`);
        continue;
      }
    } catch (e) {
      logger.debug('GoogleMeetJoiner(captionProcessor): participantTracker check failed', e.message);
    }

    const current = (text || '').toLowerCase();
    const last = (lastCaptionLine || '').toLowerCase();

    // Fix 4: Improved extension check — also handles mid-sentence corrections
    const isExtension =
      name === lastSpeakerName &&
      (
        current.startsWith(last) ||           // forward build: "hello" → "hello world"
        last.startsWith(current) ||           // truncation: "hello world" → "hello wor"
        (last.length > 5 && current.includes(last.slice(-10))) // overlap on tail
      );

    logger.info(`GoogleMeetJoiner(captionProcessor): isExtension: ${isExtension} | lastSpeaker: "${lastSpeakerName}"`);

    if (isExtension) {
      lastCaptionLine = text; // update memory, no write
      continue;
    }

    const key = `${name}:${text}`;

    if (seenRows.has(key)) {
      continue;
    }

    seenRows.add(key);

    // Fix 3: Use LRU-style eviction instead of full clear
    if (seenRows.size > 1000) {
      const firstKey = seenRows.values().next().value;
      seenRows.delete(firstKey); // remove oldest entry only
    }

    lastCaptionLine = text;
    lastSpeakerName = name;

    const formattedTime = new Date().toTimeString().split(' ')[0];
    const formattedLine = `[${formattedTime}] ${name}: ${text}`;

    transcriptBuffer.push({ name, text, time: formattedTime });

    if (handleCaptionEvent) {
      await handleCaptionEvent.call(ctx, text);
    } else {
      // Fix 5: debug not info — avoid log spam
      logger.debug('GoogleMeetJoiner(captionProcessor): handleCaptionEvent NOT SET');
    }

    await saveTranscriptLine(ctx, formattedLine);
  }

  return { lastCaptionLine, lastSpeakerName };
}


// Fix 2: Export cleanTranscript so it can be used at export time
function cleanTranscript(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const cleaned = [];

  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    const match = currentLine.match(/^(\[\d{2}:\d{2}:\d{2}\])\s*([^:]+):\s*(.*)$/);
    if (!match) continue;

    const [_, timestamp, speaker, text] = match;
    let isDuplicate = false;

    const cleanCurrent = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    const currentTailSignature = cleanCurrent.slice(-20);

    for (let j = i + 1; j < lines.length; j++) {
      const nextMatch = lines[j].match(/^(\[\d{2}:\d{2}:\d{2}\])\s*([^:]+):\s*(.*)$/);
      if (!nextMatch) continue;

      const [__, _ts, nextSpeaker, nextText] = nextMatch;
      if (speaker !== nextSpeaker) continue;

      const cleanNext = nextText.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (
        cleanNext.startsWith(cleanCurrent) ||
        (currentTailSignature && cleanNext.includes(currentTailSignature)) ||
        cleanCurrent.includes(cleanNext)
      ) {
        isDuplicate = true;
      }
      break;
    }

    if (!isDuplicate) {
      cleaned.push(`${timestamp} ${speaker}: ${text}`);
    }
  }

  return cleaned.join('\n');
}

module.exports = { processCaptionLines, cleanTranscript };